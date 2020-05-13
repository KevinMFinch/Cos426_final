/*
 * ===========================================================
 * GLSL Fragment Shader
 *  This source code is released under the MIT License.
 *  Copyright (c) 2015 Guilherme R. Lampert.
 * ===========================================================
 */

precision mediump float;

uniform float u_blend_mode;
uniform sampler2D u_scene_texture;
uniform sampler2D u_glow_texture;

varying vec2 v_texcoords;

const float ADDITIVE_BLENDING = 1.0;
const float SCREEN_BLENDING   = 2.0;

void main() {

	vec4 dst = texture2D(u_scene_texture, v_texcoords); // Rendered scene (tmu:0)
	vec4 src = texture2D(u_glow_texture,  v_texcoords); // Glow map       (tmu:1)

	if (u_blend_mode == ADDITIVE_BLENDING) {
		// Additive blending (strong result, high overexposure).
		gl_FragColor = min(src + dst, 1.0);
	} else if (u_blend_mode == SCREEN_BLENDING) {
		// Screen blending (mild result, medium overexposure).
		gl_FragColor = clamp((src + dst) - (src * dst), 0.0, 1.0);
	} else {
		// Show the glow map instead (DISPLAY_GLOWMAP).
		gl_FragColor = src;
	}

	gl_FragColor.w = 1.0;
}
