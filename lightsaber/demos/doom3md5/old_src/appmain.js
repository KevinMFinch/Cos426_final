
// ================================================================================================
// -*- JavaScript -*-
// File: AppMain.js
// Author: Guilherme R. Lampert
// Created on: 2014-05-12
// Brief: Main application.
// ================================================================================================

"use strict";

// =============================================
// Application singleton:
// =============================================

//
// app -- General application logic.
//
var app = {

	// ---- Methods: ----

	//
	// Application startup.
	// Called once the page finishes loading.
	//
	init : function(webGLCanvasId) {

		this.createShadowMapRenderTarget(512, 512);
	},

	//
	// Per-frame application update.
	// The place for WebGL rendering and animation update.
	//
	update : function() {

	},

	// ---- Framebuffer / depth texture setup for shadow rendering: ----

	shadowFBO              : null,
	depthTextureExt        : null,
	shadowMapDepthTex      : null,
	shadowMapColorTex      : null,
	drawDepthMapProgram    : null,
	shadowDepthPassProgram : null,

	//
	// Internal helper that sets up the shadow map rendering shader programs.
	//
	setUpShadowMapShaders : function() {

		// drawDepthMapProgram:
		{
			var vertexAttibs = [
				{ name: "vertexPositionNDC", index: 0 }
			];
			this.drawDepthMapProgram = utils.loadProgram(
					utils.loadShader("debugDrawShadowDepthMap-vs"),
					utils.loadShader("debugDrawShadowDepthMap-fs"),
					vertexAttibs, null);
		}

		// shadowDepthPassProgram:
		{
			//TODO
		}
	},

	//
	// Creates a framebuffer render target suitable for shadow map depth rendering.
	// NOTE: If the function fails, depth textures are not available and
	// a fallback path should be used instead.
	//
	createShadowMapRenderTarget : function(w, h) {

		// Shortcut variable:
		var gl = utils.gl;

		// Query the extension (the returned object should be kept to ensure the
		// extension remains enabled during the application lifetime).
		this.depthTextureExt = gl.getExtension("WEBGL_depth_texture");
		if (!this.depthTextureExt)
		{
			utils.warning("Depth texture support doesn't seem to be available! WEBGL_depth_texture not found.");
			return (false);
		}

		// Create a Frame Buffer Object (FBO):
		this.shadowFBO = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFBO);

		// Save width|height for convenience:
		this.shadowFBO.width  = w;
		this.shadowFBO.height = h;

		// Create a normal color texture attached to COLOR_ATTACHMENT0.
		// We will never render to it, but some drivers require it to exist.
		// This is a compatibility adjustment and can be removed if the running
		// platform doesn't require it.
		{
			this.shadowMapColorTex = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, this.shadowMapColorTex);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.shadowFBO.width, this.shadowFBO.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

			// Attach to FBO:
			gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.shadowMapColorTex, 0);
		}

		// Create the shadow map texture, which is a depth texture.
		{
			this.shadowMapDepthTex = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, this.shadowMapDepthTex);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, this.shadowFBO.width, this.shadowFBO.height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);

			// Attach to FBO:
			gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowMapDepthTex, 0);
		}

		// It is a good practice to always check the FBO status after creation:
		var fboStats = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
		if (fboStats != gl.FRAMEBUFFER_COMPLETE)
		{
			var fboErrors = { };
			fboErrors[gl.FRAMEBUFFER_COMPLETE]                      = "GL_FRAMEBUFFER_COMPLETE";
			fboErrors[gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT]         = "GL_FRAMEBUFFER_INCOMPLETE_ATTACHMENT";
			fboErrors[gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT] = "GL_FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT";
			fboErrors[gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS]         = "GL_FRAMEBUFFER_INCOMPLETE_DIMENSIONS";
			fboErrors[gl.FRAMEBUFFER_UNSUPPORTED]                   = "GL_FRAMEBUFFER_UNSUPPORTED";

			utils.warning("Shadow map FBO is invalid! WebGL returned: "
				+ fboErrors[fboStats] + " (0x" + fboStats.toString(16) + ")");

			gl.bindTexture(gl.TEXTURE_2D, null);
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			return (false);
		}
		else
		{
			// Success!
			gl.bindTexture(gl.TEXTURE_2D, null);
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			return (this.setUpShadowMapShaders());
		}
	},

	//
	// Sets the proper states and FBO for shadow rendering.
	//
	beginShadowRendering : function(lightPosWorldSpace) {

		if (!this.shadowFBO)
		{
			utils.warning("Need to call createShadowMapRenderTarget() first!");
			return;
		}

		// Shortcut variable:
		var gl = utils.gl;

		// Bind the framebuffer and set GL states:
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFBO);
		gl.viewport(0, 0, this.shadowFBO.width, this.shadowFBO.height); // Match the viewport to the texture size
		//gl.colorMask(false, false, false, false);                       // Don't write to the color channels at all
		//gl.clear(gl.DEPTH_BUFFER_BIT);                                  // Clear the depth buffer only

		//TEMP
		gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);
	},

	//
	// Back into normal rendering mode.
	//
	endShadowRendering : function() {

		if (!this.shadowFBO)
		{
			utils.warning("Need to call createShadowMapRenderTarget() first!");
			return;
		}

		// Shortcut variable:
		var gl = utils.gl;

		// Unbind the FBO and restore color rendering:
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.colorMask(true, true, true, true);

		// Restore the viewport as well:
		gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
	},

	//
	// Shows the shadow depth map is the lower left corner of the canvas.
	//
	debugDrawShadowDepthMap : function() {

		var gl = utils.gl;
		gl.disable(gl.DEPTH_TEST);

		//var tex = utils.loadedTextures["models/characters/player/playerhead.tga"].glTextureObject;
		//var tex = this.shadowMapColorTex;
		var tex = this.shadowMapDepthTex;

		gl.useProgram(this.drawDepthMapProgram);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.uniform1i(this.drawDepthMapProgram.colorMap, 0);

		utils.drawFullScreenQuad(this.drawDepthMapProgram);

		gl.enable(gl.DEPTH_TEST);
	}
};
