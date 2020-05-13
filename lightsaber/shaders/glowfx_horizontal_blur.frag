/*
 * ===========================================================
 * GLSL Fragment Shader
 *  This source code is released under the MIT License.
 *  Copyright (c) 2015 Guilherme R. Lampert.
 * ===========================================================
 */

precision mediump float;

uniform vec2  u_texel_size;
uniform float u_blur_amount;
uniform float u_blur_scale;
uniform float u_blur_strength;
uniform sampler2D u_color_texture;

varying vec2 v_texcoords;

const float BLUR_PASSES = 20.0;

float gaussian(float x, float deviation) {
	return (1.0 / sqrt(6.28318530718 * deviation)) * exp(-((x * x) / (2.0 * deviation)));
}

void main() {
	vec4  color     = vec4(0.0);
	float half_blur = u_blur_amount * 0.5;
	float strength  = 1.0 - u_blur_strength;
	float deviation = half_blur * 0.35;
	deviation *= deviation;

	// Horizontal blur:
	for (float i = 0.0; i < BLUR_PASSES; i += 1.0) {
		float offset = i - half_blur;
		vec4 tex_color = texture2D(u_color_texture, v_texcoords +
			vec2(offset * u_texel_size.x * u_blur_scale, 0.0)) * gaussian(offset * strength, deviation);
		color += tex_color;
	}

	gl_FragColor = clamp(color, 0.0, 1.0);
	gl_FragColor.w = 1.0;
}
