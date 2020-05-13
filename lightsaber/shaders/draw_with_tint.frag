/*
 * ===========================================================
 * GLSL Fragment Shader
 *  This source code is released under the MIT License.
 *  Copyright (c) 2015 Guilherme R. Lampert.
 * ===========================================================
 */

precision mediump float;

uniform vec4 u_mtr_diffuse;

void main() {
	gl_FragColor = u_mtr_diffuse;
}
