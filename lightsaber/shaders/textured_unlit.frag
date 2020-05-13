/*
 * ===========================================================
 * GLSL Fragment Shader
 *  This source code is released under the MIT License.
 *  Copyright (c) 2015 Guilherme R. Lampert.
 * ===========================================================
 */

precision mediump float;

// From vertex shader:
varying vec2 v_texcoords;
varying vec4 v_color;

// Renderer and material params:
uniform vec4      u_mtr_diffuse;
uniform sampler2D u_diffuse_texture;

void main() {
	gl_FragColor = texture2D(u_diffuse_texture, v_texcoords) * v_color * u_mtr_diffuse;
}
