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
attribute vec3 a_normal;
attribute vec3 a_tangent;
attribute vec3 a_bitangent;
attribute vec2 a_texcoords;
attribute vec4 a_color;

// Render params:
uniform mat4 u_rp_mvp_matrix;

void main() {
	gl_Position = vec4(u_rp_mvp_matrix * vec4(a_position, 1.0));
}
