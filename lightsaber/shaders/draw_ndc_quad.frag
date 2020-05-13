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

// TMU=0
uniform sampler2D u_diffuse_texture;

void main() {
	gl_FragColor = texture2D(u_diffuse_texture, v_texcoords);
}
