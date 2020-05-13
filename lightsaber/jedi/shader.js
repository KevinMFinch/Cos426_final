/*
 * ================================================================================================
 * -*- JavaScript -*-
 * File: shader.js
 * Author: Guilherme R. Lampert
 * Created on: 2015-04-27
 * Brief: GPU Shader Program interface.
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
jedi.ShaderProgram class:
===========================================================
*/
jedi.ShaderProgram = function (progName) {
	this.detail = {
		gl              : jedi.Renderer.getWebGLContext(),
		webGLProgramObj : null,                 // WebGLProgram.
		vertexAttribs   : null,                 // Map of indexes for each vertex attribute, keyed by attribute name.
		uniformVars     : null,                 // Map of uniform var locations, keyed by variable name.
		asyncContext    : null,                 // Context for asynchronous loads via `initAsyncFromFile()`.
		name            : progName || "unnamed" // Optional name/id string used for debugging.
	};

	/*
	 * Initialize the default shader program for the first and only time:
	 */
	if (typeof jedi.ShaderProgram.DEFAULT_SHADER_PROG === "undefined") {
		// This will init the program if not created yet.
		jedi.ShaderProgram.getDefault();
	}
};

/*
 * ---- Auxiliary constants: ----
 */

/*
 * Type identifier strings used for shader code defined inside
 * <script> tags, as well as any shader loaded directly from
 * source via `createShaderFromString()`.
 *
 * Note that the "x-shader" type is a user defined value.
 * It could be any arbitrary string that does not conflict
 * with a string expected by the common browsers.
 */
jedi.ShaderProgram.VERTEX_SHADER_TYPEID_STRING   = "x-shader/x-vertex";
jedi.ShaderProgram.FRAGMENT_SHADER_TYPEID_STRING = "x-shader/x-fragment";

/*
 * These regular expressions are used to extract lines from shader
 * source code that start with "uniform" or "attribute", so that
 * we can automatically extract the variable declarations from source code.
 */
jedi.ShaderProgram.REGEXP_PARSE_UNIFORM_VARS   = /^uniform.*$/gm;
jedi.ShaderProgram.REGEXP_PARSE_VERTEX_ATTRIBS = /^attribute.*$/gm;

/*
 * ---- Methods of ShaderProgram: ----
 */

jedi.ShaderProgram.createShaderFromString = function (shaderSource, typeId) { // -> WebGLShader ['static' method]
	jedi.assert(shaderSource, "Invalid shader source code string!");

	var shaderObj, infolog, gl = jedi.Renderer.getWebGLContext();

	// Created WebGL shader object for the correct shader type:
	if (typeId === jedi.ShaderProgram.VERTEX_SHADER_TYPEID_STRING) {
		shaderObj = gl.createShader(gl.VERTEX_SHADER);
	} else if (typeId === jedi.ShaderProgram.FRAGMENT_SHADER_TYPEID_STRING) {
		shaderObj = gl.createShader(gl.FRAGMENT_SHADER);
	} else {
		jedi.logError("Invalid shader type: '" + typeId + "'");
		return null;
	}

	if (!shaderObj) {
		jedi.logError("Failed to allocate new WebGL shader object! Possibly out of memory...");
		return null;
	}

	gl.shaderSource(shaderObj, shaderSource);
	gl.compileShader(shaderObj);
	infolog = gl.getShaderInfoLog(shaderObj);

	if (!gl.getShaderParameter(shaderObj, gl.COMPILE_STATUS)) {
		jedi.logError("Failed to compile shader '" + typeId + "'\n" + "Compiler info log:\n" + infolog);
		jedi.ShaderProgram.disposeShader(shaderObj);
		return null;
	}

	// If we got an info log but COMPILE_STATUS was OK, there might be
	// some warnings and other issues with the code that we should still print.
	if (infolog) {
		jedi.logWarning("Shader compiler info log for '" + typeId + "':\n" + infolog);
		// Allow it to continue.
	}

	// If we get here, the shader should be in a valid state for rendering.
	jedi.Renderer.checkErrors();
	return shaderObj;
};

jedi.ShaderProgram.createShaderFromHtmlElement = function (shaderElementId) { // -> WebGLShader ['static' method]
	jedi.assert(shaderElementId, "Provide a valid HTML element id!");

	// Get shader text source element:
	var shaderScript = document.getElementById(shaderElementId);
	if (!shaderScript) {
		jedi.logError("Unable to find shader element for id '" + shaderElementId + "'!");
		return null;
	}

	// Grab the GLSL source code:
	var shaderSource = "";
	var domNode = shaderScript.firstChild;
	while (domNode) {
		// NOTE: nodeType == 3 indicates a TEXT mode, which is what we want.
		// See http://www.w3schools.com/jsref/prop_node_nodetype.asp
		// for a list of all node types.
		if (domNode.nodeType == 3) {
			shaderSource += domNode.textContent;
		}
		domNode = domNode.nextSibling;
	}

	// Pass on to the function that operates on raw shader source code.
	return jedi.ShaderProgram.createShaderFromString(shaderSource, shaderScript.type);
};

jedi.ShaderProgram.disposeShader = function (shaderObj) { // -> void ['static' method]
	if (shaderObj) {
		var gl = jedi.Renderer.getWebGLContext();
		gl.deleteShader(shaderObj);
		shaderObj = null;
	}
};

jedi.ShaderProgram.prototype.initWithShaders = function (webGLVertexShaderObj, webGLFragmentShaderObj,
                                                         vertexAttributes, uniformVarNames) { // -> bool

	if (!webGLVertexShaderObj) {
		jedi.logError("Null vertex shader for ShaderProgram.initWithShaders('" + this.detail.name + "')!");
		return false;
	}

	if (!webGLFragmentShaderObj) {
		jedi.logError("Null fragment shader for ShaderProgram.initWithShaders('" + this.detail.name + "')!");
		return false;
	}

	if (this.detail.webGLProgramObj) {
		jedi.logWarning("Dispose the current shader program before initializing it again!");
		return true;
	}

	this.detail.webGLProgramObj = this.detail.gl.createProgram();
	if (!this.detail.webGLProgramObj) {
		jedi.logError("Failed to allocate new WebGL program object! Possibly out of memory...");
		return false;
	}

	this.detail.gl.attachShader(this.detail.webGLProgramObj, webGLVertexShaderObj);
	this.detail.gl.attachShader(this.detail.webGLProgramObj, webGLFragmentShaderObj);

	// Bind the vertex attributes, if any.
	// This must happen BEFORE linking the program.
	if (vertexAttributes && vertexAttributes.length != 0) {
		this.detail.vertexAttribs = {};
		for (var i = 0; i < vertexAttributes.length; ++i) {
			this.detail.gl.bindAttribLocation(this.detail.webGLProgramObj,
					vertexAttributes[i].index, vertexAttributes[i].name);

			// Save the attribute indexes inside the this object for use with `gl.vertexAttribPointer()`.
			this.detail.vertexAttribs[vertexAttributes[i].name] = vertexAttributes[i].index;
		}
	}

	// Link the program into a GPU "executable" and check link status:
	this.detail.gl.linkProgram(this.detail.webGLProgramObj);
	if (!this.detail.gl.getProgramParameter(this.detail.webGLProgramObj, this.detail.gl.LINK_STATUS)) {
		jedi.logError("Could not link GLSL shader program for '" + this.detail.name + "'!");
		return false;
	}

	// Query uniform variable locations and store their handles inside this object:
	if (uniformVarNames && uniformVarNames.length != 0) {
		this.detail.gl.useProgram(this.detail.webGLProgramObj);

		this.detail.uniformVars = {};
		for (var i = 0; i < uniformVarNames.length; ++i) {
			var varHandle = this.detail.gl.getUniformLocation(this.detail.webGLProgramObj, uniformVarNames[i]);
			if (!varHandle) {
				jedi.logWarning("Unable to get uniform var '" + uniformVarNames[i] +
					"' location for ShaderProgram '" + this.detail.name + "'!");
				continue;
			}
			this.detail.uniformVars[uniformVarNames[i]] = varHandle;
		}

		this.detail.gl.useProgram(null);
	}

	jedi.Renderer.checkErrors();
	jedi.logComment("New ShaderProgram '" + this.detail.name + "' initialized.");
	return true;
};

jedi.ShaderProgram.prototype.initWithData = function (vertexShaderSource, fragmentShaderSource,
                                                      vertexAttributes, uniformVarNames) { // -> bool

	if (this.detail.webGLProgramObj) {
		jedi.logWarning("Dispose the current program before initializing it again!");
		return true;
	}

	// We can optionally try to extract the variable definitions for the
	// text source. This might fail if text is poorly formatted, but it
	// is quite handy most for the time when loading from shader source files.
	// Vertex Attribute indexes will be automatically numbered from 0 to N.
	//
	if (!vertexAttributes) {
		vertexAttributes = jedi.ShaderProgram.parseVertexAttribsFromSource(vertexShaderSource);
	}
	if (!uniformVarNames) {
		uniformVarNames = jedi.ShaderProgram.parseUniformVarNamesFromSource(vertexShaderSource, fragmentShaderSource);
	}

	var vertexShaderObj = jedi.ShaderProgram.createShaderFromString(
		vertexShaderSource, jedi.ShaderProgram.VERTEX_SHADER_TYPEID_STRING);
	if (!vertexShaderObj) {
		return false;
	}

	var fragmentShaderObj = jedi.ShaderProgram.createShaderFromString(
		fragmentShaderSource, jedi.ShaderProgram.FRAGMENT_SHADER_TYPEID_STRING);
	if (!fragmentShaderObj) {
		return false;
	}

	var result = this.initWithShaders(
			vertexShaderObj, fragmentShaderObj,
			vertexAttributes, uniformVarNames);

	// Once the program is created, shader objects may be disposed.
	jedi.ShaderProgram.disposeShader(vertexShaderObj);
	jedi.ShaderProgram.disposeShader(fragmentShaderObj);

	return result;
};

jedi.ShaderProgram.prototype.initFromHtmlElements = function (vertexShaderElemId, fragmentShaderElemId,
                                                              vertexAttributes, uniformVarNames) { // -> bool

	if (this.detail.webGLProgramObj) {
		jedi.logWarning("Dispose the current program before initializing it again!");
		return true;
	}

	var vertexShaderObj = jedi.ShaderProgram.createShaderFromHtmlElement(vertexShaderElemId);
	if (!vertexShaderObj) {
		return false;
	}

	var fragmentShaderObj = jedi.ShaderProgram.createShaderFromHtmlElement(fragmentShaderElemId);
	if (!fragmentShaderObj) {
		return false;
	}

	var result = this.initWithShaders(
			vertexShaderObj, fragmentShaderObj,
			vertexAttributes, uniformVarNames);

	// Once the program is created, shader objects may be disposed.
	jedi.ShaderProgram.disposeShader(vertexShaderObj);
	jedi.ShaderProgram.disposeShader(fragmentShaderObj);

	return result;
};

jedi.ShaderProgram.prototype.initAsyncFromFile = function (vertexShaderFile, fragmentShaderFile, completionCallback,
                                                           vertexAttributes, uniformVarNames) { // -> bool

	jedi.assert(vertexShaderFile,   "Invalid vertex shader filename!");
	jedi.assert(fragmentShaderFile, "Invalid fragment shader filename!");
	jedi.assert(!this.isLoading(),  "An async load request is already in-flight for '" + this.detail.name + "'!");

	if (this.detail.webGLProgramObj) {
		jedi.logWarning("Dispose the current program before initializing it again!");
		return true;
	}

	// Nested helper function that fires the asynchronous file request.
	//
	var startDownload = function (url, completionHandler) {
		jedi.logComment("Trying to load shader source file '" + url + "' asynchronously...");
		var reqHandler = function () {
			if (this.status == 200 && this.responseText != null) {
				jedi.logComment("Shader source '" + url + "' loaded!");
				completionHandler(this.responseText);
			} else {
				// Something went wrong...
				jedi.logWarning("Failed to load shader source file '" + url + "'. Status: " + this.status);
				completionHandler(null);
			}
		};
		var xmlHttpReq = new XMLHttpRequest();
		xmlHttpReq.onload = reqHandler;
		xmlHttpReq.open(/* method = */ "GET", /* path = */ url, /* async = */ true);
		xmlHttpReq.send();
	};

	// When `asyncContext` is non-null, a file load is in-flight.
	this.detail.asyncContext = {
		vsSource     : null,
		fsSource     : null,
		completionCb : completionCallback
	};
	var shaderProgRef = this;

	// Vertex shader:
	//
	startDownload(vertexShaderFile,
		function (shaderSource) {
			if (shaderSource) {
				shaderProgRef.detail.asyncContext.vsSource = shaderSource;
			} else {
				if (shaderProgRef.detail.asyncContext.completionCb) {
					shaderProgRef.detail.asyncContext.completionCb(null,
						"Failed to load vertex shade source file '" + vertexShaderFile + "'!");
				}
			}
			// When both are set, loading has finished.
			if (shaderProgRef.detail.asyncContext.vsSource && shaderProgRef.detail.asyncContext.fsSource) {
				var success = shaderProgRef.initWithData(shaderProgRef.detail.asyncContext.vsSource,
					shaderProgRef.detail.asyncContext.fsSource, vertexAttributes, uniformVarNames);

				var completionCb = shaderProgRef.detail.asyncContext.completionCb;
				shaderProgRef.detail.asyncContext = null;

				if (completionCb) {
					completionCb((success ? shaderProgRef : null),
						(success ? "Successfully initialized shader program '" + shaderProgRef.getName() + "'" :
							"Failed to initialize shader program '" + shaderProgRef.getName() + "'!"));
				}
			}
		});

	// Fragment shader:
	//
	startDownload(fragmentShaderFile,
		function (shaderSource) {
			if (shaderSource) {
				shaderProgRef.detail.asyncContext.fsSource = shaderSource;
			} else {
				if (shaderProgRef.detail.asyncContext.completionCb) {
					shaderProgRef.detail.asyncContext.completionCb(null,
						"Failed to load fragment shade source file '" + fragmentShaderFile + "'!");
				}
			}
			// When both are set, loading has finished.
			if (shaderProgRef.detail.asyncContext.vsSource && shaderProgRef.detail.asyncContext.fsSource) {
				var success = shaderProgRef.initWithData(shaderProgRef.detail.asyncContext.vsSource,
					shaderProgRef.detail.asyncContext.fsSource, vertexAttributes, uniformVarNames);

				var completionCb = shaderProgRef.detail.asyncContext.completionCb;
				shaderProgRef.detail.asyncContext = null;

				if (completionCb) {
					completionCb((success ? shaderProgRef : null),
						(success ? "Successfully initialized shader program '" + shaderProgRef.getName() + "'" :
							"Failed to initialize shader program '" + shaderProgRef.getName() + "'!"));
				}
			}
		});

	return true; // No way to check errors now, so always succeed.
};

jedi.ShaderProgram.prototype.initDefault = function () { // -> bool
	// This shader will work well with 3D models, but will probably render
	// nothing with other stuff. It outputs unlit fragments colored with
	// a procedural checker pattern like coloring. Should be well suited
	// for debugging when a shader or material fails to load.

	var DEFAULT_VS_SOURCE = "\n" +
		"precision mediump float;\n"        +
		"attribute vec3 a_position;\n"      +
		"attribute vec3 a_normal;\n"        +
		"attribute vec3 a_tangent;\n"       +
		"attribute vec3 a_bitangent;\n"     +
		"attribute vec2 a_texcoords;\n"     +
		"attribute vec4 a_color;\n"         +
		"uniform   mat4 u_rp_mvp_matrix;\n" +
		"varying   vec2 v_texcoords;\n"     +
		"varying   vec4 v_color;\n"         +
		"void main() {\n"                   +
		"    gl_Position = vec4(u_rp_mvp_matrix * vec4(a_position, 1.0));\n" +
		"    v_texcoords = a_texcoords;\n"  +
		"    v_color     = a_color;\n"      +
		"}\n";

	var DEFAULT_FS_SOURCE = "\n" +
		"precision mediump float;\n"  +
		"varying vec2 v_texcoords;\n" +
		"varying vec4 v_color;\n"     +
		"void main() {\n"             +
		"    const float FREQUENCY = 4.0;\n" +
		"    vec2  texc   = mod(floor(v_texcoords * FREQUENCY), 2.0);\n"      +
		"    float delta  = abs(texc.x - texc.y);\n"                          +
		"    gl_FragColor = mix(v_color, vec4(0.2, 0.2, 0.2, 1.0), delta);\n" +
		"}\n";

	this.setName("default");
	var result = this.initWithData(DEFAULT_VS_SOURCE, DEFAULT_FS_SOURCE);

	jedi.logComment("Initialized a default shader program.");
	return result;
};

jedi.ShaderProgram.getDefault = function () { // -> jedi.ShaderProgram
	if (jedi.ShaderProgram.DEFAULT_SHADER_PROG) {
		return jedi.ShaderProgram.DEFAULT_SHADER_PROG;
	}

	// A simple default shader program compatible with the
	// vertex layout of Model3D. Loaded when the first ShaderProgram
	// is created. Draws all objects with a checker pattern texture.
	// Used as fallback if a shader fails to load.

	// Define the property:
	jedi.ShaderProgram.DEFAULT_SHADER_PROG = null;

	// Initialize the object:
	jedi.ShaderProgram.DEFAULT_SHADER_PROG = new jedi.ShaderProgram();
	jedi.ShaderProgram.DEFAULT_SHADER_PROG.initDefault();

	// Freeze it / make it immutable:
	jedi.makeImmutable(jedi.ShaderProgram.DEFAULT_SHADER_PROG);
	return jedi.ShaderProgram.DEFAULT_SHADER_PROG;
};

jedi.ShaderProgram.prototype.dispose = function () { // -> void
	if (this.detail.webGLProgramObj) {
		// Unbind first if needed.
		if (this.detail.gl.getParameter(this.detail.gl.CURRENT_PROGRAM) === this.detail.webGLProgramObj) {
			this.detail.gl.useProgram(null);
		}

		// Delete WebGL handle and reset this object:
		this.detail.gl.deleteProgram(this.detail.webGLProgramObj);
		this.detail.webGLProgramObj = null;
		this.detail.vertexAttribs   = null;
		this.detail.uniformVars     = null;
		this.detail.asyncContext    = null;
		// Leave `this.detail.name` intact.
	}
};

jedi.ShaderProgram.prototype.bind = function () { // -> void
	if (this.detail.webGLProgramObj && !this.isLoading()) {
		this.detail.gl.useProgram(this.detail.webGLProgramObj);
	} else {
		// Invalid program object or still loading. Bind a default.
		jedi.ShaderProgram.DEFAULT_SHADER_PROG.bind();
	}
};

jedi.ShaderProgram.bindNull = function () { // -> void ['static' method]
	var gl = jedi.Renderer.getWebGLContext();
	gl.useProgram(null);
};

jedi.ShaderProgram.prototype.isBound = function () { // -> bool
	if (!this.detail.webGLProgramObj) {
		return false;
	}
	return this.detail.gl.getParameter(this.detail.gl.CURRENT_PROGRAM) === this.detail.webGLProgramObj;
};

jedi.ShaderProgram.prototype.isLoading = function () { // -> bool
	return this.detail.asyncContext != null;
};

jedi.ShaderProgram.prototype.getName = function () { // -> String
	return this.detail.name;
};

jedi.ShaderProgram.prototype.setName = function (newName) { // -> void
	this.detail.name = newName;
};

jedi.ShaderProgram.prototype.getVertexAttribIndex = function (name) { // -> GLenum
	jedi.assert(name, "Invalid vertex attribute name!");

	if (!this.detail.vertexAttribs) {
		jedi.logWarning("No vertex attributes available for shader program '" + this.detail.name + "'!");
		return -1;
	}
	if (!this.detail.vertexAttribs.hasOwnProperty(name)) {
		jedi.logWarning("Undefined vertex attribute '" + name + "' for shader program '" + this.detail.name + "'!");
		return -1;
	}

	return this.detail.vertexAttribs[name];
};

jedi.ShaderProgram.prototype.hasUniformVar = function (varName) { // -> bool
	if (!varName) {
		return false;
	}
	if (!this.detail.webGLProgramObj || !this.detail.uniformVars) {
		return false;
	}
	if (!this.detail.uniformVars.hasOwnProperty(varName)) {
		return false;
	}
	return true;
};

jedi.ShaderProgram.prototype.validateSetUniformParams = function (varName, varValue) { // -> bool
	// This internal helper is used to validate the inputs of the `setUniformX()` methods.

	if (!this.detail.webGLProgramObj || !this.detail.uniformVars) {
		jedi.logWarning("Shader program '" + this.detail.name + "' is invalid or has no uniform vars!");
		return false;
	}

	jedi.assert(varName  !== undefined && varName  !== null, "Invalid uniform var name/id!");
	jedi.assert(varValue !== undefined && varValue !== null, "Invalid uniform var value!");
	jedi.assert(this.detail.gl.getParameter(this.detail.gl.CURRENT_PROGRAM) === this.detail.webGLProgramObj,
			"Bind the shader program '" + this.detail.name + "' first!");

	if (!this.detail.uniformVars.hasOwnProperty(varName)) {
		jedi.logWarning("Uniform var '" + varName + "' not found on program '" + this.detail.name + "'!");
		return false;
	}

	return true;
};

jedi.ShaderProgram.prototype.setUniform1i = function (varName, ival) { // -> bool
	if (!this.validateSetUniformParams(varName, ival)) {
		return false;
	}
	this.detail.gl.uniform1i(this.detail.uniformVars[varName], ival);
	return true;
};

jedi.ShaderProgram.prototype.setUniform1f = function (varName, fval) { // -> bool
	if (!this.validateSetUniformParams(varName, fval)) {
		return false;
	}
	this.detail.gl.uniform1f(this.detail.uniformVars[varName], fval);
	return true;
};

jedi.ShaderProgram.prototype.setUniformVec2 = function (varName, v2) { // -> bool
	if (!this.validateSetUniformParams(varName, v2)) {
		return false;
	}
	this.detail.gl.uniform2fv(this.detail.uniformVars[varName], v2);
	return true;
};

jedi.ShaderProgram.prototype.setUniformVec3 = function (varName, v3) { // -> bool
	if (!this.validateSetUniformParams(varName, v3)) {
		return false;
	}
	this.detail.gl.uniform3fv(this.detail.uniformVars[varName], v3);
	return true;
};

jedi.ShaderProgram.prototype.setUniformVec4 = function (varName, v4) { // -> bool
	if (!this.validateSetUniformParams(varName, v4)) {
		return false;
	}
	this.detail.gl.uniform4fv(this.detail.uniformVars[varName], v4);
	return true;
};

jedi.ShaderProgram.prototype.setUniformMatrix4x4 = function (varName, m4x4) { // -> bool
	if (!this.validateSetUniformParams(varName, m4x4)) {
		return false;
	}
	this.detail.gl.uniformMatrix4fv(this.detail.uniformVars[varName], /* transpose = */ false, m4x4);
	return true;
};

jedi.ShaderProgram.parseVertexAttribsFromSource = function (vertexShaderSource) { // -> Array of Object ['static' method]
	jedi.assert(vertexShaderSource, "Null string!");

	var matchedLines = vertexShaderSource.match(jedi.ShaderProgram.REGEXP_PARSE_VERTEX_ATTRIBS);
	if (!matchedLines) {
		return null;
	}

	var vertexAttribs   = [];
	var nextAttribIndex = 0;

	for (var l = 0; l < matchedLines.length; ++l) {
		var line = matchedLines[l];
		var lastSpaceIdx = line.lastIndexOf(' ');
		if (lastSpaceIdx < 0) {
			jedi.logWarning("Malformed attribute decl in 'parseVertexAttribsFromSource': " + line);
			continue;
		}
		var semicolonIdx = line.indexOf(';');
		if (semicolonIdx < 0) {
			jedi.logWarning("Malformed attribute decl in 'parseVertexAttribsFromSource' (missing semicolon?): " + line);
			continue;
		}
		// Each attribute consists of the variable name and its index.
		vertexAttribs.push({
			name  : line.substring(lastSpaceIdx + 1, semicolonIdx),
			index : nextAttribIndex++ });
	}

	if (vertexAttribs.length == 0) {
		return null;
	}

	// Uncomment for verbose debugging:
	//jedi.logComment("Vertex attributes extracted in 'parseVertexAttribsFromSource()':");
	//for (var v = 0; v < vertexAttribs.length; ++v) {
	//	jedi.logComment("{ name: '" + vertexAttribs[v].name + "', index: " + vertexAttribs[v].index + " }");
	//}

	return vertexAttribs;
};

jedi.ShaderProgram.parseUniformVarNamesFromSource = function (vertexShaderSource, fragmentShaderSource) { // -> Array of String ['static' method]
	jedi.assert(vertexShaderSource,   "Null string!");
	jedi.assert(fragmentShaderSource, "Null string!");

	// NOTE: Currently, the variable declaration MUST be followed by
	// a new line. DO NOT add comments after the variable declaration.
	// It will fail to find the last white space if you do so!
	//
	var combinedSources = vertexShaderSource + fragmentShaderSource;
	var matchedLines = combinedSources.match(jedi.ShaderProgram.REGEXP_PARSE_UNIFORM_VARS);
	if (!matchedLines) {
		return null;
	}

	var uniformVars = [];
	for (var l = 0; l < matchedLines.length; ++l) {
		var line = matchedLines[l];
		var lastSpaceIdx = line.lastIndexOf(' ');
		if (lastSpaceIdx < 0) {
			jedi.logWarning("Malformed uniform var decl in 'parseUniformVarNamesFromSource': " + line);
			continue;
		}
		var semicolonIdx = line.indexOf(';');
		if (semicolonIdx < 0) {
			jedi.logWarning("Malformed uniform var decl in 'parseUniformVarNamesFromSource' (missing semicolon?): " + line);
			continue;
		}
		uniformVars.push(line.substring(lastSpaceIdx + 1, semicolonIdx));
	}

	if (uniformVars.length == 0) {
		return null;
	}

	// Uncomment for verbose debugging:
	//jedi.logComment("Uniform vars extracted in 'parseUniformVarNamesFromSource()':");
	//for (var v = 0; v < uniformVars.length; ++v) {
	//	jedi.logComment("uniformVars[" + v + "] = '" + uniformVars[v] + "'");
	//}

	return uniformVars;
};
