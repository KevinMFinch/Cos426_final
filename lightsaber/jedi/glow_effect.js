/*
 * ================================================================================================
 * -*- JavaScript -*-
 * File: glow_effect.js
 * Author: Guilherme R. Lampert
 * Created on: 2015-05-06
 * Brief: Multi-pass glow effect, also known as "light bloom".
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
jedi.GlowEffect class:
===========================================================
*/
jedi.GlowEffect = function () {
	this.detail = {
		gl                       : jedi.Renderer.getWebGLContext(),
		shaderProgHorizontalBlur : null, // Applies horizontal Gaussian blur to an image.
		shaderProgVerticalBlur   : null, // Applies vertical Gaussian blur to an image.
		shaderProgGlowCompose    : null, // Composes the final image with glowing objects.
		framebufferScene         : null, // Contains the scene scene before glow is applied.
		framebufferGlowmap       : null, // The "glow map" with all the glowing/emissive objects.
		framebufferBlur          : null, // Scratch framebuffer for intermediated glow map construction.
		framebufferOutput        : null, // Output of the scene+glow. Can then be presented or further processed.
		glowBlendMode            : jedi.GlowEffect.ADDITIVE_BLENDING // How to combine the framebuffers.
	};
};

/*
 * ---- Auxiliary constants: ----
 */

/*
 * Blend modes for the composing of the final image.
 */
jedi.GlowEffect.ADDITIVE_BLENDING  = 1;
jedi.GlowEffect.SCREEN_BLENDING    = 2;
jedi.GlowEffect.DISPLAY_GLOWMAP    = 3;

/*
 * Pass 1: Render the scene to off-screen texture using a standard T&L shaders.
 * Pass 2: Render the glowing objects to a separate texture (generate the glow map).
 * Pass 3: Blur the glow map (depth tests and writes are temporarily disabled).
 * Pass 4: Blend the glow map with the rendered scene from #1 to compose the final image.
 */
jedi.GlowEffect.PASS_STD_RENDER    = 1;
jedi.GlowEffect.PASS_GLOWMAP_GEN   = 2;
jedi.GlowEffect.PASS_GLOWMAP_BLUR  = 3;
jedi.GlowEffect.PASS_COMPOSE_FINAL = 4;

/*
 * ---- Methods of GlowEffect: ----
 */

jedi.GlowEffect.prototype.initWithParams = function (glowMapWidth, glowMapHeight, 
                                                     scrWidth, scrHeight, shaderParams) { // -> bool
	// Optional parameters:
	//
	if (shaderParams && shaderParams.glowBlendMode) {
		jedi.assert(shaderParams.glowBlendMode >= 1 && shaderParams.glowBlendMode <= 3, "Bad 'glowBlendMode' parameter!");
		this.detail.glowBlendMode = shaderParams.glowBlendMode;
	}
	var blurAmount   = (shaderParams && shaderParams.blurAmount)   ? shaderParams.blurAmount   : 10.0;
	var blurScale    = (shaderParams && shaderParams.blurScale)    ? shaderParams.blurScale    : 1.0;
	var blurStrength = (shaderParams && shaderParams.blurStrength) ? shaderParams.blurStrength : 0.3;
	var texelSize    = [(1.0 / glowMapWidth), (1.0 / glowMapHeight)];

	// Init ShaderPrograms:
	//
	this.detail.shaderProgHorizontalBlur = jedi.ResourceManager.findShaderProgram("glowfx_horizontal_blur");
	this.detail.shaderProgVerticalBlur   = jedi.ResourceManager.findShaderProgram("glowfx_vertical_blur");
	this.detail.shaderProgGlowCompose    = jedi.ResourceManager.findShaderProgram("glowfx_compose");

	jedi.assert(this.detail.shaderProgHorizontalBlur, "Preload 'glowfx_horizontal_blur' first!");
	jedi.assert(this.detail.shaderProgVerticalBlur,   "Preload 'glowfx_vertical_blur' first!");
	jedi.assert(this.detail.shaderProgGlowCompose,    "Preload 'glowfx_compose' first!");

	// glowfx_horizontal_blur default parameters:
	this.detail.shaderProgHorizontalBlur.bind();
	this.detail.shaderProgHorizontalBlur.setUniformVec2("u_texel_size",  texelSize);
	this.detail.shaderProgHorizontalBlur.setUniform1f("u_blur_amount",   blurAmount);
	this.detail.shaderProgHorizontalBlur.setUniform1f("u_blur_scale",    blurScale);
	this.detail.shaderProgHorizontalBlur.setUniform1f("u_blur_strength", blurStrength);
	this.detail.shaderProgHorizontalBlur.setUniform1i("u_color_texture", 0);

	// glowfx_vertical_blur default parameters:
	this.detail.shaderProgVerticalBlur.bind();
	this.detail.shaderProgVerticalBlur.setUniformVec2("u_texel_size",  texelSize);
	this.detail.shaderProgVerticalBlur.setUniform1f("u_blur_amount",   blurAmount);
	this.detail.shaderProgVerticalBlur.setUniform1f("u_blur_scale",    blurScale);
	this.detail.shaderProgVerticalBlur.setUniform1f("u_blur_strength", blurStrength);
	this.detail.shaderProgVerticalBlur.setUniform1i("u_color_texture", 0);

	// glowfx_compose default parameters:
	this.detail.shaderProgGlowCompose.bind();
	this.detail.shaderProgGlowCompose.setUniform1f("u_blend_mode", (this.detail.glowBlendMode * 1.0));
	this.detail.shaderProgGlowCompose.setUniform1i("u_scene_texture", 0);
	this.detail.shaderProgGlowCompose.setUniform1i("u_glow_texture",  1);

	jedi.ShaderProgram.bindNull();

	// Init Framebuffers:
	//
	this.detail.framebufferScene = new jedi.Framebuffer("glowfx_scene_framebuffer");
	if (!this.detail.framebufferScene.initWithParams(scrWidth, scrHeight,
		/* depth = */ true, /* stencil = */ false, jedi.TextureFormat.RGBA_U8, jedi.TextureFilter.LINEAR)) {
		return false;
	}

	this.detail.framebufferOutput = new jedi.Framebuffer("glowfx_output_framebuffer");
	if (!this.detail.framebufferOutput.initWithParams(scrWidth, scrHeight,
		/* depth = */ false, /* stencil = */ false, jedi.TextureFormat.RGBA_U8, jedi.TextureFilter.LINEAR)) {
		return false;
	}

	this.detail.framebufferGlowmap = new jedi.Framebuffer("glowfx_glowmap_framebuffer");
	if (!this.detail.framebufferGlowmap.initWithParams(glowMapWidth, glowMapHeight,
		/* depth = */ true, /* stencil = */ false, jedi.TextureFormat.RGBA_U8, jedi.TextureFilter.LINEAR)) {
		return false;
	}

	this.detail.framebufferBlur = new jedi.Framebuffer("glowfx_blur_framebuffer");
	if (!this.detail.framebufferBlur.initWithParams(glowMapWidth, glowMapHeight,
		/* depth = */ false, /* stencil = */ false, jedi.TextureFormat.RGBA_U8, jedi.TextureFilter.LINEAR)) {
		return false;
	}

	return true;
};

jedi.GlowEffect.prototype.dispose = function () { // -> void
	// Dispose ShaderPrograms:
	if (this.detail.shaderProgHorizontalBlur) {
		this.detail.shaderProgHorizontalBlur.dispose();
		this.detail.shaderProgHorizontalBlur = null;
	}
	if (this.detail.shaderProgVerticalBlur) {
		this.detail.shaderProgVerticalBlur.dispose();
		this.detail.shaderProgVerticalBlur = null;
	}
	if (this.detail.shaderProgGlowCompose) {
		this.detail.shaderProgGlowCompose.dispose();
		this.detail.shaderProgGlowCompose = null;
	}

	// Dispose Framebuffers:
	if (this.detail.framebufferScene) {
		this.detail.framebufferScene.dispose();
		this.detail.framebufferScene = null;
	}
	if (this.detail.framebufferOutput) {
		this.detail.framebufferOutput.dispose();
		this.detail.framebufferOutput = null;
	}
	if (this.detail.framebufferGlowmap) {
		this.detail.framebufferGlowmap.dispose();
		this.detail.framebufferGlowmap = null;
	}
	if (this.detail.framebufferBlur) {
		this.detail.framebufferBlur.dispose();
		this.detail.framebufferBlur = null;
	}

	this.detail.glowBlendMode = jedi.GlowEffect.ADDITIVE_BLENDING;
};

jedi.GlowEffect.prototype.doPass = function (passIndex) { // -> void

	switch (passIndex) {
	case jedi.GlowEffect.PASS_STD_RENDER : {
		this.detail.framebufferScene.bind();
		this.detail.framebufferScene.setViewport();
		this.detail.framebufferScene.clear();
		break;
	}
	case jedi.GlowEffect.PASS_GLOWMAP_GEN : {
		this.detail.framebufferGlowmap.bind();
		this.detail.framebufferGlowmap.setViewport();
		this.detail.framebufferGlowmap.clear();
		break;
	}
	case jedi.GlowEffect.PASS_GLOWMAP_BLUR : {
		// Disable depth test and depth writes:
		this.detail.gl.disable(this.detail.gl.DEPTH_TEST);
		this.detail.gl.depthMask(false);
		// Blur the glow map:
		this.blurPassHelper("horizontal");
		this.blurPassHelper("vertical");
		break;
	}
	case jedi.GlowEffect.PASS_COMPOSE_FINAL : {
		// Draw to the output framebuffer.
		this.detail.framebufferOutput.bind();
		this.detail.framebufferOutput.setViewport();
		this.detail.framebufferOutput.clear();
		// Read from the scene framebuffer and glow map.
		this.detail.shaderProgGlowCompose.bind();
		this.detail.framebufferScene.bindColorRenderTarget(0);   // Rendered scene from step 1; tmu:0
		this.detail.framebufferGlowmap.bindColorRenderTarget(1); // Glow map from step 3; tmu:1
		// Render a full screen quad applying the scene+glow:
		jedi.Renderer.drawFullScreenQuadrilateral();
		// Restore depth test and writes changed on the previous stage:
		this.detail.gl.depthMask(true);
		this.detail.gl.enable(this.detail.gl.DEPTH_TEST);
		break;
	}
	default :
		jedi.fatalError("Invalid 'passIndex'!");
	} // switch (passIndex)
};

jedi.GlowEffect.prototype.blurPassHelper = function (orientation) { // -> void
	// This is an internal use method.

	if (orientation === "horizontal") {
		this.detail.framebufferBlur.bind();
		this.detail.framebufferBlur.setViewport();
		this.detail.framebufferBlur.clear("colorOnly");
		this.detail.shaderProgHorizontalBlur.bind();
		this.detail.framebufferGlowmap.bindColorRenderTarget(0);
		jedi.Renderer.drawFullScreenQuadrilateral();
	} else if (orientation === "vertical") {
		this.detail.framebufferGlowmap.bind();
		this.detail.framebufferGlowmap.setViewport();
		this.detail.framebufferGlowmap.clear("colorOnly");
		this.detail.shaderProgVerticalBlur.bind();
		this.detail.framebufferBlur.bindColorRenderTarget(0);
		jedi.Renderer.drawFullScreenQuadrilateral();
	} else {
		jedi.fatalError("Wrong orientation! Must be either 'horizontal' or 'vertical'!");
	}

	// `framebufferGlowmap` now contains the blurred glow map texture.
};

jedi.GlowEffect.prototype.getOutputFramebuffer = function () { // -> jedi.Framebuffer
	return this.detail.framebufferOutput;
};
