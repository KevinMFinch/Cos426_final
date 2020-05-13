/*
 * ===========================================================
 * GLSL Fragment Shader
 *  This source code is released under the MIT License.
 *  Copyright (c) 2015 Guilherme R. Lampert.
 * ===========================================================
 */

precision mediump float;

// Render params:
uniform vec4 u_rp_world_space_eye;
uniform vec4 u_rp_light_color;

// Material params:
uniform vec4 u_mtr_diffuse;
uniform vec4 u_mtr_specular;
uniform vec4 u_mtr_ambient;

// Textures:
uniform sampler2D u_diffuse_texture;

// From vertex shader:
varying vec4 v_position;
varying vec3 v_normal;
varying vec3 v_tangent;
varying vec2 v_texcoords;
varying vec4 v_color;

// These should really be renderer parameters, but since
// we don't need to change 'em often, constants will do for now.
const vec3  WORLD_SPACE_LIGHT_POS = vec3(0.0, 0.0, 1.0);
const float LIGHT_ATTENUATION     = 1.0; // Directional light

// Additional anisotropic-shading surface parameters:
const float ALPHA_X = 1.0;
const float ALPHA_Y = 1.0;

void main() {
	vec3  normal_direction   = normalize(v_normal);
	vec3  tangent_direction  = normalize(v_tangent);

	vec3  view_direction     = normalize(u_rp_world_space_eye.xyz - v_position.xyz);
	vec3  light_direction    = normalize(WORLD_SPACE_LIGHT_POS);

	vec3  halfway_vector     = normalize(light_direction + view_direction);
	vec3  binormal_direction = cross(normal_direction, tangent_direction);

	float dot_ln             = dot(light_direction, normal_direction);
	vec3  ambient_lighting   = vec3(u_mtr_ambient * u_mtr_diffuse);
	vec3  diffuse_reflection = vec3(LIGHT_ATTENUATION * u_rp_light_color * u_mtr_diffuse * max(0.0, dot_ln));

	vec3 specular_reflection;
	if (dot_ln < 0.0) { // Light source on the wrong side?
		specular_reflection = vec3(0.0, 0.0, 0.0); // No specular reflection.
	} else { // Light source on the right side.
		float dot_hn = dot(halfway_vector, normal_direction);
		float dot_vn = dot(view_direction, normal_direction);
		float dot_ht_alpha_x = dot(halfway_vector, tangent_direction)  / ALPHA_X;
		float dot_hb_alpha_y = dot(halfway_vector, binormal_direction) / ALPHA_Y;
		specular_reflection = 
			(LIGHT_ATTENUATION * u_mtr_specular.xyz) * 
			sqrt(max(0.0, dot_ln / dot_vn)) * 
			exp(-2.0 * (dot_ht_alpha_x * dot_ht_alpha_x + 
				dot_hb_alpha_y * dot_hb_alpha_y) / (1.0 + dot_hn));
	}

	vec4 tex_color = texture2D(u_diffuse_texture, v_texcoords);
	gl_FragColor   = tex_color * vec4(ambient_lighting + diffuse_reflection + specular_reflection, 1.0);
}
