/*
 * ================================================================================================
 * -*- JavaScript -*-
 * File: debug_renderer.js
 * Author: Guilherme R. Lampert
 * Created on: 2015-05-14
 * Brief: Debug line rendering and other visual debugging tools.
 *
 * License:
 *  This source code is released under the MIT License.
 *  Copyright (c) 2015 Guilherme R. Lampert.
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the "Software"), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 *
 * ================================================================================================
 */

"use strict";
if (typeof jedi !== "object") {
	alert("Error: Import/load 'jedi.js' first!");
	throw "Script load error";
}
var jedi = jedi;

/*
===========================================================
jedi.DebugRenderer singleton class:
===========================================================
*/
jedi.DebugRenderer = (function () {

	/*
	 * Private data:
	 */
	var dbgInitialized = false;
	var gl = null;

	// Debug line drawing context:
	var debugLines = {
		lineCount        : 0,
		linesInitialized : false,
		needToUpdateVbos : false,
		positions        : [],
		colors           : [],
		positionsVbo     : null, // WebGL VBO
		colorsVbo        : null, // WebGL VBO
		shaderProgram    : null  // jedi.ShaderProgram
	};

	/*
	 * Internal helpers:
	 */
	function initDebugLines() {
		if (debugLines.linesInitialized) {
			// Silently avoid duplicate initializations.
			return;
		}

		//
		// Debug line rendering vertex shader source code:
		//
		var DEBUG_LINE_VS_SOURCE = "\n"       +
			"precision mediump float;\n"      +
			"attribute vec3 a_position;\n"    +
			"attribute vec3 a_color;\n"       +
			"uniform mat4 u_rp_mvp_matrix;\n" +
			"varying vec3 v_color;\n"         +
			"void main() {\n"                 +
			"    gl_Position = vec4(u_rp_mvp_matrix * vec4(a_position, 1.0));\n" +
			"    v_color     = a_color;\n"    +
			"}\n";

		//
		// Debug line rendering fragment shader source code:
		//
		var DEBUG_LINE_FS_SOURCE = "\n"  +
			"precision mediump float;\n" +
			"varying vec3 v_color;\n"    +
			"void main() {\n"            +
			"    gl_FragColor = vec4(v_color, 1.0);\n" +
			"}\n";

		//
		// Create the VBOs and shader program:
		//
		debugLines.positionsVbo = gl.createBuffer();
		debugLines.colorsVbo    = gl.createBuffer();

		debugLines.shaderProgram = new jedi.ShaderProgram("debug_line_draw");
		var shaderOk = debugLines.shaderProgram.initWithData(DEBUG_LINE_VS_SOURCE, DEBUG_LINE_FS_SOURCE);

		debugLines.linesInitialized = (shaderOk && 
			(debugLines.positionsVbo != null)   && 
			(debugLines.colorsVbo    != null));
	}

	/*
	 * Public interface:
	 */
	return {
		init : function (debugLineDrawing) {
			if (!jedi.Renderer.isInitialized()) {
				jedi.logError("Initialize the Renderer before Initializing DebugRenderer!");
				return false;
			}

			jedi.logComment("---- jedi.DebugRenderer.init() ----");
			gl = jedi.Renderer.getWebGLContext();

			if (debugLineDrawing) {
				initDebugLines();
			}

			jedi.logComment("DebugRenderer initialization completed.");
			return (dbgInitialized = true);
		},

		drawDebugLines : function (mvpMatrix) {
			if (!debugLines.linesInitialized || debugLines.lineCount === 0) {
				return;
			}

			if (!mvpMatrix) {
				mvpMatrix = jedi.Renderer.getMvpMatrix();
			}

			var shaderProgram = debugLines.shaderProgram;

			shaderProgram.bind();
			shaderProgram.setUniformMatrix4x4("u_rp_mvp_matrix", mvpMatrix);

			// Update only when new lines are added.
			if (debugLines.needToUpdateVbos) {
				// DYNAMIC_DRAW: We update once, use a few times, then discard.
				gl.bindBuffer(gl.ARRAY_BUFFER, debugLines.positionsVbo);
				gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(debugLines.positions), gl.DYNAMIC_DRAW);
				gl.bindBuffer(gl.ARRAY_BUFFER, debugLines.colorsVbo);
				gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(debugLines.colors), gl.DYNAMIC_DRAW);
				debugLines.needToUpdateVbos = false;
			}

			gl.bindBuffer(gl.ARRAY_BUFFER, debugLines.positionsVbo);
			gl.enableVertexAttribArray(shaderProgram.getVertexAttribIndex("a_position"));
			gl.vertexAttribPointer(shaderProgram.getVertexAttribIndex("a_position"), 3, gl.FLOAT, false, 0, 0);

			gl.bindBuffer(gl.ARRAY_BUFFER, debugLines.colorsVbo);
			gl.enableVertexAttribArray(shaderProgram.getVertexAttribIndex("a_color"));
			gl.vertexAttribPointer(shaderProgram.getVertexAttribIndex("a_color"), 3, gl.FLOAT, false, 0, 0);

			// Draw (2 vertexes per line):
			gl.drawArrays(gl.LINES, 0, debugLines.lineCount * 2); 

			// Cleanup:
			gl.bindBuffer(gl.ARRAY_BUFFER, null);
		},

		clearDebugLines : function () {
			if (!debugLines.linesInitialized || debugLines.lineCount === 0) {
				return;
			}

			debugLines.needToUpdateVbos = false;
			debugLines.lineCount = 0;
			debugLines.positions = [];
			debugLines.colors    = [];
		},

		addDebugLine : function (from, to, colorRGB) {
			if (!debugLines.linesInitialized) {
				return;
			}

			// Add a new debug line. The line is assumed to be 
			// in world space and is not further transformed.
			// The line lives until the next `clearDebugLines()` call.

			debugLines.positions.push(from[0]);
			debugLines.positions.push(from[1]);
			debugLines.positions.push(from[2]);
			debugLines.positions.push(to[0]);
			debugLines.positions.push(to[1]);
			debugLines.positions.push(to[2]);

			debugLines.colors.push(colorRGB[0]);
			debugLines.colors.push(colorRGB[1]);
			debugLines.colors.push(colorRGB[2]);
			debugLines.colors.push(colorRGB[0]);
			debugLines.colors.push(colorRGB[1]);
			debugLines.colors.push(colorRGB[2]);

			debugLines.needToUpdateVbos = true;
			debugLines.lineCount++;
		},

		/*
		 * Miscellaneous accessors:
		 */
		isInitialized : function () { return dbgInitialized; }
	};
}());
