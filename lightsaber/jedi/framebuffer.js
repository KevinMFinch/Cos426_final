/*
 * ================================================================================================
 * -*- JavaScript -*-
 * File: framebuffer.js
 * Author: Guilherme R. Lampert
 * Created on: 2015-05-05
 * Brief: Off-screen framebuffer/renderbuffer, AKA "Render Target".
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
jedi.Framebuffer class:
===========================================================
*/
jedi.Framebuffer = function (fbName) {
	this.detail = {
		gl                  : jedi.Renderer.getWebGLContext(),
		webGLFbo            : null,                 // WebGL Framebuffer Object handle.
		webGLRtColor        : null,                 // Color texture this framebuffer renders to (GL_COLOR_ATTACHMENT0).
		webGLRtDepth        : null,                 // Depth renderbuffer. Optional.
		webGLRtStencil      : null,                 // Stencil renderbuffer. Optional.
		webGLRtDepthStencil : null,                 // If both depth and stencil buffers are used, this is set instead.
		width               : 0,                    // Width  in pixels of RT textures.
		height              : 0,                    // Height in pixels of RT textures.
		clearColor          : [0.0, 0.0, 0.0, 1.0], // RGBA used to clear the color render target. Defaults to black.
		name                : fbName || "unnamed"   // Optional name/id string used for debugging.
	};
};

/*
 * ---- Methods of Framebuffer: ----
 */

jedi.Framebuffer.prototype.initWithParams = function (width, height, withDepth, withStencil,
                                                      textureFormat, textureFilter, clearColor) { // -> bool

	jedi.assert(width  != undefined && width  > 0, "Provide a framebuffer width  > 0!");
	jedi.assert(height != undefined && height > 0, "Provide a framebuffer height > 0!");

	if (this.detail.webGLFbo) {
		jedi.logWarning("Dispose the current framebuffer object before initializing it again!");
		return true;
	}

	if (textureFormat) {
		// NOTE: We might want to expand this in the future to
		// allow depth texture formats for shadow mapping.
		if (textureFormat !== jedi.TextureFormat.RGB_U8 && textureFormat !== jedi.TextureFormat.RGBA_U8) {
			jedi.logError("RGB/RGBA 8bits are currently the only renderable RT formats supported for framebuffers!");
			return false;
		}
	} else {
		// Default to 8bits RGBA.
		textureFormat = jedi.TextureFormat.RGBA_U8;
	}

	if (!textureFilter) {
		textureFilter = jedi.TextureFilter.NEAREST;
	}

	// Initialize the WebGL FBO and texture attachments:
	this.detail.webGLFbo = this.detail.gl.createFramebuffer();
	if (!this.detail.webGLFbo) {
		jedi.logError("Failed to allocate new WebGL framebuffer object! Possibly out of memory...");
		return false;
	}

	// Color texture (webGLRtColor):
	this.detail.webGLRtColor = this.detail.gl.createTexture();
	if (!this.detail.webGLRtColor) {
		jedi.logError("Failed to allocate new WebGL render target texture! Possibly out of memory...");
		return false;
	}

	if (withDepth && !withStencil) { // Optional depth renderbuffer (webGLRtDepth);
		this.detail.webGLRtDepth = this.detail.gl.createRenderbuffer();
		if (!this.detail.webGLRtDepth) {
			jedi.logError("Failed to allocate new WebGL depth renderbuffer! Possibly out of memory...");
			return false;
		}
	} else if (withStencil && !withDepth) { // Optional stencil renderbuffer (webGLRtStencil):
		this.detail.webGLRtStencil = this.detail.gl.createRenderbuffer();
		if (!this.detail.webGLRtStencil) {
			jedi.logError("Failed to allocate new WebGL stencil renderbuffer! Possibly out of memory...");
			return false;
		}
	} else if (withDepth && withStencil) { // Use both depth AND stencil buffers:
		this.detail.webGLRtDepthStencil = this.detail.gl.createRenderbuffer();
		if (!this.detail.webGLRtDepthStencil) {
			jedi.logError("Failed to allocate new WebGL depth-stencil renderbuffer! Possibly out of memory...");
			return false;
		}
	}

	this.detail.gl.bindFramebuffer(this.detail.gl.FRAMEBUFFER, this.detail.webGLFbo);

	// Set up and attach the color render target texture:
	this.detail.gl.bindTexture(this.detail.gl.TEXTURE_2D, this.detail.webGLRtColor);

	var texImgFilter = jedi.textureFilter2WebGL(textureFilter, /* withMipMaps = */ false);
	this.detail.gl.texParameteri(this.detail.gl.TEXTURE_2D, this.detail.gl.TEXTURE_MIN_FILTER, texImgFilter.minFilter);
	this.detail.gl.texParameteri(this.detail.gl.TEXTURE_2D, this.detail.gl.TEXTURE_MAG_FILTER, texImgFilter.magFilter);
	this.detail.gl.texParameteri(this.detail.gl.TEXTURE_2D, this.detail.gl.TEXTURE_WRAP_S, this.detail.gl.CLAMP_TO_EDGE);
	this.detail.gl.texParameteri(this.detail.gl.TEXTURE_2D, this.detail.gl.TEXTURE_WRAP_T, this.detail.gl.CLAMP_TO_EDGE);

	var texImgInfo = jedi.textureFormat2WebGL(textureFormat);
	this.detail.gl.texImage2D(this.detail.gl.TEXTURE_2D, 0, texImgInfo.internalFormat,
			width, height, 0, texImgInfo.format, texImgInfo.type, null);

	this.detail.gl.framebufferTexture2D(this.detail.gl.FRAMEBUFFER, this.detail.gl.COLOR_ATTACHMENT0,
			this.detail.gl.TEXTURE_2D, this.detail.webGLRtColor, 0);

	// Allocate and attach optional depth buffer (no stencil):
	if (withDepth && !withStencil) {
		this.detail.gl.bindRenderbuffer(this.detail.gl.RENDERBUFFER, this.detail.webGLRtDepth);
		this.detail.gl.renderbufferStorage(this.detail.gl.RENDERBUFFER, this.detail.gl.DEPTH_COMPONENT16, width, height);
		this.detail.gl.framebufferRenderbuffer(this.detail.gl.FRAMEBUFFER, this.detail.gl.DEPTH_ATTACHMENT,
				this.detail.gl.RENDERBUFFER, this.detail.webGLRtDepth);
	} else if (withStencil && !withDepth) {
		// Allocate and attach optional stencil buffer (no depth buffer):
		this.detail.gl.bindRenderbuffer(this.detail.gl.RENDERBUFFER, this.detail.webGLRtStencil);
		this.detail.gl.renderbufferStorage(this.detail.gl.RENDERBUFFER, this.detail.gl.STENCIL_INDEX8, width, height);
		this.detail.gl.framebufferRenderbuffer(this.detail.gl.FRAMEBUFFER, this.detail.gl.STENCIL_ATTACHMENT,
				this.detail.gl.RENDERBUFFER, this.detail.webGLRtStencil);
	} else if (withDepth && withStencil) {
		// Allocate and attach optional depth AND stencil buffers:
		this.detail.gl.bindRenderbuffer(this.detail.gl.RENDERBUFFER, this.detail.webGLRtDepthStencil);
		this.detail.gl.renderbufferStorage(this.detail.gl.RENDERBUFFER, this.detail.gl.DEPTH_STENCIL, width, height);
		this.detail.gl.framebufferRenderbuffer(this.detail.gl.FRAMEBUFFER, this.detail.gl.DEPTH_STENCIL_ATTACHMENT,
				this.detail.gl.RENDERBUFFER, this.detail.webGLRtDepthStencil);
	}

	// Save these for later:
	this.detail.width  = width;
	this.detail.height = height;
	if (clearColor) {
		this.detail.clearColor = clearColor;
	}

	// Extra error checking (prints to the default log).
	jedi.Renderer.checkErrors();
	var fboOK = this.checkStatus();
	if (!fboOK) {
		jedi.logWarning("'Framebuffer.checkStatus()' failed for '" + this.detail.name + "'! View log for more info.");
	}

	// Cleanup:
	this.detail.gl.bindFramebuffer(this.detail.gl.FRAMEBUFFER,   null);
	this.detail.gl.bindRenderbuffer(this.detail.gl.RENDERBUFFER, null);
	this.detail.gl.bindTexture(this.detail.gl.TEXTURE_2D,        null);

	if (!this.isPowerOfTwo()) {
		jedi.logComment("New framebuffer '" + this.detail.name + "' initialized (NOTE: RT size not power-of-two!);" +
			" d=" + withDepth + ", s=" + withStencil + ", " + width + "x" + height + ".");
	} else {
		jedi.logComment("New framebuffer '" + this.detail.name + "' initialized;" +
			" d=" + withDepth + ", s=" + withStencil + ", " + width + "x" + height + ".");
	}

	return fboOK;
};

jedi.Framebuffer.prototype.dispose = function () { // -> void

	// Unbind WebGL handles and delete them:
	//
	if (this.detail.webGLFbo) {
		this.detail.gl.bindFramebuffer(this.detail.gl.FRAMEBUFFER, null);
		this.detail.gl.deleteFramebuffer(this.detail.webGLFbo);
		this.detail.webGLFbo = null;
	}

	if (this.detail.webGLRtColor) {
		this.detail.gl.bindTexture(this.detail.gl.TEXTURE_2D, null);
		this.detail.gl.deleteTexture(this.detail.webGLRtColor);
		this.detail.webGLRtColor = null;
	}

	if (this.detail.webGLRtDepth) {
		this.detail.gl.bindRenderbuffer(this.detail.gl.RENDERBUFFER, null);
		this.detail.gl.deleteRenderbuffer(this.detail.webGLRtDepth);
		this.detail.webGLRtDepth = null;
	}

	if (this.detail.webGLRtStencil) {
		this.detail.gl.bindRenderbuffer(this.detail.gl.RENDERBUFFER, null);
		this.detail.gl.deleteRenderbuffer(this.detail.webGLRtStencil);
		this.detail.webGLRtStencil = null;
	}

	if (this.detail.webGLRtDepthStencil) {
		this.detail.gl.bindRenderbuffer(this.detail.gl.RENDERBUFFER, null);
		this.detail.gl.deleteRenderbuffer(this.detail.webGLRtDepthStencil);
		this.detail.webGLRtDepthStencil = null;
	}

	// Reset the rest of the object states:
	//
	this.detail.width  = 0;
	this.detail.height = 0;
	this.detail.clearColor = [0.0, 0.0, 0.0, 1.0];
	// Leave `this.detail.name` intact.
};

jedi.Framebuffer.prototype.checkStatus = function () {
	jedi.assert(this.isBound(), "'Framebuffer.checkStatus()' requires framebuffer to be active!");

	var fboStats = this.detail.gl.checkFramebufferStatus(this.detail.gl.FRAMEBUFFER);
	if (fboStats !== this.detail.gl.FRAMEBUFFER_COMPLETE) {
		var fboErrors = {};
		fboErrors[this.detail.gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT]         = "GL_FRAMEBUFFER_INCOMPLETE_ATTACHMENT";
		fboErrors[this.detail.gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT] = "GL_FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT";
		fboErrors[this.detail.gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS]         = "GL_FRAMEBUFFER_INCOMPLETE_DIMENSIONS";
		fboErrors[this.detail.gl.FRAMEBUFFER_UNSUPPORTED]                   = "GL_FRAMEBUFFER_UNSUPPORTED";
		jedi.logWarning("Invalid Framebuffer Object! WebGL returned: " + fboErrors[fboStats] + " (0x" + fboStats.toString(16) + ")");
		return false;
	}

	jedi.logComment("Framebuffer status: FRAMEBUFFER_COMPLETE");
	return true;
};

jedi.Framebuffer.prototype.bind = function () { // -> void
	if (this.detail.webGLFbo) {
		this.detail.gl.bindFramebuffer(this.detail.gl.FRAMEBUFFER, this.detail.webGLFbo);
	}
};

jedi.Framebuffer.bindNull = function () { // -> void ['static' method]
	var gl = jedi.Renderer.getWebGLContext();
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
};

jedi.Framebuffer.prototype.isBound = function () { // -> bool
	if (!this.detail.webGLFbo) {
		return false;
	}
	return this.detail.gl.getParameter(this.detail.gl.FRAMEBUFFER_BINDING) === this.detail.webGLFbo;
};

jedi.Framebuffer.prototype.bindColorRenderTarget = function (texUnit) { // -> void
	if (this.detail.webGLRtColor) {
		if (!texUnit || texUnit < 0) {
			texUnit = 0;
		}
		this.detail.gl.activeTexture(this.detail.gl.TEXTURE0 + texUnit);
		this.detail.gl.bindTexture(this.detail.gl.TEXTURE_2D, this.detail.webGLRtColor);
	} else {
		jedi.logError("No color texture render target in framebuffer '" + this.detail.name + "'!");
	}
};

jedi.Framebuffer.prototype.clear = function (param) { // -> void
	jedi.assert(this.isBound(), "'Framebuffer.clear()' requires framebuffer to be active!");

	// Clears the color render target and also the
	// depth & stencil buffers if they are present.
	var glClearFlags = this.detail.gl.COLOR_BUFFER_BIT;

	// Bit of a hackish way, but since strings are so
	// frequently used and cheap in JavaScript...
	if (param !== "colorOnly") {
		if (this.detail.webGLRtDepthStencil) {
			glClearFlags |= (this.detail.gl.DEPTH_BUFFER_BIT | this.detail.gl.STENCIL_BUFFER_BIT);
		} else {
			if (this.detail.webGLRtDepth) {
				glClearFlags |= this.detail.gl.DEPTH_BUFFER_BIT;
			} else if (this.detail.webGLRtStencil) {
				glClearFlags |= this.detail.gl.STENCIL_BUFFER_BIT;
			}
		}
	}

	this.detail.gl.clearColor(this.detail.clearColor[0], this.detail.clearColor[1],
	                          this.detail.clearColor[2], this.detail.clearColor[3]);
	this.detail.gl.clear(glClearFlags);
};

jedi.Framebuffer.prototype.setViewport = function (x, y, w, h) { // -> void
	if (!x || x < 0) { x = 0; }
	if (!y || y < 0) { y = 0; }
	if (!w || w < 0) { w = this.detail.width;  }
	if (!h || h < 0) { h = this.detail.height; }
	this.detail.gl.viewport(x, y, w, h);
};

jedi.Framebuffer.prototype.isPowerOfTwo = function () { // -> bool
	var wPoT = (this.detail.width  > 0) && ((this.detail.width  & (this.detail.width  - 1)) == 0);
	var hPoT = (this.detail.height > 0) && ((this.detail.height & (this.detail.height - 1)) == 0);
	return wPoT && hPoT;
};

jedi.Framebuffer.prototype.getName = function () { // -> String
	return this.detail.name;
};

jedi.Framebuffer.prototype.setName = function (newName) { // -> void
	this.detail.name = newName;
};

jedi.Framebuffer.prototype.getClearColor = function () { // -> Array[4]
	return this.detail.clearColor;
};

jedi.Framebuffer.prototype.setClearColor = function (color) { // -> void
	jedi.assert(color, "Param must not be null/undefined!");
	this.detail.clearColor = color;
};

jedi.Framebuffer.prototype.getWidth = function () { // -> int
	return this.detail.width;
};

jedi.Framebuffer.prototype.getHeight = function () { // -> int
	return this.detail.height;
};

jedi.Framebuffer.prototype.hasColorRenderTarget = function () { // -> bool
	return this.detail.webGLRtColor != null;
};

jedi.Framebuffer.prototype.hasDepthBufferOnly = function () { // -> bool
	return this.detail.webGLRtDepth != null;
};

jedi.Framebuffer.prototype.hasStencilBufferOnly = function () { // -> bool
	return this.detail.webGLRtStencil != null;
};

jedi.Framebuffer.prototype.hasDepthStencilBuffers = function () { // -> bool
	return this.detail.webGLRtDepthStencil != null;
};
