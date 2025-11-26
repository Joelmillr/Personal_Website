/**
 * 3D viewer using Three.js
 * Displays vehicle and helmet orientations with HUD
 */
class Viewer3D {
    constructor(canvasId) {
        this.canvasId = canvasId;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.vehicleGroup = null;
        this.helmetRef = null;  // Helmet reference quaternion for recentering
        this.useRef = false;    // Whether to use helmet reference alignment
        
        // NED to WebGL coordinate conversion
        // Based on Godot's Logic_1.gd simple conversion:
        // vqy = -VQZ, vqz = VQY (swap Y and Z, negate Z)
        // This is simpler and more direct than the matrix approach
    }
    
    initialize() {
        const canvas = document.getElementById(this.canvasId);
        if (!canvas) {
            console.error(`Canvas element with id '${this.canvasId}' not found`);
            return;
        }
        
        // Ensure canvas has dimensions
        const container = canvas.parentElement;
        if (container) {
            const rect = container.getBoundingClientRect();
            canvas.width = rect.width || 400;
            canvas.height = rect.height || 400;
        }
        
        const width = canvas.clientWidth || canvas.width || 400;
        const height = canvas.clientHeight || canvas.height || 400;
        
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);  // Black background like HMD
        
        // Create camera (first-person helmet view)
        this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        this.camera.position.set(0, 0, 0);
        
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: canvas,
            antialias: true 
        });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        
        // Add lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
        this.scene.add(ambientLight);
        
        // Create vehicle group
        this.vehicleGroup = new THREE.Group();
        this.scene.add(this.vehicleGroup);
        
        // Create better aircraft representation
        this.createAircraft();
        
        // Create HUD elements (pitch ladder, horizon, crosshair)
        this.createHUD();
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Start render loop
        this.animate();
        
        console.log('3D viewer initialized successfully');
    }
    
    createAircraft() {
        // Create a more realistic aircraft representation
        // Main fuselage
        const fuselageGeometry = new THREE.CylinderGeometry(0.3, 0.4, 4, 16);
        const fuselageMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffffff,
            metalness: 0.8,
            roughness: 0.2
        });
        const fuselage = new THREE.Mesh(fuselageGeometry, fuselageMaterial);
        fuselage.rotation.z = Math.PI / 2;
        fuselage.position.set(0, -0.5, -5);
        this.vehicleGroup.add(fuselage);
        
        // Wings
        const wingGeometry = new THREE.BoxGeometry(6, 0.1, 1.5);
        const wingMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xcccccc,
            metalness: 0.7,
            roughness: 0.3
        });
        const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
        leftWing.position.set(-3, -0.5, -5);
        this.vehicleGroup.add(leftWing);
        const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
        rightWing.position.set(3, -0.5, -5);
        this.vehicleGroup.add(rightWing);
        
        // Tail
        const tailGeometry = new THREE.BoxGeometry(0.2, 1.5, 1);
        const tail = new THREE.Mesh(tailGeometry, fuselageMaterial);
        tail.position.set(0, 0.5, -6.5);
        this.vehicleGroup.add(tail);
        
        // Vertical stabilizer
        const vStabGeometry = new THREE.BoxGeometry(0.2, 1.5, 0.8);
        const vStab = new THREE.Mesh(vStabGeometry, fuselageMaterial);
        vStab.position.set(0, 0.5, -6.5);
        this.vehicleGroup.add(vStab);
    }
    
    createHUD() {
        // Create HUD group (attached to camera, moves with head)
        this.hudGroup = new THREE.Group();
        this.scene.add(this.hudGroup);
        
        // Pitch ladder - horizontal lines with angle labels
        this.createPitchLadder();
        
        // Horizon line
        this.createHorizonLine();
        
        // Crosshair (center reticle)
        this.createCrosshair();
        
        // Water line (ground reference)
        this.createWaterLine();
    }
    
    createPitchLadder() {
        const pitchLadderGroup = new THREE.Group();
        
        // Create pitch ladder lines (every 10 degrees, major lines every 30)
        for (let i = -90; i <= 90; i += 10) {
            const isMajor = Math.abs(i) % 30 === 0;
            const lineLength = isMajor ? 2.0 : 1.0;
            const lineColor = i === 0 ? 0x00ff00 : (isMajor ? 0x00cc00 : 0x008800);
            const lineWidth = i === 0 ? 3 : (isMajor ? 2 : 1);
            
            // Horizontal line
            const lineGeometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(-lineLength, i * 0.05, -2),
                new THREE.Vector3(lineLength, i * 0.05, -2)
            ]);
            const lineMaterial = new THREE.LineBasicMaterial({ 
                color: lineColor,
                linewidth: lineWidth
            });
            const line = new THREE.Line(lineGeometry, lineMaterial);
            pitchLadderGroup.add(line);
            
            // Angle labels on major lines
            if (isMajor && i !== 0) {
                // Left label
                const leftLabel = this.createTextLabel(`${Math.abs(i)}°`, -lineLength - 0.3, i * 0.05, -2);
                pitchLadderGroup.add(leftLabel);
                // Right label
                const rightLabel = this.createTextLabel(`${Math.abs(i)}°`, lineLength + 0.3, i * 0.05, -2);
                pitchLadderGroup.add(rightLabel);
            }
        }
        
        pitchLadderGroup.position.set(0, 0, -2);
        this.hudGroup.add(pitchLadderGroup);
        this.pitchLadder = pitchLadderGroup;
    }
    
    createTextLabel(text, x, y, z) {
        // Simple text representation using geometry (for now)
        // In a real implementation, you'd use a text texture or canvas texture
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#00ff00';
        ctx.font = '16px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 32, 16);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        const material = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(0.3, 0.15, 1);
        sprite.position.set(x, y, z);
        return sprite;
    }
    
    createHorizonLine() {
        // Horizon line (sky/ground divider)
        const horizonGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-10, 0, -2),
            new THREE.Vector3(10, 0, -2)
        ]);
        const horizonMaterial = new THREE.LineBasicMaterial({ 
            color: 0x00ff00,
            linewidth: 2
        });
        const horizonLine = new THREE.Line(horizonGeometry, horizonMaterial);
        this.hudGroup.add(horizonLine);
        this.horizonLine = horizonLine;
    }
    
    createCrosshair() {
        const crosshairGroup = new THREE.Group();
        
        // Center dot
        const dotGeometry = new THREE.CircleGeometry(0.02, 8);
        const dotMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const dot = new THREE.Mesh(dotGeometry, dotMaterial);
        dot.position.set(0, 0, -1);
        crosshairGroup.add(dot);
        
        // Vertical line
        const vLineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, -0.1, -1),
            new THREE.Vector3(0, 0.1, -1)
        ]);
        const vLine = new THREE.Line(
            vLineGeometry,
            new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 })
        );
        crosshairGroup.add(vLine);
        
        // Horizontal line
        const hLineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-0.1, 0, -1),
            new THREE.Vector3(0.1, 0, -1)
        ]);
        const hLine = new THREE.Line(
            hLineGeometry,
            new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 })
        );
        crosshairGroup.add(hLine);
        
        crosshairGroup.position.set(0, 0, -1);
        this.hudGroup.add(crosshairGroup);
        this.crosshair = crosshairGroup;
    }
    
    createWaterLine() {
        // Water line (ground reference, moves with pitch)
        const waterLineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-8, 0, -2),
            new THREE.Vector3(8, 0, -2)
        ]);
        const waterLineMaterial = new THREE.LineBasicMaterial({ 
            color: 0x00ffff,
            linewidth: 2
        });
        const waterLine = new THREE.Line(waterLineGeometry, waterLineMaterial);
        this.hudGroup.add(waterLine);
        this.waterLine = waterLine;
    }
    
    updateOrientation(vqx, vqy, vqz, vqw, hqx, hqy, hqz, hqw) {
        // Convert NED quaternions to WebGL/Three.js coordinate system
        // Based on Godot's Logic_1.gd: swap Y and Z, negate Z
        // Note: Three.js Quaternion constructor is (x, y, z, w)
        // Godot's Logic_1.gd does: vqy = -VQZ, vqz = VQY
        // This converts: (x, y, z, w) -> (x, -z, y, w)
        
        // Vehicle quaternion conversion (NED to WebGL)
        // From Logic_1.gd line 115-117: vqy = -VQZ, vqz = VQY
        // Three.js: new Quaternion(x, y, z, w) where x,y,z are the vector part
        const vqWebGL = new THREE.Quaternion(vqx, -vqz, vqy, vqw);
        vqWebGL.normalize();
        
        // Helmet quaternion conversion (same as vehicle)
        // From Logic_1.gd line 125-127: hqy = -HQZ, hqz = HQY
        let hqWebGL = new THREE.Quaternion(hqx, -hqz, hqy, hqw);
        hqWebGL.normalize();
        
        // Apply helmet reference alignment (like Godot's _use_ref system)
        if (this.useRef && this.helmetRef) {
            // Apply the stored correction offset: aligned = helmet_ref * hq
            hqWebGL = this.helmetRef.clone().multiply(hqWebGL).normalize();
        }
        
        // Apply vehicle orientation to entire vehicle group
        if (this.vehicleGroup) {
            this.vehicleGroup.quaternion.copy(vqWebGL);
        }
        
        // Apply helmet orientation to camera (first-person view)
        if (this.camera) {
            this.camera.quaternion.copy(hqWebGL);
        }
        
        // HUD elements move with camera (already attached to hudGroup which is in scene)
        // But pitch ladder yaw should follow vehicle
        if (this.pitchLadder && this.vehicleGroup) {
            const vEuler = new THREE.Euler().setFromQuaternion(vqWebGL);
            // Only apply yaw rotation to pitch ladder (like Godot)
            this.pitchLadder.rotation.y = vEuler.y;
        }
        
        // Update water line position based on vehicle pitch
        if (this.waterLine && this.vehicleGroup) {
            const vEuler = new THREE.Euler().setFromQuaternion(vqWebGL);
            // Water line moves up/down with pitch
            this.waterLine.position.y = -vEuler.x * 0.05;  // Scale pitch to screen space
        }
    }
    
    // Recenter helmet (like Godot's reset_helmet_reference)
    recenterHelmet() {
        if (!this.vehicleGroup || !this.camera) {
            return;
        }
        
        const vehicleQ = this.vehicleGroup.quaternion.clone().normalize();
        const helmetQ = this.camera.quaternion.clone().normalize();
        
        // Compute offset: helmet_ref = vehicle * helmet^-1
        this.helmetRef = vehicleQ.clone().multiply(helmetQ.clone().invert()).normalize();
        this.useRef = true;
        
        console.log('Helmet recentered');
    }
    
    onWindowResize() {
        const canvas = document.getElementById(this.canvasId);
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        
        if (this.camera && this.renderer) {
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        }
    }
    
    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
    
    dispose() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        // Clean up Three.js resources
    }
}
