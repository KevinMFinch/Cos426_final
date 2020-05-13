/*
 * ===========================================================
 * GLSL Vertex Shader
 *  This source code is released under the MIT License.
 *  Copyright (c) 2015 Guilherme R. Lampert.
 * ===========================================================
 */

precision mediump float;

// Vertex in:
attribute vec3 a_position;
attribute vec4 a_color;
attribute vec2 a_texcoords;

// Vertex out:
varying vec2 v_texcoords;
varying vec4 v_color;

// Render params:
uniform mat4 u_rp_mvp_matrix;

void main() {
	v_texcoords = a_texcoords;
	v_color     = a_color;
	gl_Position = vec4(u_rp_mvp_matrix * vec4(a_position, 1.0));
}
