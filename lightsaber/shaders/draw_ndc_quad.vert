/*
 * ===========================================================
 * GLSL Vertex Shader
 *  This source code is released under the MIT License.
 *  Copyright (c) 2015 Guilherme R. Lampert.
 * ===========================================================
 */

precision mediump float;

// xy = vertex position in normalized
// device coordinates ([-1,+1] range).
attribute vec2 a_position_ndc;

// Pass UVs to the next stage.
varying vec2 v_texcoords;

void main() {
	const vec2 SCALE = vec2(0.5, 0.5);
	v_texcoords = (a_position_ndc * SCALE) + SCALE; // Scale UVs to [0,1] range.
	gl_Position = vec4(a_position_ndc, 0.0, 1.0);
}
