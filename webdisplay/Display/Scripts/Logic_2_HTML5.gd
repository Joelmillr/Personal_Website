extends Node3D

# Modified version of Logic_2.gd for HTML5 export
# Uses JavaScript bridge to receive WebSocket data (since browsers can't use UDP)

@export var _vehicle_node: Node3D
@export var _helmet_node: Node3D
@export var _pitch_ladder_node: Node3D
@export var _heading_tape: Control
@export var Gspeed_lable: RichTextLabel
@export var Alt_lable: RichTextLabel

@export var _3D_model: Node3D

# JavaScript interface for HTML5
var _js_interface = null
var _udp: PacketPeerUDP = null  # For non-HTML5 builds

# Helmet reference orientation (for recenter)
var _helmet_ref: Quaternion = Quaternion.IDENTITY
var _use_ref: bool = false
var _last_hq: Quaternion = Quaternion.IDENTITY
var _vehicle_ref: Quaternion = Quaternion.IDENTITY

var _last_yaw: float = 0.0
var _yaw_accum: float = 0.0

var is_FullScreen: bool = false

# Smooth interpolation for quaternions (to prevent jerky motion)
var _target_vehicle_q: Quaternion = Quaternion.IDENTITY
var _target_helmet_q: Quaternion = Quaternion.IDENTITY
var _smooth_factor: float = 0.15  # Higher = faster, more responsive (0.1-0.3 recommended)
var _targets_initialized: bool = false  # Track if targets have been set at least once
var _data_received_count: int = 0  # Debug counter

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
	
	# Get JavaScript interface for HTML5 (browsers can't use UDP)
	if OS.has_feature("web"):
		_js_interface = JavaScriptBridge.get_interface("window")
		if _js_interface:
			print("JavaScript interface available for HTML5 - using WebSocket bridge")
		else:
			push_error("JavaScript interface not available")
	else:
		# Fallback to UDP for non-HTML5 builds (desktop/standalone)
		_udp = PacketPeerUDP.new()
		var err := _udp.bind(1991)
		if err != OK:
			push_error("UDP bind failed on port 1991")
		else:
			print("UDP listening on port 1991")
	
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
	# Poll for data (UDP or JavaScript bridge)
	if OS.has_feature("web"):
		# HTML5: Poll JavaScript bridge for WebSocket data using eval
		# Only poll once per frame - the JavaScript bridge always returns the latest data
		# Polling multiple times per frame is wasteful and causes lag
		var data = JavaScriptBridge.eval("window.getGodotData();", true)
		if data != null:
			# Data from JavaScript should be a Dictionary/Variant
			# Try to use it directly, or convert if needed
			var msg = null
			if typeof(data) == TYPE_DICTIONARY:
				msg = data
			elif typeof(data) == TYPE_STRING:
				# If it's a string, parse it as JSON
				msg = JSON.parse_string(data)
			else:
				# Try to convert via JSON stringify/parse
				var msg_str = JSON.stringify(data)
				msg = JSON.parse_string(msg_str)
			
			if msg != null and typeof(msg) == TYPE_DICTIONARY:
				# Debug: Log data reception occasionally
				_data_received_count += 1
				if _data_received_count <= 5 or _data_received_count % 100 == 0:
					print("[Godot] Received data #", _data_received_count, " type: ", typeof(msg))
					if msg.has("VQX"):
						print("[Godot] Applying message with VQX=", str(msg["VQX"]), " VQY=", str(msg["VQY"]))
				_apply_msg(msg)
	else:
		# Non-HTML5: Use UDP (original method)
		if _udp:
			while _udp.get_available_packet_count() > 0:
				var bytes: PackedByteArray = _udp.get_packet()
				var msg_str: String = bytes.get_string_from_utf8()
				var msg = JSON.parse_string(msg_str)
				if typeof(msg) == TYPE_DICTIONARY:
					_apply_msg(msg)

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
	
	# CRITICAL: Smoothly interpolate quaternions every frame for smooth motion
	# This prevents jerky motion when data updates arrive at irregular intervals
	# Only interpolate if targets have been initialized (data has been received at least once)
	if _targets_initialized:
		# TEMPORARILY DISABLED: Direct assignment to debug why display isn't updating
		# TODO: Re-enable interpolation once we confirm data is being applied
		if _vehicle_node:
			# Direct assignment for now to ensure data is being applied
			_vehicle_node.quaternion = _target_vehicle_q
			
		if _helmet_node:
			var target_hq = _target_helmet_q
			if _use_ref:
				# Apply the stored correction offset to target
				target_hq = (_helmet_ref * _target_helmet_q).normalized()
			# Direct assignment for now to ensure data is being applied
			_helmet_node.quaternion = target_hq
		
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
		# Apply directly for now (interpolation disabled for debugging)
		if _vehicle_node:
			_vehicle_node.quaternion = vq
			_target_vehicle_q = vq
			_vehicle_ref = vq
			_targets_initialized = true

	if has_h:
		var hq_raw := Quaternion(float(msg["HQX"]), float(msg["HQY"]), float(msg["HQZ"]), float(msg["HQW"]))
		var hq := ned_q_to_godot(hq_raw).normalized()
		_last_hq = hq
		# Apply directly for now (interpolation disabled for debugging)
		if _helmet_node:
			if _use_ref:
				var aligned := (_helmet_ref * hq).normalized()
				_helmet_node.quaternion = aligned
			else:
				_helmet_node.quaternion = hq
			_target_helmet_q = hq
			_targets_initialized = true

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

