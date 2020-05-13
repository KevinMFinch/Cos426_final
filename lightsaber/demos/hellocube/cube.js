/*
 * ================================================================================================
 * -*- JavaScript -*-
 * File: cube.js
 * Author: Guilherme R. Lampert
 * Created on: 2015-05-22
 * Brief: Main file for the hello-cube demo.
 *
 * License:
 *  This source code is released under the MIT License.
 *  Copyright (c) 2015 Guilherme R. Lampert.
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the "Software"), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 *
 * ================================================================================================
 */

"use strict";

/*
===========================================================
CubeDemo module / singleton:
===========================================================
*/
var CubeDemo = (function () {

	var degreesRotationX = 5.0;
	var degreesRotationZ = 25.0;
	var zoomAmount       = 0.1;
	var model3dPosition  = vec3.fromValues(0.0, 0.0, -15.0);
	var model3d          = null;

	// Matrices used to transform the 3D model:
	var mIdentity        = mat4.create();
	var mTranslation     = mat4.create();
	var mRotX            = mat4.create();
	var mRotZ            = mat4.create();
	var projectionMatrix = mat4.create();
	var modelMatrix      = mat4.create();
	var mvpMatrix        = mat4.create();

	// We start rotating the model by itself after a while without user input.
	var autoRotate               = true;   // Starts with an auto rotation
	var autoRotateAmount         = 0.4;    // Units per millisecond
	var autoRotateStartThreshold = 3000.0; // In milliseconds

	// Keeps track of mouse movement and clicks over the GL canvas.
	var mouse = {
		deltaX        : 0,
		deltaY        : 0,
		lastPosX      : 0,
		lastPosY      : 0,
		lastInputTime : 0,
		maxDelta      : 100,
		buttonDown    : false // The left button, actually
	};

	function updateMouseDeltas(mx, my) {

		mouse.deltaX   = mx - mouse.lastPosX;
		mouse.deltaY   = my - mouse.lastPosY;
		mouse.lastPosX = mx;
		mouse.lastPosY = my;
		mouse.deltaX   = jedi.clamp(mouse.deltaX, -mouse.maxDelta, +mouse.maxDelta);
		mouse.deltaY   = jedi.clamp(mouse.deltaY, -mouse.maxDelta, +mouse.maxDelta);

		mouse.lastInputTime = jedi.WebApp.clockMilliseconds();
	}

	function hookMouseHandlers() {
		var canvas = document.getElementById("webgl_canvas");
		if (!canvas) {
			jedi.logError("Failed to get WebGL canvas element! User input is compromised!");
			return;
		}

		canvas.onmousemove = function (mouseEvent) {
			updateMouseDeltas(mouseEvent.clientX, mouseEvent.clientY);
		};

		canvas.onmousedown = function (mouseEvent) {
			var leftButtonDown = false;
			mouseEvent = mouseEvent || window.event;

			if ("which" in mouseEvent) {
				// Gecko (Firefox), WebKit (Safari/Chrome) & Opera
			    leftButtonDown = (mouseEvent.which == 1);
			} else if ("button" in mouseEvent) {
				// IE, Opera
			    leftButtonDown = (mouseEvent.button == 0);
			}

			mouse.buttonDown    = leftButtonDown;
			mouse.lastInputTime = jedi.WebApp.clockMilliseconds();
			autoRotate          = false;
		};

		canvas.onmouseup = function (mouseEvent) {
			mouse.buttonDown = false;
		};

		// Zoom in|out with mouse wheel.
		// Note: `addEventListener` is recommended for compatibility with IE.
		canvas.addEventListener("wheel",
			function (mouseEvent) {
				mouseEvent.preventDefault();
				if (mouseEvent.deltaY > 0) {
					model3dPosition[2] += zoomAmount;
				} else if (mouseEvent.deltaY < 0) {
					model3dPosition[2] -= zoomAmount;				
				}
			},
			false
		);
	}

	function hookTouchHandlers() {
		var canvas = document.getElementById("webgl_canvas");
		if (!canvas) {
			jedi.logError("Failed to get WebGL canvas element! User input is compromised!");
			return;
		}

		var touchStarted = function (touchEvent) {
			touchEvent.preventDefault();
			autoRotate          = false;
			mouse.buttonDown    = true;
			mouse.lastInputTime = jedi.WebApp.clockMilliseconds();
		};

		var touchEnded = function (touchEvent) {
			touchEvent.preventDefault();
			mouse.buttonDown = false;
		};

		var touchMoved = function (touchEvent) {
			touchEvent.preventDefault();
			var touches = touchEvent.changedTouches;
			for (var t = 0; t < touches.length; ++t) {
				updateMouseDeltas(touches[t].clientX, touches[t].clientY);
			}
		};

		//
		// https://developer.mozilla.org/en-US/docs/Web/API/Touch_events
		//
		canvas.addEventListener("touchstart",  touchStarted, false);
		canvas.addEventListener("touchmove",   touchMoved,   false);
		canvas.addEventListener("touchend",    touchEnded,   false);
		canvas.addEventListener("touchcancel", touchEnded,   false);
		canvas.addEventListener("touchleave",  touchEnded,   false);
	}

	/*
	 * Public interface:
	 */
	return {
		onResourcesLoaded : function () {
			mat4.perspective(projectionMatrix, glMatrix.toRadian(60.0), 
			                 jedi.Renderer.getAspect(), 1.0, 250.0);

			// Create a default cube/box shape:
			//
			model3d = jedi.Model3D.createBoxShape(5.0, 5.0, 5.0);

			// Hook input event handlers:
			//
			hookMouseHandlers(); // Mouse on a desktop computer
			hookTouchHandlers(); // Touch device (mobile)

			// Enter the main application loop:
			//
			jedi.WebApp.run();
		},

		onUpdate : function (deltaTimeMillisec) {
			if (!model3d) {
				return;
			}

			//
			// Position the 3D model (update the matrices):
			//
			mat4.identity(mTranslation);
			mat4.identity(mRotX);
			mat4.identity(mRotZ);
			mat4.identity(modelMatrix);
			mat4.identity(mvpMatrix);

			mat4.translate(mTranslation, mTranslation, model3dPosition);
			mat4.rotateX(mRotX, mRotX, glMatrix.toRadian(degreesRotationX));
			mat4.rotateZ(mRotZ, mRotZ, glMatrix.toRadian(degreesRotationZ));

			mat4.multiply(modelMatrix, mRotZ, mRotX);
			mat4.multiply(modelMatrix, mTranslation, modelMatrix);
			mat4.multiply(mvpMatrix, projectionMatrix, modelMatrix);

			if (mouse.buttonDown) {
				degreesRotationZ -= mouse.deltaX;
				degreesRotationX += mouse.deltaY;
				mouse.deltaX = mouse.deltaY = 0;
				degreesRotationZ = jedi.clamp(degreesRotationZ, -360.0, +360.0);
				degreesRotationX = jedi.clamp(degreesRotationX, -360.0, +360.0);
			} else {
				if ((jedi.WebApp.clockMilliseconds() - mouse.lastInputTime) > autoRotateStartThreshold) {
					// Start a default rotation after a while if no new user input is detected.
					autoRotate = true;
				}
			}

			if (autoRotate) {
				degreesRotationX += (autoRotateAmount * deltaTimeMillisec);
				degreesRotationZ += (autoRotateAmount * deltaTimeMillisec);
				if (degreesRotationX >= 360.0) { degreesRotationX = 0.0; }
				if (degreesRotationZ >= 360.0) { degreesRotationZ = 0.0; }
			}
		},

		onRender : function (deltaTimeMillisec) {
			if (!model3d) {
				return;
			}

			jedi.Renderer.clearScreen();
			jedi.Renderer.setModelMatrix(modelMatrix);
			jedi.Renderer.setMvpMatrix(mvpMatrix);
			model3d.drawModel();
		}
	};
}());
