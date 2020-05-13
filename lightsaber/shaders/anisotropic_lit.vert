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

// Vertex out:
varying vec4 v_position;
varying vec3 v_normal;
varying vec3 v_tangent;
varying vec2 v_texcoords;
varying vec4 v_color;

// Render params:
uniform mat4 u_rp_mvp_matrix;
uniform mat4 u_rp_model_matrix;
uniform mat4 u_rp_inverse_model_matrix;

void main() {
	vec4 pos4   = vec4(a_position, 1.0);
	vec4 norm4  = vec4(a_normal,   0.0);
	vec4 tang4  = vec4(a_tangent,  0.0);
	v_position  = vec4(u_rp_model_matrix * pos4);
	v_normal    = normalize(vec3(norm4 * u_rp_inverse_model_matrix));
	v_tangent   = normalize(vec3(u_rp_model_matrix * tang4));
	v_texcoords = a_texcoords;
	v_color     = a_color;
	gl_Position = vec4(u_rp_mvp_matrix * pos4);
}
