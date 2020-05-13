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

// Uniform variables sent from the application:
uniform vec3 u_light_pos_object_space;
uniform vec3 u_eye_pos_object_space;
uniform mat4 u_rp_mvp_matrix;

// Stage outputs:
varying vec3 v_view_dir_tangent_space;  // Tangent-space view direction.
varying vec3 v_light_dir_tangent_space; // Tangent-space light direction.
varying vec3 v_position_object_space;   // Forwarded vertex position in object coordinates.
varying vec3 v_light_pos_object_space;  // Forwarded light position in object coordinates.
varying vec2 v_texcoords;
varying vec4 v_color;

void main() {

	// Transform light direction into tangent-space:
	vec3 light = u_light_pos_object_space - a_position;
	v_light_dir_tangent_space = vec3(
		dot(a_tangent,   light),
		dot(a_bitangent, light),
		dot(a_normal,    light));

	// Transform view direction into tangent-space:
	vec3 view = u_eye_pos_object_space - a_position;
	v_view_dir_tangent_space = vec3(
		dot(a_tangent,   view),
		dot(a_bitangent, view),
		dot(a_normal,    view));

	// Pass vertex position & light position in object space (as is):
	v_position_object_space  = a_position;
	v_light_pos_object_space = u_light_pos_object_space;

	// Pass tex-coords and color as is.
	v_texcoords = a_texcoords;
	v_color     = a_color;

	// Transform position to clip-space for GL:
	gl_Position = vec4(u_rp_mvp_matrix * vec4(a_position, 1.0));
}
