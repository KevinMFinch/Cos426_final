/*
 * ================================================================================================
 * -*- JavaScript -*-
 * File: material.js
 * Author: Guilherme R. Lampert
 * Created on: 2015-05-12
 * Brief: Material for surface shading description.
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
jedi.Material class:
===========================================================
*/
jedi.Material = function (matName) {
	this.detail = {
		// Color properties:
		diffuseColor    : [1.0, 1.0, 1.0, 1.0], // white
		specularColor   : [0.5, 0.5, 0.5, 1.0], // gray 
		ambientColor    : [0.0, 0.0, 0.0, 1.0], // black
		shininess       : 1.0,
		// Texture maps (Texture instances):
		diffuseTexture  : null,
		specularTexture : null,
		normalTexure    : null,
		// Shader program tailored for this material:
		shaderProgram   : null,
		// Optional unique name or id:
		name            : matName || "unnamed"
	};

	/*
	 * Initialize the default material for the first and only time:
	 */
	if (typeof jedi.Material.DEFAULT_MATERIAL === "undefined") {
		// This will init the Material if not created yet.
		jedi.Material.getDefault();
	}
};

/*
 * ---- Auxiliary constants: ----
 */

jedi.Material.DIFFUSE_MAP_TMU  = 0;
jedi.Material.SPECULAR_MAP_TMU = 1;
jedi.Material.NORMAL_MAP_TMU   = 2;

/*
 * ---- Methods of Material: ----
 */

jedi.Material.prototype.initDefault = function () { // -> bool

	// This is another possible default setup for Material,
	// with a white diffuse texture and "null" normal and specular maps.
	// Default shader applies the white texture with no lighting.
	//
	//this.detail.shaderProgram   = jedi.ResourceManager.findShaderProgram("textured_unlit");
	//this.detail.diffuseTexture  = jedi.ResourceManager.findTexture("misc/white.jpg");
	//this.detail.specularTexture = jedi.ResourceManager.findTexture("misc/white_s.jpg");
	//this.detail.normalTexure    = jedi.ResourceManager.findTexture("misc/white_local.jpg");

	this.detail.shaderProgram = jedi.ShaderProgram.getDefault();
	this.detail.name = "default";

	jedi.logComment("Initialized a default material.");
	return true;
};

jedi.Material.getDefault = function () { // -> jedi.Material
	if (jedi.Material.DEFAULT_MATERIAL) {
		return jedi.Material.DEFAULT_MATERIAL;
	}

	// Define the property:
	jedi.Material.DEFAULT_MATERIAL = null;

	// Initialize the object:
	jedi.Material.DEFAULT_MATERIAL = new jedi.Material();
	jedi.Material.DEFAULT_MATERIAL.initDefault();

	// Freeze it / make it immutable:
	jedi.makeImmutable(jedi.Material.DEFAULT_MATERIAL);
	return jedi.Material.DEFAULT_MATERIAL;
};

jedi.Material.prototype.apply = function () { // -> void
	if (!this.detail.shaderProgram) {
		jedi.logWarning("Material '" + this.detail.name + "' has no shader program! Setting a default.");
		this.detail.shaderProgram = jedi.ShaderProgram.getDefault();
	}

	// Bind textures:
	//
	if (this.detail.diffuseTexture) {
		this.detail.diffuseTexture.bind(jedi.Material.DIFFUSE_MAP_TMU); // u_diffuse_texture
	}
	if (this.detail.specularTexture) {
		this.detail.specularTexture.bind(jedi.Material.SPECULAR_MAP_TMU); // u_specular_texture
	}
	if (this.detail.normalTexure) {
		this.detail.normalTexure.bind(jedi.Material.NORMAL_MAP_TMU); // u_normal_texture
	}

	// Bind shader and set available uniform vars:
	//
	var shader = this.detail.shaderProgram;
	shader.bind();

	// Set TMUs:
	if (shader.hasUniformVar("u_diffuse_texture")) {
		shader.setUniform1i("u_diffuse_texture", jedi.Material.DIFFUSE_MAP_TMU);
	}
	if (shader.hasUniformVar("u_specular_texture")) {
		shader.setUniform1i("u_specular_texture", jedi.Material.SPECULAR_MAP_TMU);
	}
	if (shader.hasUniformVar("u_normal_texture")) {
		shader.setUniform1i("u_normal_texture", jedi.Material.NORMAL_MAP_TMU);
	}

	// "mtr" is a material parameter.
	if (shader.hasUniformVar("u_mtr_diffuse")) {
		shader.setUniformVec4("u_mtr_diffuse", this.detail.diffuseColor);
	}
	if (shader.hasUniformVar("u_mtr_specular")) {
		shader.setUniformVec4("u_mtr_specular", this.detail.specularColor);
	}
	if (shader.hasUniformVar("u_mtr_ambient")) {
		shader.setUniformVec4("u_mtr_ambient", this.detail.ambientColor);
	}
	if (shader.hasUniformVar("u_mtr_shininess")) {
		shader.setUniform1f("u_mtr_shininess", this.detail.shininess);
	}

	// "rp" is a renderer parameter.
	if (shader.hasUniformVar("u_rp_mvp_matrix")) {
		shader.setUniformMatrix4x4("u_rp_mvp_matrix", jedi.Renderer.getMvpMatrix());
	}
	if (shader.hasUniformVar("u_rp_model_matrix")) {
		shader.setUniformMatrix4x4("u_rp_model_matrix", jedi.Renderer.getModelMatrix());
	}
	if (shader.hasUniformVar("u_rp_inverse_model_matrix")) {
		shader.setUniformMatrix4x4("u_rp_inverse_model_matrix", jedi.Renderer.getInvModelMatrix());
	}
	if (shader.hasUniformVar("u_rp_world_space_eye")) {
		shader.setUniformVec4("u_rp_world_space_eye", jedi.Renderer.getEyePosition());
	}
};

jedi.Material.prototype.dispose = function () { // -> void
	this.detail.diffuseTexture  = null;
	this.detail.specularTexture = null;
	this.detail.normalTexure    = null;
	this.detail.shaderProgram   = null;
};

jedi.Material.prototype.getAmbientColor = function () { // -> Array[4]
	return this.detail.ambientColor;
};

jedi.Material.prototype.setAmbientColor = function (c) { // -> void
	this.detail.ambientColor = c;
};

jedi.Material.prototype.getDiffuseColor = function () { // -> Array[4]
	return this.detail.diffuseColor;
};

jedi.Material.prototype.setDiffuseColor = function (c) { // -> void
	this.detail.diffuseColor = c;
};

jedi.Material.prototype.getSpecularColor = function () { // -> Array[4]
	return this.detail.specularColor;
};

jedi.Material.prototype.setSpecularColor = function (c) { // -> void
	this.detail.specularColor = c;
};

jedi.Material.prototype.getDiffuseTexture = function () { // -> jedi.Texture
	return this.detail.diffuseTexture;
};

jedi.Material.prototype.setDiffuseTexture = function (tex) { // -> void
	this.detail.diffuseTexture = tex;
};

jedi.Material.prototype.getSpecularTexture = function () { // -> jedi.Texture
	return this.detail.specularTexture;
};

jedi.Material.prototype.setSpecularTexture = function (tex) { // -> void
	this.detail.specularTexture = tex;
};

jedi.Material.prototype.getNormalTexture = function () { // -> jedi.Texture
	return this.detail.normalTexure;
};

jedi.Material.prototype.setNormalTexture = function (tex) { // -> void
	this.detail.normalTexure = tex;
};

jedi.Material.prototype.getShininess = function () { // -> float
	return this.detail.shininess;
};

jedi.Material.prototype.setShininess = function (s) { // -> void
	this.detail.shininess = s;
};

jedi.Material.prototype.getShaderProgram = function () { // -> jedi.ShaderProgram
	return this.detail.shaderProgram;
};

jedi.Material.prototype.setShaderProgram = function (sp) { // -> void
	this.detail.shaderProgram = sp;
};

jedi.Material.prototype.getName = function () { // -> String
	return this.detail.name;
};

jedi.Material.prototype.setName = function (newName) { // -> void
	this.detail.name = newName;
};

jedi.Material.loadMaterialLibAsync = function (url, completionCallback) { // -> bool ['static' method]
	jedi.assert(url, "Invalid filename/URL!");

	// This callback process the download once finished.
	var parseMtl = function (fileContents) {
		if (!fileContents) {
			if (completionCallback) {
				completionCallback(null, "Failed to load material library from file '" + url + "'!");
			}
			return;
		}

		// Split a string/line by white spaces, returning an array of substrings.
		var splitBySpaces = function (line) {
			return line.match(/\S+/g);
		};

		// File loaded successfully, now process it:
		var mat = null;
		var newMaterials = [];
		var l, line, lines, tmp, r, g, b;

		// Split the input by lines:
		lines = fileContents.split('\n');

		// Parse each line...
		for (l = 0; l < lines.length; ++l) {
			line = lines[l].trim();

			if (line.indexOf("newmtl ") >= 0) { // Start new material
				if (mat) {
					newMaterials.push(mat);
				}
				mat = new jedi.Material(line.substr(6).trim());
			} else if (line.indexOf("map_Kd ") >= 0) { // Diffuse texture map
				if (mat) {
					tmp = line.substr(6).trim();
					mat.setDiffuseTexture(tmp);
				}
			} else if (line.indexOf("map_Ks ") >= 0) { // Specular texture map
				if (mat) {
					tmp = line.substr(6).trim();
					mat.setSpecularTexture(tmp);
				}
			} else if (line.indexOf("map_bump ") >= 0) { // Normal/bump texture map
				if (mat) {
					tmp = line.substr(8).trim();
					mat.setNormalTexture(tmp);
				}
			} else if (line.indexOf("Ns ") >= 0) { // Material "shininess"
				if (mat) {
					tmp = parseFloat(line.substr(2));
					mat.setShininess(tmp);
				}
			} else if (line.indexOf("Ka ") >= 0) { // Ambient color value (RGB)
				tmp = splitBySpaces(line); // `tmp[0]` should be "Ka"
				if (mat && tmp[0] == "Ka") {
					r = parseFloat(tmp[1]);
					g = parseFloat(tmp[2]);
					b = parseFloat(tmp[3]);
					mat.setAmbientColor([r, g, b, 1.0]);
				}
			} else if (line.indexOf("Kd ") >= 0) { // Diffuse color value (RGB)
				tmp = splitBySpaces(line); // `tmp[0]` should be "Kd"
				if (mat && tmp[0] == "Kd") {
					r = parseFloat(tmp[1]);
					g = parseFloat(tmp[2]);
					b = parseFloat(tmp[3]);
					mat.setDiffuseColor([r, g, b, 1.0]);
				}
			} else if (line.indexOf("Ks ") >= 0) { // Specular color value (RGB)
				tmp = splitBySpaces(line); // `tmp[0]` should be "Ks"
				if (mat && tmp[0] == "Ks") {
					r = parseFloat(tmp[1]);
					g = parseFloat(tmp[2]);
					b = parseFloat(tmp[3]);
					mat.setSpecularColor([r, g, b, 1.0]);
				}
			} else if (line.indexOf("shader_prog ") >= 0) { // ShaderProgram (my own extension for the MTL format)
				if (mat) {
					tmp = line.substr(11).trim();
					mat.setShaderProgram(tmp);	
				}
			} else {
				// Unhandled parameter.
			}
		}

		// Last one must be inserted manually.
		if (mat) {
			newMaterials.push(mat);
		}

		if (completionCallback) {
			completionCallback(newMaterials, 
				"Finished loading and parsing material library '" + url + "'!");
		}
	};

	// Fire the asynchronous download:
	jedi.logComment("Trying to load material lib file '" + url + "' asynchronously...");
	var reqHandler = function () {
		if (this.status == 200 && this.responseText != null) {
			jedi.logComment("Material lib file '" + url + "' loaded!");
			parseMtl(this.responseText);
		} else {
			// Something went wrong...
			jedi.logWarning("Failed to load material lib file '" + url + "'. Status: " + this.status);
			parseMtl(null);
		}
	};
	var xmlHttpReq = new XMLHttpRequest();
	xmlHttpReq.onload = reqHandler;
	xmlHttpReq.open(/* method = */ "GET", /* path = */ url, /* async = */ true);
	xmlHttpReq.send();

	return true;
};
