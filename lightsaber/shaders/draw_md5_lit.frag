/*
 * ===========================================================
 * GLSL Fragment Shader
 *  This source code is released under the MIT License.
 *  Copyright (c) 2015 Guilherme R. Lampert.
 * ===========================================================
 */

precision mediump float;

// From vertex shader:
varying vec3 v_view_dir_tangent_space;  // Tangent-space view direction.
varying vec3 v_light_dir_tangent_space; // Tangent-space light direction.
varying vec3 v_position_object_space;   // Forwarded vertex position in object coordinates.
varying vec3 v_light_pos_object_space;  // Forwarded light position in object coordinates.
varying vec2 v_texcoords;
varying vec4 v_color;

// Texture samplers:
uniform sampler2D u_diffuse_texture;
uniform sampler2D u_normal_texture;
uniform sampler2D u_specular_texture;

// Light params (TODO should be shader uniforms!):
const float point_light_radius    = 18.0;
const float light_atten_const     = 1.0;
const float light_atten_linear    = 2.0 / point_light_radius;
const float light_atten_quadratic = 1.0 / (point_light_radius * point_light_radius);
const vec4  light_color           = vec4(0.6, 0.6, 0.6, 1.0);

// Material params (TODO should be shader uniforms!):
const float mat_shininess      = 50.0;
const vec4  mat_specular_color = vec4(0.5, 0.5, 0.5, 1.0);
const vec4  mat_diffuse_color  = vec4(1.0, 1.0, 1.0, 1.0);
const vec4  mat_emissive_color = vec4(0.0, 0.0, 0.0, 1.0);
const vec4  mat_ambient_color  = vec4(0.2, 0.2, 0.2, 1.0);

vec3 sampleNormalMap(in vec2 texcoords) {

	return normalize(texture2D(u_normal_texture, texcoords).rgb * 2.0 - 1.0);
}

// Compute point light contribution.
float pointLight(
	in vec3  p,                // Point in space that is to be lit.
	in vec3  light_pos,         // Position  of the light source.
	in float atten_const,       // Constant light attenuation factor.
	in float atten_linear,      // Linear light attenuation factor.
	in float atten_quadratic) { // Quadratic light attenuation factor.

	float d = length(light_pos - p);
	return (1.0 / (atten_const + atten_linear * d + atten_quadratic * (d * d)));
}

// Shades a fragment using the Blinn-Phong light model.
vec4 shade(
	in vec3 N,               // Surface normal.
	in vec3 H,               // Half-vector.
	in vec3 L,               // Light direction vector.
	in float shininess,      // Surface shininess (Phong-power).
	in vec4 specular,        // Surface's specular reflection color, modulated with specular map sample.
	in vec4 diffuse,         // Surface's diffuse  reflection color, modulated with diffuse  map sample.
	in vec4 emissive,        // Surface's emissive contribution. Emission color modulated with an emission map.
	in vec4 ambient,         // Ambient contribution.
	in vec4 light_contrib) { // Light contribution, computed based on light source type.

	float NdotL = max(dot(N, L), 0.0);
	float NdotH = max(dot(N, H), 0.0);
	float spec_contrib = (NdotL > 0.0) ? 1.0 : 0.0;

	vec4 K = emissive + (diffuse * ambient);
	K += light_contrib * (diffuse * NdotL + (specular * pow(NdotH, shininess) * spec_contrib));

	return K;
}

void main() {

	vec4 light_contrib = pointLight(
		v_position_object_space, 
		v_light_pos_object_space,
		light_atten_const, 
		light_atten_linear, 
		light_atten_quadratic) * light_color;

	vec3 V = v_view_dir_tangent_space;
	vec3 L = v_light_dir_tangent_space;
	vec3 H = normalize(L + V);
	vec3 N = sampleNormalMap(v_texcoords);

	gl_FragColor = shade(
		N,
		H,
		L,
		mat_shininess,
		texture2D(u_specular_texture, v_texcoords) * mat_specular_color,
		texture2D(u_diffuse_texture,  v_texcoords) * mat_diffuse_color,
		mat_emissive_color,
		mat_ambient_color,
		light_contrib);

	gl_FragColor *= v_color;
	gl_FragColor.a = 1.0;
}
