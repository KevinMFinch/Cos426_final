/*
 * ================================================================================================
 * -*- JavaScript -*-
 * File: renderer.js
 * Author: Guilherme R. Lampert
 * Created on: 2015-04-25
 * Brief: Renderer interface.
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
if (typeof jedi !== "object") {
	alert("Error: Import/load 'jedi.js' first!");
	throw "Script load error";
}
var jedi = jedi;

/*
===========================================================
jedi.Renderer singleton class:
===========================================================
*/
jedi.Renderer = (function () {

	/*
	 * Private data:
	 */
	var gl                = null;
	var screenQuadVbo     = null;
	var screenWidth       = 0;
	var screenHeight      = 0;
	var pixelRatio        = 1;
	var defaultClearColor = [0.0, 0.0, 0.0, 1.0]; // Default `gl.clearColor()` value (RGBA floats).
	// Frame transforms and aux render params:
	var eyePos            = vec4.fromValues(0.0, 0.0, 0.0, 1.0);
	var mvpMatrix         = mat4.create();
	var modelMatrix       = mat4.create();
	var invModelMatrix    = mat4.create();

	/*
	 * Internal helpers:
	 */
	function getWebGLErrorStr(errorCode) {
		jedi.assert(gl, "WebGL not initialized!");
		switch (errorCode) {
		case gl.OUT_OF_MEMORY                 : return "GL_OUT_OF_MEMORY";
		case gl.INVALID_ENUM                  : return "GL_INVALID_ENUM";
		case gl.INVALID_OPERATION             : return "GL_INVALID_OPERATION";
		case gl.INVALID_FRAMEBUFFER_OPERATION : return "GL_INVALID_FRAMEBUFFER_OPERATION";
		case gl.INVALID_VALUE                 : return "GL_INVALID_VALUE";
		case gl.CONTEXT_LOST_WEBGL            : return "GL_CONTEXT_LOST_WEBGL";
		default                               : return "GL_NO_ERROR";
		} // switch (errorCode)
	}

	function checkWebGLErrors() {
		jedi.assert(gl, "WebGL not initialized!");
		var errorCode = gl.getError();
		while (errorCode != gl.NO_ERROR) {
			jedi.logError("WebGL error: " + getWebGLErrorStr(errorCode) + " (" + errorCode + ")");
			errorCode = gl.getError();
		}
	}

	function setDefaultWebGLStates() {
		jedi.assert(gl, "WebGL not initialized!");
		jedi.assert(screenWidth  > 0);
		jedi.assert(screenHeight > 0);

		gl.viewport(0, 0, screenWidth / pixelRatio, screenHeight / pixelRatio);
		gl.clearColor(defaultClearColor[0], defaultClearColor[1], defaultClearColor[2], defaultClearColor[3]);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		gl.enable(gl.DEPTH_TEST);
		gl.enable(gl.CULL_FACE);

		gl.cullFace(gl.BACK);
		gl.frontFace(gl.CCW);
		gl.depthFunc(gl.LEQUAL);

		gl.flush();
		checkWebGLErrors();
	}

	function create3DContext(canvas, enableMSAA) {
		// Portable way to create the WebGL rendering context.
		// Returns null on failure, context object otherwise.
		var params = {
			alpha                 : true,
			depth                 : true,
			stencil               : false,
			antialias             : (enableMSAA ? true : false),
			premultipliedAlpha    : true,
			preserveDrawingBuffer : false
		};
		var wglNames = [ "experimental-webgl", "webgl", "webkit-3d", "moz-webgl" ];
		var context  = null;
		for (var i = 0; i < wglNames.length; ++i) {
			try {
				context = canvas.getContext(wglNames[i], params);
			} catch (ignore) { }
			if (context) {
				break;
			}
		}
		if (!context) {
			jedi.logWarning("'canvas.getContext()' failed for all known ids...");
		} else {
			jedi.logComment("Create WebGL context; msaa=" + enableMSAA);
		}
		return context;
	}

	function initWebGL(webGLCanvasId, screenScales, enableMSAA) {
		var canvas = document.getElementById(webGLCanvasId);
		if (!canvas) {
			jedi.logError("Unable to get the document's canvas element from id '" + webGLCanvasId + "'");
			return false;
		}

		if (screenScales) {
			canvas.width  = window.innerWidth  * screenScales.sw;
			canvas.height = window.innerHeight * screenScales.sh;
		}

		// Try to initialize WebGL.
		// This will fail if the browser doesn't support WebGL or if the feature is disabled.
		// (as it is with some versions of Safari, where WebGL is disabled by default and has to be manually enabled).
		gl = create3DContext(canvas, enableMSAA);
		if (!gl) {
			jedi.logError("Can't create WebGL context! Your browser might not support it or it might be disabled!");
			return false;
		}

		if (canvas.clientWidth === undefined || canvas.clientWidth <= 0) {
			jedi.logError("'canvas.clientWidth' is invalid! " + canvas.clientWidth);
			return false;
		}
		if (canvas.clientHeight === undefined || canvas.clientHeight <= 0) {
			jedi.logError("'canvas.clientHeight' is invalid! " + canvas.clientHeight);
			return false;
		}

		pixelRatio = window.devicePixelRatio ? window.devicePixelRatio : 1;
		screenWidth  = canvas.clientWidth  * pixelRatio;
		screenHeight = canvas.clientHeight * pixelRatio;
		setDefaultWebGLStates();

		jedi.logComment("Screen width:  " + screenWidth);
		jedi.logComment("Screen height: " + screenHeight);
		jedi.logComment("Scale  ratio:  " + pixelRatio);
		jedi.logComment("WebGL initialized!");
		return true;
	}

	/*
	 * Public interface:
	 */
	return {
		init : function (webGLCanvasId, screenScales, enableMSAA) {
			if (gl) {
				jedi.logWarning("Duplicate Renderer initialization!");
				return true;
			}

			jedi.logComment("---- jedi.Renderer.init() ----");

			// Supply default if missing.
			if (!webGLCanvasId) {
				webGLCanvasId = "webgl_canvas";
			}

			if (!initWebGL(webGLCanvasId, screenScales, enableMSAA)) {
				jedi.logError("Failed to initialize WebGL! Aborting Renderer initialization!");
				return false;
			}

			jedi.logComment("Renderer initialization completed.");
			return true;
		},

		drawFullScreenQuadrilateral : function () {
			// VBO only created once.
			if (!screenQuadVbo) {
				var verts = [
					// First triangle
					 1.0,  1.0,
					-1.0,  1.0,
					-1.0, -1.0,
					// Second triangle
					-1.0, -1.0,
					 1.0, -1.0,
					 1.0,  1.0
				];
				screenQuadVbo = gl.createBuffer();
				gl.bindBuffer(gl.ARRAY_BUFFER, screenQuadVbo);
				gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
				jedi.logComment("Created a small VBO for a fullscreen quadrilateral.");
			}

			// Bind & set vertex format:
			gl.bindBuffer(gl.ARRAY_BUFFER, screenQuadVbo);
			gl.enableVertexAttribArray(0);
			gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

			// Draw 6 vertexes => 2 triangles:
			gl.drawArrays(gl.TRIANGLES, 0, 6);

			// Cleanup:
			gl.bindBuffer(gl.ARRAY_BUFFER, null);
		},

		presentFramebufferWithPostEffect : function (shaderProg, framebuffer) {
			jedi.assert(shaderProg,  "Provide a post-fx shader program!");
			jedi.assert(framebuffer, "Provide a framebuffer for the source color!");

			jedi.Framebuffer.bindNull();
			jedi.Renderer.setScreenViewport();
			jedi.Renderer.clearScreen();

			shaderProg.bind();
			framebuffer.bindColorRenderTarget(0);
			jedi.Renderer.drawFullScreenQuadrilateral();
		},

		presentFramebuffer : function (framebuffer) {
			jedi.assert(framebuffer, "Provide a framebuffer for the source color!");

			jedi.Framebuffer.bindNull();
			jedi.Renderer.setScreenViewport();
			jedi.Renderer.clearScreen();

			var shaderProg = jedi.ResourceManager.findShaderProgram("fullscreen_quad");

			shaderProg.bind();
			shaderProg.setUniform1i("u_diffuse_texture", 0);

			framebuffer.bindColorRenderTarget(0);
			jedi.Renderer.drawFullScreenQuadrilateral();
		},

		setScreenViewport : function (x, y, w, h) {
			jedi.assert(gl, "WebGL not initialized!");
			if (!x || x < 0) { x = 0; }
			if (!y || y < 0) { y = 0; }
			if (!w || w < 0) { w = screenWidth  / pixelRatio; }
			if (!h || h < 0) { h = screenHeight / pixelRatio; }
			gl.viewport(x, y, w, h);
		},

		setClearScreenColor : function (rgba) {
			jedi.assert(gl,   "WebGL not initialized!");
			jedi.assert(rgba, "Invalid color parameter!");
			gl.clearColor(rgba[0], rgba[1], rgba[2], rgba[3]);
		},

		clearScreen : function () {
			jedi.assert(gl, "WebGL not initialized!");
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		},

		checkErrors : function () {
			checkWebGLErrors();
		},

		getWebGLContext : function () {
			jedi.assert(gl, "WebGL not initialized!");
			return gl;
		},

		getWebGLRenderMode : function () {
			jedi.assert(gl, "WebGL not initialized!");
			// TODO: This should be replaced by some configuration parameter.
			return gl.TRIANGLES;
		},

		getDefaultWebGLTextureFilter : function (wantsMipmaps) {
			jedi.assert(gl, "WebGL not initialized!");
			// TODO: This should be replaced by some configuration parameter.
			if (wantsMipmaps) {
				return { minFilter : gl.LINEAR_MIPMAP_LINEAR, magFilter : gl.LINEAR };
			} else {
				return { minFilter : gl.LINEAR, magFilter : gl.LINEAR };
			}
		},

		getMvpMatrix : function () {
			return mvpMatrix;
		},

		setMvpMatrix : function (m) {
			mvpMatrix = m;
		},

		getModelMatrix : function () {
			return modelMatrix;
		},

		setModelMatrix : function (m) {
			modelMatrix = m;
			mat4.invert(invModelMatrix, modelMatrix);
		},

		getInvModelMatrix : function () {
			return invModelMatrix;
		},

		setInvModelMatrix : function (m) {
			invModelMatrix = m;
		},

		getEyePosition : function () {
			return eyePos;
		},

		setEyePosition : function (p) {
			eyePos = p;
		},

		/*
		 * Miscellaneous accessors:
		 */
		isInitialized   : function () { return gl !== undefined && gl !== null; },
		getAspect       : function () { return (screenWidth / screenHeight);    },
		getPixelRatio   : function () { return pixelRatio;   },
		getScreenWidth  : function () { return screenWidth;  },
		getScreenHeight : function () { return screenHeight; }
	};
}());
