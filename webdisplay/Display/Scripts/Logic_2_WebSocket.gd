extends Node3D

# Modified version of Logic_2.gd for WebSocket (HTML5 export)
# Instead of UDP, this version uses WebSocket to receive data from the web backend

@export var _vehicle_node: Node3D
@export var _helmet_node: Node3D
@export var _pitch_ladder_node: Node3D
@export var _heading_tape: Control
@export var Gspeed_lable: RichTextLabel
@export var Alt_lable: RichTextLabel

@export var _3D_model: Node3D

# WebSocket connection (replaces UDP)
var _websocket: WebSocketPeer = null
var _websocket_url: String = "ws://127.0.0.1:5000/godot"

# Helmet reference orientation (for recenter)
var _helmet_ref: Quaternion = Quaternion.IDENTITY
var _use_ref: bool = false
var _last_hq: Quaternion = Quaternion.IDENTITY
var _vehicle_ref: Quaternion = Quaternion.IDENTITY

var _last_yaw: float = 0.0
var _yaw_accum: float = 0.0

var is_FullScreen: bool = false

# NED (VN) -> Godot (Y-up, -Z forward) basis rotation
var R_ned_to_godot: Quaternion = Quaternion(Basis(
	Vector3(0, 0, -1),  # N (X_ned) -> -Z (forward)
	Vector3(1, 0, 0),   # E (Y_ned) -> +X (right)
	Vector3(0,-1, 0)    # D (Z_ned) -> -Y (up)
)).normalized()

func ned_q_to_godot(q_ned: Quaternion) -> Quaternion:
	return (R_ned_to_godot * q_ned * R_ned_to_godot.inverse()).normalized()

func _ready() -> void:
	if _vehicle_node == null or _helmet_node == null:
		push_error("Vehicle/Helmet nodes not found.")
	if _pitch_ladder_node == null:
		push_error("PitchLadder not assigned.")
	
	# Initialize WebSocket connection
	_websocket = WebSocketPeer.new()
	var err = _websocket.connect_to_url(_websocket_url)
	if err != OK:
		push_error("WebSocket connection failed: " + str(err))
	else:
		print("WebSocket connecting to: ", _websocket_url)
	
	# Sync local flag with actual window mode on start
	is_FullScreen = DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN

func _input(event):
	if event.is_action_pressed("FullScreen"):
		is_FullScreen = not is_FullScreen
		if is_FullScreen:
			DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_EXCLUSIVE_FULLSCREEN)
		else:
			DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)
	if event.is_action_pressed("Recenter"):
		reset_helmet_reference(_last_hq)
	if event.is_action_pressed("Quit"):
		get_tree().quit()

func extract_pitch_roll_only(q: Quaternion) -> Quaternion:
	var e = q.get_euler()
	var pitch = e.x
	var roll  = e.z
	# ignore yaw
	return Quaternion.from_euler(Vector3(pitch, 0.0, roll))

func _process(_delta: float) -> void:
	# Poll WebSocket for messages
	if _websocket != null:
		_websocket.poll()
		
		# Check connection status
		var state = _websocket.get_ready_state()
		if state == WebSocketPeer.STATE_OPEN:
			# Receive messages
			while _websocket.get_available_packet_count() > 0:
				var packet = _websocket.get_packet()
				var msg_str = packet.get_string_from_utf8()
				var msg = JSON.parse_string(msg_str)
				if typeof(msg) == TYPE_DICTIONARY:
					_apply_msg(msg)
		elif state == WebSocketPeer.STATE_CLOSED:
			# Try to reconnect
			var err = _websocket.connect_to_url(_websocket_url)
			if err != OK:
				# Connection failed, will retry next frame
				pass

	# Update pitch ladder yaw if available
	if _vehicle_node and _pitch_ladder_node:
		var vq = _vehicle_node.quaternion
		var yaw = vq.get_euler().y   # extract yaw only
		var yaw_q = Quaternion(Vector3.UP, yaw)
		_pitch_ladder_node.quaternion = yaw_q
		
	 # Drive heading tape from helmet yaw
	if _helmet_node and _heading_tape:
		var hq = _helmet_node.quaternion.normalized()
		var raw_yaw = rad_to_deg(-hq.get_euler().y)  # range [-180, 180]

		# Compute delta between this and last
		var delta = raw_yaw - _last_yaw

		# Handle wrap-around
		if delta > 180.0:
			delta -= 360.0
		elif delta < -180.0:
			delta += 360.0

		_yaw_accum += delta
		_last_yaw = raw_yaw

		_heading_tape.scroll_value  = _yaw_accum
		
		_heading_tape.pitch_value = rad_to_deg(hq.get_euler().x)
		
	if _3D_model:
		 # rotate 3d model in roll and pitch only
		var mq = _vehicle_node.quaternion
		var euler = mq.get_euler()  # already radians
		
		var mpitch = euler.x 
		var mroll  = euler.z 
	
		# Apply pitch and roll directly
		_3D_model.rotation = Vector3(mpitch, 0.0, mroll)

func _apply_msg(msg: Dictionary) -> void:
	var has_v: bool = msg.has("VQX") and msg.has("VQY") and msg.has("VQZ") and msg.has("VQW")
	var has_h: bool = msg.has("HQX") and msg.has("HQY") and msg.has("HQZ") and msg.has("HQW")
	
	var GSPEED = msg.get("GSPEED", 0.0)
	var ALT = msg.get("VALT", 0.0)
	
	if Gspeed_lable:
		Gspeed_lable.text = "Gspeed:" +"\n"+ str(GSPEED).pad_decimals(2)
	if Alt_lable:
		Alt_lable.text = "Altitude:" +"\n"+ str(ALT).pad_decimals(2)
	
	if not has_v and not has_h:
		return

	if has_v:
		var vq_raw := Quaternion(float(msg["VQX"]), float(msg["VQY"]), float(msg["VQZ"]), float(msg["VQW"]))
		var vq := ned_q_to_godot(vq_raw)
		if _vehicle_node:
			_vehicle_node.quaternion = vq
			_vehicle_ref = vq

	if has_h:
		var hq_raw := Quaternion(float(msg["HQX"]), float(msg["HQY"]), float(msg["HQZ"]), float(msg["HQW"]))
		var hq := ned_q_to_godot(hq_raw).normalized()
		_last_hq = hq
		
		if _helmet_node:
			if _use_ref:
				# Apply the stored correction offset
				var aligned := (_helmet_ref * hq).normalized()
				_helmet_node.quaternion = aligned
			else:
				_helmet_node.quaternion = hq

# this is remapped to R key
func reset_helmet_reference(hq: Quaternion):
	if not _vehicle_node:
		return
	
	# Normalize both inputs
	var vehicle_now := _vehicle_node.quaternion.normalized()
	var helmet_now := hq.normalized()
	
	# Compute offset so that when applied, helmet aligns with vehicle yaw
	# This means: offset = vehicle * helmet⁻¹
	_helmet_ref = (vehicle_now * helmet_now.inverse()).normalized()
	
	# Save vehicle reference too (optional, if you use it elsewhere)
	_vehicle_ref = vehicle_now
	
	# Enable reference alignment
	_use_ref = true
	
	print("Helmet recentered → offset quaternion stored")

