/*
 * ===========================================================
 * GLSL Vertex Shader
 *  This source code is released under the MIT License.
 *  Copyright (c) 2015 Guilherme R. Lampert.
 * ===========================================================
 */

precision mediump float;

// ----------------------------------------------

/*
 * Adapted from code found here:
 *   https://github.com/mattdesl/glsl-fxaa/blob/master/texcoords.glsl
 *
 * To save 9 dependent texture reads, we can compute
 * these in the vertex shader and use the optimized
 * FXAA function in the fragment shader.
 * This is best suited for mobile devices, like iOS.
 */
void fxaaTexCoords(in vec2 frag_coord, in vec2 resolution, 
                   out vec2 v_rgbNW, out vec2 v_rgbNE, 
                   out vec2 v_rgbSW, out vec2 v_rgbSE, 
                   out vec2 v_rgbM) {

	vec2 inverseVP = 1.0 / resolution.xy;
	v_rgbNW = (frag_coord + vec2(-1.0, -1.0)) * inverseVP;
	v_rgbNE = (frag_coord + vec2( 1.0, -1.0)) * inverseVP;
	v_rgbSW = (frag_coord + vec2(-1.0,  1.0)) * inverseVP;
	v_rgbSE = (frag_coord + vec2( 1.0,  1.0)) * inverseVP;
	v_rgbM = vec2(frag_coord * inverseVP);
}

// ----------------------------------------------

varying vec2 v_rgbNW;
varying vec2 v_rgbNE;
varying vec2 v_rgbSW;
varying vec2 v_rgbSE;
varying vec2 v_rgbM;
varying vec2 v_texcoords;

// Resolution (in pixels) of the framebuffer we are rendering to.
uniform vec2 u_fb_resolution_vs;

// xy = vertex position in normalized device coordinates ([-1,+1] range).
attribute vec2 a_position_ndc;

void main() {

	const vec2 SCALE = vec2(0.5, 0.5);
	v_texcoords = (a_position_ndc * SCALE) + SCALE; // Scale UVs to [0,1] range.

	vec2 frag_coord = v_texcoords * u_fb_resolution_vs;
	fxaaTexCoords(frag_coord, u_fb_resolution_vs, v_rgbNW, v_rgbNE, v_rgbSW, v_rgbSE, v_rgbM);

	gl_Position = vec4(a_position_ndc, 0.0, 1.0);
}
