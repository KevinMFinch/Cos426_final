
// ================================================================================================
// -*- JavaScript -*-
// File: Camera.js
// Author: Guilherme R. Lampert
// Created on: 2014-06-02
// Brief: Simple first-person camera.
// ================================================================================================

"use strict";

// =============================================
// Camera singleton:
// =============================================

//
// camera -- Simple first-person camera.
//
var camera = {

	/*	Initial Camera Axes:
		(up)
		+Y   +Z (forward)
		|   /
		|  /
		| /
		+ ------ +X (right)
	*/
	right   : vec3.create([1.0, 0.0, 0.0]), // The normalized axis that points to the "right"
	up      : vec3.create([0.0, 1.0, 0.0]), // The normalized axis that points "up"
	forward : vec3.create([0.0, 0.0, 1.0]), // The normalized axis that points "forward"
	eye     : vec3.create([0.0, 1.0, 0.0]), // The position of the camera (i.e. the camera's eye and the origin of the camera's coordinate system)

	// Camera movement and rotation speed:
	rotationSpeed : 4.0 * (1.0 / 60.0),
	movementSpeed : 7.0 * (1.0 / 60.0),

	// Projection parameters:
	fovy  : 60.0,
	zNear : 0.5,
	zFar  : 500.0,

	// Map of keyboard keys we care about:
	keyMap : { },

	// Current mouse/cursor position:
	oldCursorPosX     : 0,
	oldCursorPosY     : 0,
	currentCursorPosX : 0,
	currentCursorPosY : 0,

	// Pitch angle history:
	pitchAmt : 0.0,

	// ---- Methods: ----

	//
	// This function returns what the camera is looking at. Our eye is ALWAYS the origin
	// of camera's coordinate system and we are ALWAYS looking straight down the "forward" axis
	// so to calculate the target it's just a matter of adding the eye plus the forward.
	//
	getTarget : function() {
		return vec3.create([this.eye[0] + this.forward[0], this.eye[1] + this.forward[1], this.eye[2] + this.forward[2]]);
	},

	//
	// Build and return the 4x4 camera view matrix.
	//
	getViewMatrix : function() {
		var viewMatrix = mat4.create();
		mat4.lookAt(this.eye, this.getTarget(), this.up, viewMatrix);
		return (viewMatrix);
	},

	//
	// Get a perspective projection matrix that can be combined with the camera's view matrix.
	//
	getProjectionMatrix : function() {
		var projMatrix = mat4.create();
		mat4.perspective(this.fovy, (utils.gl.viewportWidth / utils.gl.viewportHeight), this.zNear, this.zFar, projMatrix);
		return (projMatrix);
	},

	//
	// Resets to a starting position.
	//
	reset : function(rightVec, upVec, forwardVec, eyeVec) {
		this.right   = rightVec;
		this.up      = upVec;
		this.forward = forwardVec;
		this.eye     = eyeVec;
	},

	//
	// Pitches camera by an angle in degrees. (tilt it up/down)
	//
	pitch : function(degrees) {
		// Calculate new forward:
		this.forward = this.rotateAroundAxis(this.forward, this.right, degrees);
		// Calculate new camera up vector:
		vec3.cross(this.forward, this.right, this.up);
	},

	//
	// Rotates around world Y-axis by the given angle (in degrees).
	//
	rotate : function(degrees) {

		var radians = degrees * utils.DEG_TO_RAD;
		var sinAng  = Math.sin(radians);
		var cosAng  = Math.cos(radians);

		// Save off forward components for computation:
		var xxx = this.forward[0];
		var zzz = this.forward[2];

		// Rotate forward vector:
		this.forward[0] = xxx *  cosAng + zzz * sinAng;
		this.forward[2] = xxx * -sinAng + zzz * cosAng;

		// Save off up components for computation:
		xxx = this.up[0];
		zzz = this.up[2];

		// Rotate up vector:
		this.up[0] = xxx *  cosAng + zzz * sinAng;
		this.up[2] = xxx * -sinAng + zzz * cosAng;

		// Save off right components for computation:
		xxx = this.right[0];
		zzz = this.right[2];

		// Rotate right vector:
		this.right[0] = xxx *  cosAng + zzz * sinAng;
		this.right[2] = xxx * -sinAng + zzz * cosAng;
	},

	//
	// Moves the camera by the given direction, using the default movement speed.
	// 'dir' must be either: "forward", "back", "left" or "right".
	// The last three parameters indicate in which axis to move. If it is equal to 1, move in that axis, if it is zero don't move.
	//
	move : function(dir, x, y, z) {

		if (dir == "forward") // Move along the camera's forward vector:
		{
			this.eye[0] += (this.forward[0] * this.movementSpeed) * x;
			this.eye[1] += (this.forward[1] * this.movementSpeed) * y;
			this.eye[2] += (this.forward[2] * this.movementSpeed) * z;
		}
		else if (dir == "back") // Move along the camera's negative forward vector:
		{
			this.eye[0] -= (this.forward[0] * this.movementSpeed) * x;
			this.eye[1] -= (this.forward[1] * this.movementSpeed) * y;
			this.eye[2] -= (this.forward[2] * this.movementSpeed) * z;
		}
		else if (dir == "left") // Move along the camera's negative right vector:
		{
			this.eye[0] += (this.right[0] * this.movementSpeed) * x;
			this.eye[1] += (this.right[1] * this.movementSpeed) * y;
			this.eye[2] += (this.right[2] * this.movementSpeed) * z;
		}
		else if (dir == "right") // Move along the camera's right vector:
		{
			this.eye[0] -= (this.right[0] * this.movementSpeed) * x;
			this.eye[1] -= (this.right[1] * this.movementSpeed) * y;
			this.eye[2] -= (this.right[2] * this.movementSpeed) * z;
		}
		else
		{
			utils.warning("Invalid camera move direction!");
		}
	},

	//
	// This allows us to rotate 'vec' around an arbitrary axis by an angle in degrees.
	// Used internally.
	//
	rotateAroundAxis : function(vec, axis, degrees) {

		var radians = degrees * utils.DEG_TO_RAD;
		var sinAng  = Math.sin(radians);
		var cosAng  = Math.cos(radians);

		var oneMinusCosAng = (1.0 - cosAng);
		var aX = axis[0];
		var aY = axis[1];
		var aZ = axis[2];

		// Calculate X component:
		var xxx = (aX * aX * oneMinusCosAng + cosAng)      * vec[0] +
		          (aX * aY * oneMinusCosAng + aZ * sinAng) * vec[1] +
		          (aX * aZ * oneMinusCosAng - aY * sinAng) * vec[2];

		// Calculate Y component:
		var yyy = (aX * aY * oneMinusCosAng - aZ * sinAng) * vec[0] +
		          (aY * aY * oneMinusCosAng + cosAng)      * vec[1] +
		          (aY * aZ * oneMinusCosAng + aX * sinAng) * vec[2];

		// Calculate Z component:
		var zzz = (aX * aZ * oneMinusCosAng + aY * sinAng) * vec[0] +
		          (aY * aZ * oneMinusCosAng - aX * sinAng) * vec[1] +
		          (aZ * aZ * oneMinusCosAng + cosAng)      * vec[2];

		return vec3.create([xxx, yyy, zzz]);
	},

	//
	// Receives a key up/down event and moves the camera accordingly.
	//
	keyboardInput : function(keyEvent, isKeyUp) {
		var keyChar = String.fromCharCode(keyEvent.keyCode)
		if (isKeyUp) // Key released:
		{
			this.keyMap[keyChar] = false;
		}
		else // Key pressed:
		{
			this.keyMap[keyChar] = true;
		}
	},

	//
	// Receive new mouse coordinates.
	//
	mouseInput : function(mx, my) {
		this.currentCursorPosX = mx;
		this.currentCursorPosY = my;
	},

	//
	// Updates camera based on mouse movement.
	// Called internally by camera.update().
	//
	look : function() {

		var edgeRotationSpeed = 6;
		var maxAngle = 89.5; // Max pitch angle to avoid a "Gimbal Lock"

		var deltaX, deltaY, amt;

		this.oldCursorPosX = this.currentCursorPosX;
		this.oldCursorPosY = this.currentCursorPosY;

		if (this.currentCursorPosX >= (utils.gl.viewportWidth - 50))
		{
			deltaX = edgeRotationSpeed;
		}
		else if (this.currentCursorPosX <= 50)
		{
			deltaX = -edgeRotationSpeed;
		}
		else
		{
			deltaX = this.currentCursorPosX - this.oldCursorPosX;
		}

		if (this.currentCursorPosY >= (utils.gl.viewportHeight - 50))
		{
			deltaY = edgeRotationSpeed;
		}
		else if (this.currentCursorPosY <= 50)
		{
			deltaY = -edgeRotationSpeed;
		}
		else
		{
			deltaY = this.currentCursorPosY - this.oldCursorPosY;
		}

		// Rotate left/right:
		amt = (deltaX * this.rotationSpeed);
		this.rotate(-amt);

		// Calculate amount to rotate up/down:
		amt = (deltaY * this.rotationSpeed);

		// Clamp pitch amount:
		if ((this.pitchAmt + amt) <= -maxAngle)
		{
			amt = -maxAngle - this.pitchAmt;
			this.pitchAmt = -maxAngle;
		}
		else if ((this.pitchAmt + amt) >= maxAngle)
		{
			amt = maxAngle - this.pitchAmt;
			this.pitchAmt = maxAngle;
		}
		else
		{
			this.pitchAmt += amt;
		}

		// Pitch camera:
		this.pitch(-amt);
	},

	//
	// Updates the camera based on input received.
	// Should be called every frame.
	//
	update : function() {

		if (this.keyMap['W'] == true)
		{
			this.move("forward", 1.0, 1.0, 1.0);
		}
		if (this.keyMap['S'] == true)
		{
			this.move("back", 1.0, 1.0, 1.0);
		}
		if (this.keyMap['D'] == true)
		{
			this.move("right", 1.0, 1.0, 1.0);
		}
		if (this.keyMap['A'] == true)
		{
			this.move("left", 1.0, 1.0, 1.0);
		}

		this.look();
	}
};
