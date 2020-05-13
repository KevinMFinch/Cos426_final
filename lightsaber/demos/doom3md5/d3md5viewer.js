/*
 * ================================================================================================
 * -*- JavaScript -*-
 * File: d3md5viewer.js
 * Author: Guilherme R. Lampert
 * Created on: 2015-05-22
 * Brief: Main file for the Doom 3 md5 model viewer demo.
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
D3md5Viewer module / singleton:
===========================================================
*/
var D3md5Viewer = (function () {

	var degreesRotationX         = 0.0;
	var degreesRotationY         = 0.0;
	var zoomAmount               = 0.5;
	var model3dPosition          = vec3.create();
	var model3d                  = null;
	var shaderLit                = null;
	var shaderTexOnly            = null;

	// Available models the user may visualize:
	var mdlHellknight            = null; // DoomMd5Model
	var mdlMarinePlayer          = null; // DoomMd5Model
	var initPosHellknight        = vec3.fromValues(0.0, -65.0, -135.0);
	var initPosMarinePlayer      = vec3.fromValues(0.0, -35.0, -85.0);

	// Matrices used to transform the 3D model:
	var mIdentity                = mat4.create();
	var mTranslation             = mat4.create();
	var mRotX                    = mat4.create();
	var mRotY                    = mat4.create();
	var projectionMatrix         = mat4.create();
	var modelMatrix              = mat4.create();
	var mvpMatrix                = mat4.create();

	// Lighting information:
	var eyePosWorld              = vec3.fromValues(0.0,  0.0, 1.0);
	var lightPosWorld            = vec3.fromValues(5.0, 10.0, 5.0);
	var eyePosObject             = vec3.create();
	var lightPosObject           = vec3.create();

	// We start rotating the model by itself after a while without user input.
	var autoRotate               = true;   // Starts with an auto rotation
	var autoRotateAmount         = 0.4;    // Units per millisecond
	var autoRotateStartThreshold = 3000.0; // In milliseconds

	// Set of available render settings/modes:
	var renderMode = {
		texturedLit      : true,
		wireframe        : false,
		showTangentBasis : false,
		showColorMap     : false,
		showNormalMap    : false,
		showSpecularMap  : false
	};

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

	function resetRenderMode() {
		renderMode.texturedLit      = false;
		renderMode.wireframe        = false;
		renderMode.showTangentBasis = false;
		renderMode.showColorMap     = false;
		renderMode.showNormalMap    = false;
		renderMode.showSpecularMap  = false;
	}

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

	function hideLoadingAmination() {
		// Uses jQuery to hide the loading gif.
		// This assumes the page has an element with id = 'loading_animation'.
		if (document.getElementById("loading_animation")) {
			$("#loading_animation").hide();
		}
	}

	/*
	 * Public interface:
	 */
	return {
		setRenderMode : function (param) {
			jedi.logComment("Changing render mode to '" + param + "'...");
			resetRenderMode();

			//
			// NOTE:
			// Following strings are in sync with the HTML declarations!
			//
			if (param === "Textured lit") {
				renderMode.texturedLit = true;
			} else if (param === "Color map") {
				renderMode.showColorMap = true;
			} else if (param === "Normal map") {
				renderMode.showNormalMap = true;
			} else if (param === "Specular map") {
				renderMode.showSpecularMap = true;
			} else if (param === "Wireframe") {
				renderMode.wireframe = true;
			} else if (param === "Tangent basis") {
				renderMode.showTangentBasis = true;
				renderMode.texturedLit = true;
			} else {
				jedi.fatalError("Bad parameter!");
			}
		},

		setModelDisplayed : function (param) {
			jedi.logComment("Changing displayed model to '" + param + "'...");
			
			// Debug lines must be re-added because otherwise 
			// they would accumulate for both models.
			jedi.DebugRenderer.clearDebugLines();

			//
			// NOTE:
			// Following strings are in sync with the HTML declarations!
			//
			if (param === "Marine") {
				model3d = mdlMarinePlayer;
				vec3.copy(model3dPosition, initPosMarinePlayer);
			} else if (param === "Hellknight") {
				model3d = mdlHellknight;
				vec3.copy(model3dPosition, initPosHellknight);
			} else {
				jedi.fatalError("Bad parameter!");
			}

			if (model3d) {
				model3d.addDebugTangentBasis();
			}
		},

		onExit : function () {
			model3d       = null;
			shaderLit     = null;
			shaderTexOnly = null;
		},

		onResourcesLoaded : function () {
			//
			// Add little extra delay to make sure the loading animation
			// displays for a while. Since we are dealing with very little
			// data, it might be over too quickly otherwise.
			//
			window.setTimeout(function() {
				mat4.perspective(projectionMatrix, glMatrix.toRadian(60.0), 
				                 jedi.Renderer.getAspect(), 1.0, 500.0);

				// Once both demo models are loaded, this callback will fire
				// and enter the main application loop.
				var checkModelsLoaded = function () {
					if (mdlMarinePlayer.isLoading() || mdlHellknight.isLoading()) {
						return; // Not ready yet.
					}

					// Star showing the Hellknight monster model:
					//
					D3md5Viewer.setModelDisplayed("Hellknight");

					// Cache shader programs for easy access:
					//
					shaderLit     = jedi.ResourceManager.findShaderProgram("draw_md5_lit");
					shaderTexOnly = jedi.ResourceManager.findShaderProgram("textured_unlit");

					// Hook input event handlers:
					//
					hookMouseHandlers(); // Mouse on a desktop computer
					hookTouchHandlers(); // Touch device (mobile)

					// Enter the main application loop:
					//
					hideLoadingAmination();
					jedi.WebApp.run();
				};

				// Player/marine model:
				//
				mdlMarinePlayer = new DoomMd5Model();
				mdlMarinePlayer.initAsyncFromFile("demos/doom3md5/models/player.md5mesh",
					function (model, loadInfo) {
						jedi.logComment(model + " => " + loadInfo);
						checkModelsLoaded();
					},
					"demos/doom3md5/");

				// Player/marine model:
				//
				mdlHellknight = new DoomMd5Model();
				mdlHellknight.initAsyncFromFile("demos/doom3md5/models/hellknight.md5mesh",
					function (model, loadInfo) {
						jedi.logComment(model + " => " + loadInfo);
						checkModelsLoaded();
					},
					"demos/doom3md5/");

			}, 4000);
		},

		onUpdate : function (deltaTimeMillisec) {
			if (!model3d || model3d.isLoading()) {
				return;
			}

			//
			// Position the 3D model (update the matrices):
			//
			mat4.identity(mTranslation);
			mat4.identity(mRotX);
			mat4.identity(mRotY);
			mat4.identity(modelMatrix);
			mat4.identity(mvpMatrix);

			mat4.translate(mTranslation, mTranslation, model3dPosition);
			mat4.rotateX(mRotX, mRotX, glMatrix.toRadian(degreesRotationX));
			mat4.rotateY(mRotY, mRotY, glMatrix.toRadian(degreesRotationY));

			mat4.multiply(modelMatrix, mRotY, mRotX);
			mat4.multiply(modelMatrix, mTranslation, modelMatrix);
			mat4.multiply(mvpMatrix, projectionMatrix, modelMatrix);

			if (mouse.buttonDown) {
				degreesRotationY -= mouse.deltaX;
				degreesRotationX += mouse.deltaY;
				mouse.deltaX = mouse.deltaY = 0;
				degreesRotationY = jedi.clamp(degreesRotationY, -360.0, +360.0);
				degreesRotationX = jedi.clamp(degreesRotationX, -360.0, +360.0);
			} else {
				if ((jedi.WebApp.clockMilliseconds() - mouse.lastInputTime) > autoRotateStartThreshold) {
					// Start a default rotation after a while if no new user input is detected.
					autoRotate = true;
				}
			}

			if (autoRotate) {
				degreesRotationY += (autoRotateAmount * deltaTimeMillisec);
				if (degreesRotationY >= 360.0) { degreesRotationY = 0.0; }
			}
		},

		onRender : function (deltaTimeMillisec) {
			if (!model3d || model3d.isLoading()) {
				return;
			}

			jedi.Renderer.clearScreen();
			jedi.Renderer.setModelMatrix(modelMatrix);
			jedi.Renderer.setMvpMatrix(mvpMatrix);

			if (renderMode.texturedLit) {

				var invModelMatrix = jedi.Renderer.getInvModelMatrix();
				vec3.transformMat4(eyePosObject,   eyePosWorld,   invModelMatrix);
				vec3.transformMat4(lightPosObject, lightPosWorld, invModelMatrix);

				shaderLit.bind();
				shaderLit.setUniformVec3("u_light_pos_object_space", eyePosObject);
				shaderLit.setUniformVec3("u_eye_pos_object_space",   lightPosObject);

				model3d.drawModel(shaderLit);

			} else {

				shaderTexOnly.bind();
				shaderTexOnly.setUniformVec4("u_mtr_diffuse", [1.0, 1.0, 1.0, 1.0]);

				model3d.drawModel(shaderTexOnly, renderMode.wireframe, 
					renderMode.showNormalMap, renderMode.showSpecularMap);
			}

			if (renderMode.showTangentBasis) {
				jedi.DebugRenderer.drawDebugLines();
			}
		}
	};
}());
