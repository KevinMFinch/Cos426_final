/*
 * ================================================================================================
 * -*- JavaScript -*-
 * File: model3d.js
 * Author: Guilherme R. Lampert
 * Created on: 2015-04-29
 * Brief: Object wrapper for a 3D model and related helpers.
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
jedi.ModelStorageHint enum:
===========================================================
*/
jedi.ModelStorageHint = jedi.makeImmutable({
	STATIC  : 1, // Model initialized once and never changed.
	DYNAMIC : 2, // Model updated often (once per frame or less).
	STREAM  : 3  // Model updated very often (mode than once per frame).
});

/*
===========================================================
jedi.Mesh3D class:
===========================================================
*/
jedi.Mesh3D = function (firstVert, vertCount, firstIdx, idxCount, material, meshName) {
	// First index in its parent Vertex Buffer
	// and number of vertexes this mesh uses.
	this.firstVertex = firstVert || 0;
	this.vertexCount = vertCount || 0;

	// First index in its parent Index Buffer
	// and number of indexes this mesh uses.
	this.firstIndex  = firstIdx  || 0;
	this.indexCount  = idxCount  || 0;

	// Mesh surface material. May be null.
	this.material = material || jedi.Material.getDefault();

	// Optional name or id for this mesh.
	this.name = meshName || "unnamed";
};

/*
 * ---- Methods of Mesh3D: ----
 */

jedi.Mesh3D.prototype.indexRangeValid = function () { // -> bool
	return (this.firstIndex >= 0) && (this.indexCount > 0);
};

jedi.Mesh3D.prototype.vertexRangeValid = function () { // -> bool
	return (this.firstVertex >= 0) && (this.vertexCount > 0);
};

jedi.Mesh3D.prototype.hasMaterial = function () { // -> bool
	return this.material != null;
};

/*
===========================================================
jedi.Model3D class:
===========================================================
*/
jedi.Model3D = function (modelName) {
	this.detail = {
		gl               : jedi.Renderer.getWebGLContext(),
		glBufferUsage    : 0,                     // gl.STATIC_DRAW, gl.DYNAMIC_DRAW, gl.STREAM_DRAW.
		webGLVbo         : null,                  // WebGL Vertex Buffer Object.
		webGLIbo         : null,                  // WebGL Index  Buffer Object.
		vertexes         : null,                  // Interleaved array of model vertexes [pos, norm, tan, btan, uv, color].
		indexes          : null,                  // Array of integer indexes to the model triangles (only 16bit indexes supported!).
		meshes           : null,                  // Array of sub-meshes (Mesh3D). At least 1 for a valid model.
		asyncLoadPending : false,                 // Only set if loading a model with `initAsyncFromFile()`.
		name             : modelName || "unnamed" // Filename that originated the model or some other unique id.
	};

	/*
	 * Initialize the default model for the first and only time:
	 */
	if (typeof jedi.Model3D.DEFAULT_3D_MODEL === "undefined") {
		// This will init the model if not created yet.
		jedi.Model3D.getDefault();
	}
};

/*
 * ---- Auxiliary constants: ----
 */

/*
 * Number of floats a model "vertex" takes. Each vertex
 * can be thought of as the following (unpadded) C-style structure:
 *
 * struct Vertex {
 *     float[3] position;
 *     float[3] normal;
 *     float[3] tangent;
 *     float[3] bitangent;
 *     float[2] texcoords;
 *     float[4] color;
 * };
 *
 * Side note:
 *  Model primitives are ALWAYS triangles!
 */
jedi.Model3D.ELEMENTS_PER_VERTEX = 3 + 3 + 3 + 3 + 2 + 4;

/*
 * Size <<in bytes>> of each vertex, assuming a float is 4 bytes (Float32s).
 */
jedi.Model3D.VERTEX_SIZE_BYTES = (3 * 4) + (3 * 4) + (3 * 4) + (3 * 4) + (2 * 4) + (4 * 4);

/*
 * Vertex attribute index constants for all models and shader programs.
 * Make sure to use these when creating a ShaderProgram!
 */
jedi.Model3D.ATTRIB_INDEX_POSITION  = 0;
jedi.Model3D.ATTRIB_INDEX_NORMAL    = 1;
jedi.Model3D.ATTRIB_INDEX_TANGENT   = 2;
jedi.Model3D.ATTRIB_INDEX_BITANGENT = 3;
jedi.Model3D.ATTRIB_INDEX_TEXCOORDS = 4;
jedi.Model3D.ATTRIB_INDEX_COLOR     = 5;

/*
 * Offsets in bytes to each element of a Model3D vertex.
 * These are used with `gl.vertexAttribPointer()`.
 */
jedi.Model3D.VERT_OFFSET_POSITION  = 0;
jedi.Model3D.VERT_OFFSET_NORMAL    = (3 * 4);
jedi.Model3D.VERT_OFFSET_TANGENT   = (3 * 4) + (3 * 4);
jedi.Model3D.VERT_OFFSET_BITANGENT = (3 * 4) + (3 * 4) + (3 * 4);
jedi.Model3D.VERT_OFFSET_TEXCOORDS = (3 * 4) + (3 * 4) + (3 * 4) + (3 * 4);
jedi.Model3D.VERT_OFFSET_COLOR     = (3 * 4) + (3 * 4) + (3 * 4) + (3 * 4) + (2 * 4);

/*
 * ---- Methods of Model3D: ----
 */

jedi.Model3D.prototype.initWithData = function (vertexArray, indexArray, meshArray,
                                                deriveTangents, modelName, storageHint) { // -> bool

	// Must have a set of vertexes and at least one valid mesh.
	jedi.assert(vertexArray && (vertexArray instanceof Float32Array) && (vertexArray.length > 0),
			"Model vertexes must be stored in a Float32Array!");
	jedi.assert(meshArray && (meshArray instanceof Array) && (meshArray.length > 0),
			"Provide an array with at least 1 Mesh3D!");

	// An index buffer is optional, but if provided, must be an array of uint16s.
	var indexed = false;
	if (indexArray) {
		jedi.assert((indexArray instanceof Uint16Array) && (indexArray.length > 0),
				"Model indexes must be stored in a Uint16Array!");
		indexed = true;
	}

	// Avoid a duplicate initialization!
	if (this.detail.webGLVbo || this.detail.webGLIbo) {
		jedi.logWarning("Dispose the current model before initializing it again!");
		return true;
	}

	this.detail.webGLVbo = this.detail.gl.createBuffer();
	if (!this.detail.webGLVbo) {
		jedi.logError("Failed to allocate new WebGL VBO! Possibly out of memory...");
		return false;
	}

	// Optional.
	if (indexed) {
		this.detail.webGLIbo = this.detail.gl.createBuffer();
		if (!this.detail.webGLIbo) {
			jedi.logError("Failed to allocate new WebGL IBO! Possibly out of memory...");
			return false;
		}
	}

	this.detail.indexes  = (indexed ? indexArray : null);
	this.detail.vertexes = vertexArray;
	this.detail.meshes   = meshArray;

	if (modelName) {
		this.detail.name = modelName;
	}

	switch (storageHint) {
	case jedi.ModelStorageHint.STATIC :
		this.detail.glBufferUsage = this.detail.gl.STATIC_DRAW;
		break;
	case jedi.ModelStorageHint.DYNAMIC :
		this.detail.glBufferUsage = this.detail.gl.DYNAMIC_DRAW;
		break;
	case jedi.ModelStorageHint.STREAM :
		this.detail.glBufferUsage = this.detail.gl.STREAM_DRAW;
		break;
	default : // `storageHint` is optional. Defaults to STATIC if omitted.
		this.detail.glBufferUsage = this.detail.gl.STATIC_DRAW;
		break;
	} // switch (storageHint)

	if (deriveTangents) {
		this.deriveNormalsAndTangents();
	}

	this.updateGpuBuffers();
	jedi.Renderer.checkErrors();
	return true;
};

jedi.Model3D.prototype.initAsyncFromFile = function (filename, completionCallback,
                                                     deriveTangents, modelName, storageHint) { // -> bool

	jedi.assert(filename, "Invalid model filename!");
	var fileFormatExt = jedi.Model3D.isValidModel3DFileFormat(filename);
	if (!fileFormatExt) {
		jedi.logError("3D mode file '" + filename + "' format is unknown or loading is not fully implemented!");
		return false;
	}

	// Nested helper function that fires the asynchronous file request.
	//
	var startDownload = function (url, completionHandler) {
		jedi.logComment("Trying to load 3D model file '" + url + "' asynchronously...");
		var reqHandler = function () {
			if (this.status == 200 && this.responseText != null) {
				jedi.logComment("3D model file data '" + url + "' loaded!");
				completionHandler(this.responseText);
			} else {
				// Something went wrong...
				jedi.logWarning("Failed to load 3D model file '" + url + "'. Status: " + this.status);
				completionHandler(null);
			}
		};
		var xmlHttpReq = new XMLHttpRequest();
		xmlHttpReq.onload = reqHandler;
		xmlHttpReq.open(/* method = */ "GET", /* path = */ url, /* async = */ true);
		xmlHttpReq.send();
	};

	var modelRef = this;
	modelRef.detail.asyncLoadPending = true;

	// Get the file contents:
	//
	startDownload(filename,
		function (modelFileContents) {
			if (!modelFileContents) {
				modelRef.detail.asyncLoadPending = false;
				if (completionCallback) {
					completionCallback(null,
						"Failed to load 3D model file data for '" + filename + "'!");
				}
				return;
			}
			// Successfully got the file data. Process it.
			var importer = jedi.Model3D.getImporterForFormat(fileFormatExt);
			if (importer(modelRef, modelFileContents, deriveTangents, modelName || modelRef.getName(), storageHint)) {
				modelRef.detail.asyncLoadPending = false;
				if (completionCallback) {
					completionCallback(modelRef,
						"Successfully import 3D model '" + modelRef.getName() + "'!");
				}
			} else {
				modelRef.detail.asyncLoadPending = false;
				if (completionCallback) {
					completionCallback(null,
						"Failed to import 3D model '" + filename + "'!");
				}
			}
		});

	return true; // No way to check errors now, so always succeed.
};

jedi.Model3D.getDefault = function () { // -> jedi.Model3D
	if (jedi.Model3D.DEFAULT_3D_MODEL) {
		return jedi.Model3D.DEFAULT_3D_MODEL;
	}

	// Define the property:
	jedi.Model3D.DEFAULT_3D_MODEL = null;

	// Initialize the default model (a unit cube):
	jedi.Model3D.DEFAULT_3D_MODEL = jedi.Model3D.createBoxShape(
		1.0, 1.0, 1.0, [1.0, 1.0, 1.0, 1.0], true, "default");

	return jedi.Model3D.DEFAULT_3D_MODEL;
};

jedi.Model3D.prototype.updateGpuBuffers = function () { // -> void
	// VBO:
	if (this.detail.webGLVbo && this.hasVertexes()) {
		this.detail.gl.bindBuffer(this.detail.gl.ARRAY_BUFFER, this.detail.webGLVbo);
		this.detail.gl.bufferData(this.detail.gl.ARRAY_BUFFER, this.detail.vertexes, this.detail.glBufferUsage);
		this.detail.gl.bindBuffer(this.detail.gl.ARRAY_BUFFER, null);
	}
	// IBO:
	if (this.detail.webGLIbo && this.hasIndexes()) {
		this.detail.gl.bindBuffer(this.detail.gl.ELEMENT_ARRAY_BUFFER, this.detail.webGLIbo);
		this.detail.gl.bufferData(this.detail.gl.ELEMENT_ARRAY_BUFFER, this.detail.indexes, this.detail.glBufferUsage);
		this.detail.gl.bindBuffer(this.detail.gl.ELEMENT_ARRAY_BUFFER, null);
	}
	// Note that OpenGL-ES and WebGL don't support 32bit indexing, so the data
	// type for the Index Buffer must be either `Uint16Array` or `Uint8Array`.
	// For the corresponding `gl.drawElements()` call, type must be `gl.UNSIGNED_SHORT` or `gl.UNSIGNED_BYTE`.
};

jedi.Model3D.prototype.dispose = function () { // -> void
	// Make sure buffer bindings are clear first:
	this.detail.gl.bindBuffer(this.detail.gl.ARRAY_BUFFER, null);
	this.detail.gl.bindBuffer(this.detail.gl.ELEMENT_ARRAY_BUFFER, null);

	if (this.detail.webGLVbo) {
		this.detail.gl.deleteBuffer(this.detail.webGLVbo);
		this.detail.webGLVbo = null;
	}

	if (this.detail.webGLIbo) {
		this.detail.gl.deleteBuffer(this.detail.webGLIbo);
		this.detail.webGLIbo = null;
	}

	// Clear the rest of the model:
	this.detail.glBufferUsage    = this.detail.gl.STATIC_DRAW;
	this.detail.vertexes         = null;
	this.detail.indexes          = null;
	this.detail.meshes           = null;
	this.detail.asyncLoadPending = false;

	if (this.isDefault()) {
		this.detail.name = "unnamed";
	}
};

jedi.Model3D.prototype.deriveNormalsAndTangents = function () { // -> void
	jedi.assert(this.hasVertexes(), "Model has no vertexes!");

	//
	// Derives the normal and orthogonal tangent vectors for the mesh vertexes.
	// For each vertex the normal and tangent vectors are derived from all triangles
	// using the vertex which results in smooth tangents across the mesh.
	//
	// Based almost entirely on R_DeriveNormalsAndTangents() from Doom3 BFG.
	//   https://github.com/id-Software/DOOM-3-BFG/blob/master/neo/renderer/tr_trisurf.cpp#L901
	//
	// NOTE: It is assumed that the mesh has valid texture coordinates (UVs)!
	//

	// +1 if x is positive, -1 if negative, 0 if x == 0.
	var sign = function (x) {
		return ((x > 0.0) ? 1 : (x < 0.0) ? -1 : 0);
	};

	var vertexCount      = this.getVertexCount();
	var vertexNormals    = new Float32Array(vertexCount * 3); // 3 floats per normal
	var vertexTangents   = new Float32Array(vertexCount * 3); // 3 floats per tangent
	var vertexBitangents = new Float32Array(vertexCount * 3); // 3 floats per bi-tangent

	var normal    = new Float32Array(3);
	var tangent   = new Float32Array(3);
	var bitangent = new Float32Array(3);
	var d0        = new Float32Array(5);
	var d1        = new Float32Array(5);
	var v;

	// One triangle at a time.
	for (v = 0; v < vertexCount; v += 3) {
		var v0 = v + 0;
		var v1 = v + 1;
		var v2 = v + 2;

		// Float32Array([pos, norm, tan, btan, uv, color])
		var a = this.getVertex(v0);
		var b = this.getVertex(v1);
		var c = this.getVertex(v2);

		var aX = a[0];
		var aY = a[1];
		var aZ = a[2];
		var bX = b[0];
		var bY = b[1];
		var bZ = b[2];
		var cX = c[0];
		var cY = c[1];
		var cZ = c[2];

		var aU = a[3 + 3 + 3 + 3 + 0];
		var aV = a[3 + 3 + 3 + 3 + 1];
		var bU = b[3 + 3 + 3 + 3 + 0];
		var bV = b[3 + 3 + 3 + 3 + 1];
		var cU = c[3 + 3 + 3 + 3 + 0];
		var cV = c[3 + 3 + 3 + 3 + 1];

		d0[0] = bX - aX;
		d0[1] = bY - aY;
		d0[2] = bZ - aZ;
		d0[3] = bU - aU;
		d0[4] = bV - aV;

		d1[0] = cX - aX;
		d1[1] = cY - aY;
		d1[2] = cZ - aZ;
		d1[3] = cU - aU;
		d1[4] = cV - aV;

		var area = d0[3] * d1[4] - d0[4] * d1[3];
		var areaSign = sign(area);

		//
		// Vertex normal:
		//
		normal[0] = d1[1] * d0[2] - d1[2] * d0[1];
		normal[1] = d1[2] * d0[0] - d1[0] * d0[2];
		normal[2] = d1[0] * d0[1] - d1[1] * d0[0];
		// Normalize:
		var f0 = 1.0 / Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]);
		normal[0] *= f0;
		normal[1] *= f0;
		normal[2] *= f0;

		// NOTE: Had to flip the normal direction here! This was not 
		// in the original D3 code. Is this necessary because they use 
		// a different texture and axis setup? Not sure...
		normal[0] *= -1.0;
		normal[1] *= -1.0;
		normal[2] *= -1.0;

		//
		// Tangent:
		//
		tangent[0] = d0[0] * d1[4] - d0[4] * d1[0];
		tangent[1] = d0[1] * d1[4] - d0[4] * d1[1];
		tangent[2] = d0[2] * d1[4] - d0[4] * d1[2];
		// Normalize:
		var f1 = 1.0 / Math.sqrt(tangent[0] * tangent[0] + tangent[1] * tangent[1] + tangent[2] * tangent[2]);
		if (areaSign == sign(f1))
		{
			// +f1
			if (f1 < 0) { f1 *= -1.0; }
		}
		else
		{
			// -f1
			if (f1 > 0) { f1 *= -1.0; }
		}
		tangent[0] *= f1;
		tangent[1] *= f1;
		tangent[2] *= f1;

		//
		// Bi-tangent:
		//
		bitangent[0] = d0[3] * d1[0] - d0[0] * d1[3];
		bitangent[1] = d0[3] * d1[1] - d0[1] * d1[3];
		bitangent[2] = d0[3] * d1[2] - d0[2] * d1[3];
		// Normalize:
		var f2 = 1.0 / Math.sqrt(bitangent[0] * bitangent[0] + bitangent[1] * bitangent[1] + bitangent[2] * bitangent[2]);
		if (areaSign == sign(f2))
		{
			// +f2
			if (f2 < 0) { f2 *= -1.0; }
		}
		else
		{
			// -f2
			if (f2 > 0) { f2 *= -1.0; }
		}
		bitangent[0] *= f2;
		bitangent[1] *= f2;
		bitangent[2] *= f2;

		//
		// Average the results:
		//
		vertexNormals[v0 * 3 + 0] += normal[0];
		vertexNormals[v0 * 3 + 1] += normal[1];
		vertexNormals[v0 * 3 + 2] += normal[2];
		vertexNormals[v1 * 3 + 0] += normal[0];
		vertexNormals[v1 * 3 + 1] += normal[1];
		vertexNormals[v1 * 3 + 2] += normal[2];
		vertexNormals[v2 * 3 + 0] += normal[0];
		vertexNormals[v2 * 3 + 1] += normal[1];
		vertexNormals[v2 * 3 + 2] += normal[2];

		vertexTangents[v0 * 3 + 0] += tangent[0];
		vertexTangents[v0 * 3 + 1] += tangent[1];
		vertexTangents[v0 * 3 + 2] += tangent[2];
		vertexTangents[v1 * 3 + 0] += tangent[0];
		vertexTangents[v1 * 3 + 1] += tangent[1];
		vertexTangents[v1 * 3 + 2] += tangent[2];
		vertexTangents[v2 * 3 + 0] += tangent[0];
		vertexTangents[v2 * 3 + 1] += tangent[1];
		vertexTangents[v2 * 3 + 2] += tangent[2];

		vertexBitangents[v0 * 3 + 0] += bitangent[0];
		vertexBitangents[v0 * 3 + 1] += bitangent[1];
		vertexBitangents[v0 * 3 + 2] += bitangent[2];
		vertexBitangents[v1 * 3 + 0] += bitangent[0];
		vertexBitangents[v1 * 3 + 1] += bitangent[1];
		vertexBitangents[v1 * 3 + 2] += bitangent[2];
		vertexBitangents[v2 * 3 + 0] += bitangent[0];
		vertexBitangents[v2 * 3 + 1] += bitangent[1];
		vertexBitangents[v2 * 3 + 2] += bitangent[2];
	}

	// Project the summed vectors onto the normal plane and normalize.
	// The tangent vectors will not necessarily be orthogonal to each
	// other, but they will be orthogonal to the surface normal.
	var ix, iy, iz;
	for (v = 0; v < vertexCount; ++v) {
		ix = (v * 3) + 0;
		iy = (v * 3) + 1;
		iz = (v * 3) + 2;

		var normalScale = 1.0 / Math.sqrt(
			vertexNormals[ix] * vertexNormals[ix] +
			vertexNormals[iy] * vertexNormals[iy] +
			vertexNormals[iz] * vertexNormals[iz]);

		vertexNormals[ix] *= normalScale;
		vertexNormals[iy] *= normalScale;
		vertexNormals[iz] *= normalScale;

		vertexTangents[ix] -= (vertexTangents[ix] * vertexNormals[ix]) * vertexNormals[ix];
		vertexTangents[iy] -= (vertexTangents[iy] * vertexNormals[iy]) * vertexNormals[iy];
		vertexTangents[iz] -= (vertexTangents[iz] * vertexNormals[iz]) * vertexNormals[iz];

		vertexBitangents[ix] -= (vertexBitangents[ix] * vertexNormals[ix]) * vertexNormals[ix];
		vertexBitangents[iy] -= (vertexBitangents[iy] * vertexNormals[iy]) * vertexNormals[iy];
		vertexBitangents[iz] -= (vertexBitangents[iz] * vertexNormals[ix]) * vertexNormals[iz];

		var tangentScale = 1.0 / Math.sqrt(
			vertexTangents[ix] * vertexTangents[ix] +
			vertexTangents[iy] * vertexTangents[iy] +
			vertexTangents[iz] * vertexTangents[iz]);

		vertexTangents[ix] *= tangentScale;
		vertexTangents[iy] *= tangentScale;
		vertexTangents[iz] *= tangentScale;

		var bitangentScale = 1.0 / Math.sqrt(
			vertexBitangents[ix] * vertexBitangents[ix] +
			vertexBitangents[iy] * vertexBitangents[iy] +
			vertexBitangents[iz] * vertexBitangents[iz]);

		vertexBitangents[ix] *= bitangentScale;
		vertexBitangents[iy] *= bitangentScale;
		vertexBitangents[iz] *= bitangentScale;
	}

	// Copy results to this model's vertex array:
	var vert = 0;
	var vertexArray = this.detail.vertexes;
	for (v = 0; v < vertexCount; ++v) {
		ix = (v * 3) + 0;
		iy = (v * 3) + 1;
		iz = (v * 3) + 2;

		// Vertex normal (xyz):
		vertexArray[vert + 3]  = vertexNormals[ix];
		vertexArray[vert + 4]  = vertexNormals[iy];
		vertexArray[vert + 5]  = vertexNormals[iz];

		// Vertex tangent (xyz):
		vertexArray[vert + 6]  = vertexTangents[ix];
		vertexArray[vert + 7]  = vertexTangents[iy];
		vertexArray[vert + 8]  = vertexTangents[iz];

		// Vertex bi-tangent (xyz):
		vertexArray[vert + 9]  = vertexBitangents[ix];
		vertexArray[vert + 10] = vertexBitangents[iy];
		vertexArray[vert + 11] = vertexBitangents[iz];

		vert += jedi.Model3D.ELEMENTS_PER_VERTEX;
	}

	jedi.logComment("Normals and tangents derived for model '" + this.detail.name + "'.");
};

jedi.Model3D.prototype.addDebugTangentBasis = function (scale) { // -> void
	if (!this.hasVertexes()) {
		return;
	}

	if (scale === undefined || scale === null) {
		scale = 1.0;
	}

	var addTBN = function (origin, t, b, n) {
		// Vertex normals are BLUE:
		var vn = [ (origin[0] + n[0] * scale), (origin[1] + n[1] * scale), (origin[2] + n[2] * scale) ];
		jedi.DebugRenderer.addDebugLine(origin, vn, [0.0, 0.0, 1.0]);
		// Tangents are GREEN:
		var vt = [ (origin[0] + t[0] * scale), (origin[1] + t[1] * scale), (origin[2] + t[2] * scale) ];
		jedi.DebugRenderer.addDebugLine(origin, vt, [0.0, 1.0, 0.0]);
		// Bi-tangents are RED:
		var vb = [ (origin[0] + b[0] * scale), (origin[1] + b[1] * scale), (origin[2] + b[2] * scale) ];
		jedi.DebugRenderer.addDebugLine(origin, vb, [1.0, 0.0, 0.0]);
	};

	var vertexCount = this.getVertexCount();
	var vertexArray = this.detail.vertexes;
	var vert = 0;

	// Add for all vertexes in this model.
	for (var v = 0; v < vertexCount; ++v) {
		var p = [ vertexArray[vert + 0], vertexArray[vert + 1],  vertexArray[vert + 2]  ];
		var n = [ vertexArray[vert + 3], vertexArray[vert + 4],  vertexArray[vert + 5]  ];
		var t = [ vertexArray[vert + 6], vertexArray[vert + 7],  vertexArray[vert + 8]  ];
		var b = [ vertexArray[vert + 9], vertexArray[vert + 10], vertexArray[vert + 11] ];
		addTBN(p, t, b, n);
		vert += jedi.Model3D.ELEMENTS_PER_VERTEX;
	}
};

jedi.Model3D.prototype.isLoading = function () { // -> bool
	return this.detail.asyncLoadPending;
};

jedi.Model3D.prototype.hasVertexes = function () { // -> bool
	return this.detail.vertexes != null && this.detail.vertexes.length > 0;
};

jedi.Model3D.prototype.hasIndexes = function () { // -> bool
	return this.detail.indexes != null && this.detail.indexes.length > 0;
};

jedi.Model3D.prototype.hasMeshes = function () { // -> bool
	return this.detail.meshes != null && this.detail.meshes.length > 0;
};

jedi.Model3D.prototype.getVertexCount = function () { // -> int
	if (this.hasVertexes()) {
		return this.detail.vertexes.length / jedi.Model3D.ELEMENTS_PER_VERTEX;
	}
	return 0;
};

jedi.Model3D.prototype.getTriangleCount = function () { // -> int
	if (this.hasIndexes()) {
		return this.detail.indexes.length / 3;
	}
	return 0;
};

jedi.Model3D.prototype.getIndexCount = function () { // -> int
	if (this.hasIndexes()) {
		return this.detail.indexes.length;
	}
	return 0;
};

jedi.Model3D.prototype.getMeshCount = function () { // -> int
	if (this.hasMeshes()) {
		return this.detail.meshes.length;
	}
	return 0;
};

jedi.Model3D.prototype.getVertex = function (index) { // -> Float32Array([pos, norm, tan, btan, uv, color])
	jedi.assert(this.hasVertexes());
	jedi.assert(index >= 0 && index < this.getVertexCount(), "Vertex buffer index out-of-bounds!");
	return this.detail.vertexes.subarray(
		(index * jedi.Model3D.ELEMENTS_PER_VERTEX),
		(index * jedi.Model3D.ELEMENTS_PER_VERTEX) + jedi.Model3D.ELEMENTS_PER_VERTEX);
};

jedi.Model3D.prototype.getTriangleIndexes = function (index) { // -> Uint16Array([i0, i1, i2])
	jedi.assert(this.hasIndexes());
	jedi.assert(index >= 0 && index < this.getTriangleCount(), "Triangle index out-of-bounds!");
	return this.detail.indexes.subarray((index * 3), (index * 3) + 3);
};

jedi.Model3D.prototype.getIndex = function (index) { // -> int
	jedi.assert(this.hasIndexes());
	jedi.assert(index >= 0 && index < this.getIndexCount(), "Index buffer index out-of-bounds!");
	return this.detail.indexes[index];
};

jedi.Model3D.prototype.getMesh = function (index) { // -> Mesh3D
	jedi.assert(this.hasMeshes());
	jedi.assert(index >= 0 && index < this.getMeshCount(), "Mesh index out-of-bounds!");
	return this.detail.meshes[index];
};

jedi.Model3D.prototype.getName = function () { // -> String
	return this.detail.name;
};

jedi.Model3D.prototype.isDefault = function () { // -> bool
	return this.detail.name === "default";
};

jedi.Model3D.prototype.drawMesh = function (mesh, materialOverride) { // -> void
	// Draws a single mesh of the model.
	if (!mesh) { 
		return; 
	}

	if (materialOverride) {
		materialOverride.apply();
	} else {
		// Apply custom mesh material or a default fallback.
		if (mesh.hasMaterial()) {
			mesh.material.apply();
		} else {
			jedi.Material.getDefault.apply();
		}
	}

	// We support both indexed and unindexed draws.
	if (mesh.indexRangeValid()) {
		this.detail.gl.drawElements(jedi.Renderer.getWebGLRenderMode(), mesh.indexCount,
			this.detail.gl.UNSIGNED_SHORT, (mesh.firstIndex * 2)); // AKA mesh.firstIndex * sizeof(uint16)
	} else if (mesh.vertexRangeValid()) {
		this.detail.gl.drawArrays(jedi.Renderer.getWebGLRenderMode(),
			mesh.firstVertex, mesh.vertexCount);
	}
};

jedi.Model3D.prototype.drawModel = function (meshPredicate, materialOverride) { // -> void
	if (!this.hasMeshes()) {
		return;
	}

	// Bind buffers:
	if (this.detail.webGLVbo) {
		this.detail.gl.bindBuffer(this.detail.gl.ARRAY_BUFFER, this.detail.webGLVbo);
	}
	if (this.detail.webGLIbo) {
		this.detail.gl.bindBuffer(this.detail.gl.ELEMENT_ARRAY_BUFFER, this.detail.webGLIbo);
	}

	// Set vertex format/layout:

	// vec3
	this.detail.gl.enableVertexAttribArray(jedi.Model3D.ATTRIB_INDEX_POSITION);
	this.detail.gl.vertexAttribPointer(jedi.Model3D.ATTRIB_INDEX_POSITION, 3,
		this.detail.gl.FLOAT, false, jedi.Model3D.VERTEX_SIZE_BYTES, jedi.Model3D.VERT_OFFSET_POSITION);

	// vec3
	this.detail.gl.enableVertexAttribArray(jedi.Model3D.ATTRIB_INDEX_NORMAL);
	this.detail.gl.vertexAttribPointer(jedi.Model3D.ATTRIB_INDEX_NORMAL, 3,
		this.detail.gl.FLOAT, false, jedi.Model3D.VERTEX_SIZE_BYTES, jedi.Model3D.VERT_OFFSET_NORMAL);

	// vec3
	this.detail.gl.enableVertexAttribArray(jedi.Model3D.ATTRIB_INDEX_TANGENT);
	this.detail.gl.vertexAttribPointer(jedi.Model3D.ATTRIB_INDEX_TANGENT, 3,
		this.detail.gl.FLOAT, false, jedi.Model3D.VERTEX_SIZE_BYTES, jedi.Model3D.VERT_OFFSET_TANGENT);

	// vec3
	this.detail.gl.enableVertexAttribArray(jedi.Model3D.ATTRIB_INDEX_BITANGENT);
	this.detail.gl.vertexAttribPointer(jedi.Model3D.ATTRIB_INDEX_BITANGENT, 3,
		this.detail.gl.FLOAT, false, jedi.Model3D.VERTEX_SIZE_BYTES, jedi.Model3D.VERT_OFFSET_BITANGENT);

	// vec2
	this.detail.gl.enableVertexAttribArray(jedi.Model3D.ATTRIB_INDEX_TEXCOORDS);
	this.detail.gl.vertexAttribPointer(jedi.Model3D.ATTRIB_INDEX_TEXCOORDS, 2,
		this.detail.gl.FLOAT, false, jedi.Model3D.VERTEX_SIZE_BYTES, jedi.Model3D.VERT_OFFSET_TEXCOORDS);

	// vec4
	this.detail.gl.enableVertexAttribArray(jedi.Model3D.ATTRIB_INDEX_COLOR);
	this.detail.gl.vertexAttribPointer(jedi.Model3D.ATTRIB_INDEX_COLOR, 4,
		this.detail.gl.FLOAT, false, jedi.Model3D.VERTEX_SIZE_BYTES, jedi.Model3D.VERT_OFFSET_COLOR);

	// Draw all meshes in the model:
	for (var m = 0; m < this.detail.meshes.length; ++m) {
		// The predicate allows the user to discard unwanted meshes from the rendering.
		if (meshPredicate) {
			if (meshPredicate(this.detail.meshes[m])) {
				this.drawMesh(this.detail.meshes[m], materialOverride);
			}
		} else {
			this.drawMesh(this.detail.meshes[m], materialOverride);
		}
	}

	// Cleanup:
	this.detail.gl.bindBuffer(this.detail.gl.ELEMENT_ARRAY_BUFFER, null);
	this.detail.gl.bindBuffer(this.detail.gl.ARRAY_BUFFER, null);
};

/*
===========================================================
Default shape factories:
===========================================================
*/

jedi.Model3D.createBoxShape = function (width, height, depth, color, deriveTangents, modelName, storageHint) { // -> Model3D ['static' method]

	jedi.logComment("Creating a default box shape model...");

	// Provide defaults if undefined|null (zero is acceptable for the sizes):
	if (width          === undefined || width          === null) { width          = 1.0;   }
	if (height         === undefined || height         === null) { height         = 1.0;   }
	if (depth          === undefined || depth          === null) { depth          = 1.0;   }
	if (deriveTangents === undefined || deriveTangents === null) { deriveTangents = false; }
	if (modelName      === undefined || modelName      === null) { modelName      = "box"; }
	if (color          === undefined || color          === null) { color          = [1.0, 1.0, 1.0, 1.0]; }
	if (storageHint    === undefined || storageHint    === null) { storageHint    = jedi.ModelStorageHint.STATIC; }

	// Face indexes [6][4]:
	var boxF = [
		[ 0, 1, 5, 4 ],
		[ 4, 5, 6, 7 ],
		[ 7, 6, 2, 3 ],
		[ 1, 0, 3, 2 ],
		[ 1, 2, 6, 5 ],
		[ 0, 4, 7, 3 ] ];

	// Positions / vertexes [8][3]:
	var boxV = [
		[ -0.5, -0.5, -0.5 ],
		[ -0.5, -0.5, +0.5 ],
		[ +0.5, -0.5, +0.5 ],
		[ +0.5, -0.5, -0.5 ],
		[ -0.5, +0.5, -0.5 ],
		[ -0.5, +0.5, +0.5 ],
		[ +0.5, +0.5, +0.5 ],
		[ +0.5, +0.5, -0.5 ] ];

	// Vertex normals [6][3]:
	var boxN = [
		[ -1.0, +0.0, +0.0 ],
		[ +0.0, +1.0, +0.0 ],
		[ +1.0, +0.0, +0.0 ],
		[ +0.0, -1.0, +0.0 ],
		[ +0.0, +0.0, +1.0 ],
		[ +0.0, +0.0, -1.0 ] ];

	// Texture coordinates [4][2]:
	var boxT = [
		[ 0.0, 0.0 ],
		[ 0.0, 1.0 ],
		[ 1.0, 1.0 ],
		[ 1.0, 0.0 ] ];

	var vertexArray = new Float32Array(24 * jedi.Model3D.ELEMENTS_PER_VERTEX);
	var indexArray  = new Uint16Array(36);
	var meshArray   = [ new jedi.Mesh3D(/* firstVert = */ 0, /* vertCount = */ 24, /* firstIdx = */ 0, /* idxCount = */ 36) ];

	// Fill in the data, one face of the
	// box at a time (2 tris per face):
	var vertIndex = 0;
	var faceIndex = 0;
	var v = 0;
	for (var i = 0; i < 6; ++i) {
		for (var j = 0; j < 4; ++j) {
			// Scaled vertex position (xyz):
			vertexArray[v + 0]  = boxV[boxF[i][j]][0] * width;
			vertexArray[v + 1]  = boxV[boxF[i][j]][1] * height;
			vertexArray[v + 2]  = boxV[boxF[i][j]][2] * depth;

			// Vertex normal (xyz):
			vertexArray[v + 3]  = boxN[i][0];
			vertexArray[v + 4]  = boxN[i][1];
			vertexArray[v + 5]  = boxN[i][2];

			// Vertex tangent (xyz / generated later):
			vertexArray[v + 6]  = 0.0;
			vertexArray[v + 7]  = 0.0;
			vertexArray[v + 8]  = 0.0;

			// Vertex bi-tangent (xyz / generated later):
			vertexArray[v + 9]  = 0.0;
			vertexArray[v + 10] = 0.0;
			vertexArray[v + 11] = 0.0;

			// Vertex texture coordinates (uv):
			vertexArray[v + 12] = boxT[j][0];
			vertexArray[v + 13] = boxT[j][1];

			// Vertex color (rgba):
			vertexArray[v + 14] = color[0];
			vertexArray[v + 15] = color[1];
			vertexArray[v + 16] = color[2];
			vertexArray[v + 17] = color[3];

			v += jedi.Model3D.ELEMENTS_PER_VERTEX;
		}

		indexArray[faceIndex + 0] = vertIndex;
		indexArray[faceIndex + 1] = vertIndex + 1;
		indexArray[faceIndex + 2] = vertIndex + 2;
		faceIndex += 3;

		indexArray[faceIndex + 0] = vertIndex + 2;
		indexArray[faceIndex + 1] = vertIndex + 3;
		indexArray[faceIndex + 2] = vertIndex;
		faceIndex += 3;

		vertIndex += 4;
	}

	var mdl = new jedi.Model3D();
	mdl.initWithData(vertexArray, indexArray, meshArray, deriveTangents, modelName, storageHint);
	return mdl;
};

/*
===========================================================
3D Model format importers:
===========================================================
*/

jedi.Model3D.isValidModel3DFileFormat = function (filename) { // -> String
	if (!filename) {
		return null;
	}
	var lastDot = filename.lastIndexOf('.');
	if (lastDot < 0) {
		return null;
	}
	var extension = filename.substring(lastDot).toLowerCase();

	// NOTE: Supported file formats must be added here!!!
	//
	if (extension === ".raw" ) { return extension; }
	if (extension === ".obj" ) { return extension; }
	if (extension === ".json") { return extension; }

	// Unsupported format.
	return null;
};

jedi.Model3D.getImporterForFormat = function (extension) { // -> function()

	// NOTE: Supported file formats must be added here!!!
	//
	if (extension === ".raw" ) { return jedi.Model3D.importRAW;  }
	if (extension === ".obj" ) { return jedi.Model3D.importOBJ;  }
	if (extension === ".json") { return jedi.Model3D.importJSON; }

	// Unsupported format.
	return null;
};

/*
 * Import 3D Model from '.raw' file format.
 *
 * Currently limited to unindexed geometry and single mesh models.
 * No normals or UVs are outputted in the RAW format. Vertex color is fixed to white.
 */
jedi.Model3D.importRAW = function (model, modelFileContents, deriveTangents, modelName, storageHint) { // -> bool
	jedi.assert(model, "Invalid Model3D reference!");
	jedi.assert(modelFileContents, "No file contents provided!");
	jedi.logComment("Importing RAW model '" + (modelName || "unnamed") + "'...");

	// The RAW file is just a dump of each vertex in the model.
	// Each three vertexes make up a triangle. Nothing else is exported.
	// No normals, UVs or colors are provided.
	var values = modelFileContents.match(/\S+/g);
	if (!values || values.length <= 0) {
		jedi.logWarning("Couldn't recover any vertex info from RAW model data...");
		return false;
	}

	// Each triplet in `values[]` is a XYZ vertex position.
	var vertexCount   = (values.length / 3);
	var triangleCount = (vertexCount   / 3);
	var x, y, z, v, vert = 0, tri = 0;

	// Copy each vertex position to the final output array:
	var vertexArray = new Float32Array(vertexCount * jedi.Model3D.ELEMENTS_PER_VERTEX);
	for (v = 0; v < vertexCount; ++v) {
		// `values[]' is an array of strings. Convert to float values.
		x = parseFloat(values[tri++]);
		y = parseFloat(values[tri++]);
		z = parseFloat(values[tri++]);
		jedi.assert(!isNaN(x));
		jedi.assert(!isNaN(y));
		jedi.assert(!isNaN(z));

		// Vertex position (xyz):
		vertexArray[vert + 0]  = x;
		vertexArray[vert + 1]  = y;
		vertexArray[vert + 2]  = z;

		// Vertex normal (xyz):
		vertexArray[vert + 3]  = 0.0;
		vertexArray[vert + 4]  = 0.0;
		vertexArray[vert + 5]  = 0.0;

		// Vertex tangent (xyz):
		vertexArray[vert + 6]  = 0.0;
		vertexArray[vert + 7]  = 0.0;
		vertexArray[vert + 8]  = 0.0;

		// Vertex bi-tangent (xyz):
		vertexArray[vert + 9]  = 0.0;
		vertexArray[vert + 10] = 0.0;
		vertexArray[vert + 11] = 0.0;

		// Vertex texture coordinates (uv):
		vertexArray[vert + 12] = 0.0;
		vertexArray[vert + 13] = 0.0;

		// Vertex color (rgba - white):
		vertexArray[vert + 14] = 1.0;
		vertexArray[vert + 15] = 1.0;
		vertexArray[vert + 16] = 1.0;
		vertexArray[vert + 17] = 1.0;

		vert += jedi.Model3D.ELEMENTS_PER_VERTEX;
	}

	jedi.logComment("RAW model has " + vertexCount + " vertexes and " + triangleCount + " triangles (unindexed).");

	// Finish setting up the WebGL vertex/index buffers.
	return model.initWithData(vertexArray, null,
		[ new jedi.Mesh3D(0, vertexCount) ], deriveTangents, modelName, storageHint);
};

/*
 * Import 3D Model from '.json' file format (based on the Three.js JSON format).
 *
 * Currently limited to single mesh models (partially implemented!). 
 * Vertex color is fixed to white. No UVs are read in. Per-vertex normal will be read if available.
 */
jedi.Model3D.importJSON = function (model, modelFileContents, deriveTangents, modelName, storageHint) { // -> bool
	jedi.assert(model, "Invalid Model3D reference!");
	jedi.assert(modelFileContents, "No file contents provided!");
	jedi.logComment("Importing JSON model '" + (modelName || "unnamed") + "'...");

	var jsObject = JSON.parse(modelFileContents);
	if (!jsObject) {
		jedi.logWarning("Failed to parse JSON object from file data...");
		return false;
	}

	// Miscellaneous local variables:
	var isQuad;
	var hasMaterial;
	var hasFaceVertexUV;
	var hasFaceNormal;
	var hasFaceVertexNormal;
	var hasFaceColor;
	var hasFaceVertexColor;
	var vertexArray;
	var indexArray;
	var normalIndex;
	var offset, type;
	var vert, tri;
	var x, y, z;
	var i, n;

	var isBitSet = function (value, position) {
		return value & (1 << position);
	};

	var vertexCount   = jsObject.metadata.vertices;
	var triangleCount = jsObject.metadata.faces;

	if (vertexCount <= 0) {
		jedi.logWarning("No vertexes in JSON 3D model data!");
		return false;
	}
	if (triangleCount <= 0) {
		jedi.logWarning("No indexes in JSON 3D model data!");
		return false;
	}

	vertexArray = new Float32Array(vertexCount * jedi.Model3D.ELEMENTS_PER_VERTEX);
	indexArray  = new Uint16Array(triangleCount * 3);

	offset = 0;
	vert   = 0;
	n      = jsObject.vertices.length;
	while (offset < n) {
		vertexArray[vert + 0] = jsObject.vertices[offset++]; // X
		vertexArray[vert + 1] = jsObject.vertices[offset++]; // Y
		vertexArray[vert + 2] = jsObject.vertices[offset++]; // Z

		// Vertex normal (xyz):
		vertexArray[vert + 3]  = 0.0;
		vertexArray[vert + 4]  = 0.0;
		vertexArray[vert + 5]  = 0.0;

		// Vertex tangent (xyz):
		vertexArray[vert + 6]  = 0.0;
		vertexArray[vert + 7]  = 0.0;
		vertexArray[vert + 8]  = 0.0;

		// Vertex bi-tangent (xyz):
		vertexArray[vert + 9]  = 0.0;
		vertexArray[vert + 10] = 0.0;
		vertexArray[vert + 11] = 0.0;

		// Vertex texture coordinates (uv):
		vertexArray[vert + 12] = 0.0;
		vertexArray[vert + 13] = 0.0;

		// Vertex color (rgba - white):
		vertexArray[vert + 14] = 1.0;
		vertexArray[vert + 15] = 1.0;
		vertexArray[vert + 16] = 1.0;

		vert += jedi.Model3D.ELEMENTS_PER_VERTEX;
	}

	offset = 0;
	vert   = 0;
	tri    = 0;
	n      = jsObject.faces.length;
	while (offset < n) {
		type = jsObject.faces[offset++];

		isQuad              = isBitSet(type, 0);
		hasMaterial         = isBitSet(type, 1);
		hasFaceVertexUV     = isBitSet(type, 3);
		hasFaceNormal       = isBitSet(type, 4);
		hasFaceVertexNormal = isBitSet(type, 5);
		hasFaceColor        = isBitSet(type, 6);
		hasFaceVertexColor  = isBitSet(type, 7);

		if (isQuad) {
			jedi.logError("'Model3D.importJSON' only supports triangulated model faces!");
			return false;
		}

		indexArray[tri++] = jsObject.faces[offset++];
		indexArray[tri++] = jsObject.faces[offset++];
		indexArray[tri++] = jsObject.faces[offset++];

		//
		// Read in additional mesh face attributes
		// (or skip over the ones we are ignoring...)
		//

		if (hasMaterial) {
			offset++;
			// TODO
		}

		if (hasFaceVertexUV) {
			offset++;
			// TODO
		}

		if (hasFaceNormal) {
			offset++;
			// TODO
		}

		if (hasFaceVertexNormal) {
			for (i = 0; i < 3; ++i) {
				normalIndex = jsObject.faces[offset++] * 3;
				x = jsObject.normals[normalIndex++];
				y = jsObject.normals[normalIndex++];
				z = jsObject.normals[normalIndex];
				vertexArray[vert + 3] = x;
				vertexArray[vert + 4] = y;
				vertexArray[vert + 5] = z;
				vert += jedi.Model3D.ELEMENTS_PER_VERTEX;
			}
		}

		if (hasFaceColor) {
			offset++;
			// TODO
		}

		if (hasFaceVertexColor) {
			for (i = 0; i < 3; ++i) {
				offset++;
				// TODO
			}
		}
	}

	jedi.logComment("JSON model has " + vertexCount + " vertexes and " + triangleCount + " triangles.");

	// Finish setting up the WebGL vertex/index buffers.
	return model.initWithData(vertexArray, indexArray,
		[ new jedi.Mesh3D(0, vertexCount, 0, triangleCount * 3) ], deriveTangents, modelName, storageHint);
};

/*
 * Import 3D Model from Wavefront '.obj' file format.
 * 
 * Supports vertex normals and textures. Vertex color
 * is currently fixed to fully opaque white.
 * Has multi-mesh model support.
 */
jedi.Model3D.importOBJ = function (model, modelFileContents, deriveTangents, modelName, storageHint) { // -> bool
	jedi.assert(model, "Invalid Model3D reference!");
	jedi.assert(modelFileContents, "No file contents provided!");
	jedi.logComment("Importing OBJ model '" + (modelName || "unnamed") + "'...");

	// Split a string/line by white spaces, returning an array of substrings.
	//
	var splitBySpaces = function (line) {
		return line.match(/\S+/g);
	};

	// Set up an OBJ mesh face instance.
	//
	var makeObjFace = function (v, t, n) {
		// Decrement one from every index because OBJ indexes start at 1, not 0.
		v = (v != null) ? (parseInt(v) - 1) : -1;
		t = (t != null) ? (parseInt(t) - 1) : -1;
		n = (n != null) ? (parseInt(n) - 1) : -1;
		return [ v, t, n ];
	};

	// Looks for a given OBJ object or group in the input array, by name.
	//
	var findObjObject = function (objs, key) {
		for (var o = 0; o < objs.length; ++o) {
			if (objs[o].name === key) {
				return objs[o];
			}
		}
		return null;
	};

	// Set up a new OBJ object or group instance.
	//
	var makeObjObject = function (objs, currObj, line, faceCnt) {
		var existingObject = null;
		if (line) {
			var objName = line.substr(1); // Skip 'o', 'g', whatever...
			objName = objName.trim();     // Remove possible training blanks.
			if (!currObj) {
				existingObject = findObjObject(objs, objName);
				if (existingObject) {
					currObj = existingObject;
				} else {
					currObj = {
						firstFace : 0, faceCount : 0,
						name : objName, material : null };
				}
			} else {
				objs.push(currObj);
				existingObject = findObjObject(objs, objName);
				if (existingObject) {
					currObj = existingObject;
				} else {
					currObj = {
						firstFace : (faceCnt / 3), faceCount : 0,
						name : objName, material : null };
				}
			}
		} else {
			existingObject = findObjObject(objs, "default");
			if (existingObject) {
				currObj = existingObject;
				currObj.faceCount++;
			} else {
				currObj = {
					firstFace : 0, faceCount : 1,
					name : "default", material : null };
			}
		}
		return currObj
	};

	// Miscellaneous local vars:
	//
	var vertexes   = []; // xyz float triplets
	var normals    = []; // xyz float triplets
	var texcoords  = []; // uv  float pairs
	var faces      = []; // abc integer triangle index triplets
	var objects    = []; // array of { firstFace, faceCount, name }
	var currObject = null;
	var l, line, lines, values, validFace;

	// Split the input by lines:
	lines = modelFileContents.split('\n');

	// Parse each line...
	for (l = 0; l < lines.length; ++l) {
		line = lines[l].trim();

		if (line.indexOf("o ") >= 0) { // OBJ object (mesh)

			currObject = makeObjObject(objects, currObject, line, faces.length);

		} else if (line.indexOf("g ") >= 0) { // OBJ group (mesh)

			currObject = makeObjObject(objects, currObject, line, faces.length);

		} else if (line.indexOf("v ") >= 0) { // OBJ vertex

			values = splitBySpaces(line); // `values[0]` should be "v"
			vertexes.push(parseFloat(values[1]));
			vertexes.push(parseFloat(values[2]));
			vertexes.push(parseFloat(values[3]));

		} else if (line.indexOf("vn ") >= 0) { // OBJ vertex normal

			values = splitBySpaces(line); // `values[0]` should be "vn"
			normals.push(parseFloat(values[1]));
			normals.push(parseFloat(values[2]));
			normals.push(parseFloat(values[3]));

		} else if (line.indexOf("vt ") >= 0) { // OBJ texture coordinates

			values = splitBySpaces(line); // `values[0]` should be "vt"
			texcoords.push(parseFloat(values[1]));
			texcoords.push(parseFloat(values[2]));

		} else if (line.indexOf("f ") >= 0) { // OBJ face indexes

			validFace = false;

			// Triangle face, vertex + texture + normal. "f v/t/n v/t/n v/t/n".
			if ((values = line.match(/(\s([0-9]+)(\/{1})([0-9]+)(\/{1})([0-9]+)){3}/g)) && values.length == 1) {

				values = values[0].trim().split(/[\s\/]+/);
				faces.push(makeObjFace(values[0], values[1], values[2]));
				faces.push(makeObjFace(values[3], values[4], values[5]));
				faces.push(makeObjFace(values[6], values[7], values[8]));
				validFace = true;

			// Triangle face, vertex + normal. "f v//n v//n v//n".
			} else if ((values = line.match(/(\s([0-9]+)(\/{2})([0-9]+)){3}/g)) && values.length == 1) {

				values = values[0].trim().split(/[\s\/]+/);
				faces.push(makeObjFace(values[0], null, values[1]));
				faces.push(makeObjFace(values[2], null, values[3]));
				faces.push(makeObjFace(values[4], null, values[5]));
				validFace = true;

			// Triangle face, vertex + texture. "f v/t v/t v/t".
			} else if ((values = line.match(/(\s([0-9]+)(\/{1})([0-9]+)){3}/g)) && values.length == 1) {

				values = values[0].trim().split(/[\s\/]+/);
				faces.push(makeObjFace(values[0], values[1], null));
				faces.push(makeObjFace(values[2], values[3], null));
				faces.push(makeObjFace(values[4], values[5], null));
				validFace = true;

			// Triangle face, vertex only. "f v v v".
			} else if ((values = line.match(/(\s([0-9]+)){3}/g)) && values.length == 1) {

				values = values[0].trim().split(' ');
				faces.push(makeObjFace(values[0], null, null));
				faces.push(makeObjFace(values[1], null, null));
				faces.push(makeObjFace(values[2], null, null));
				validFace = true;

			} else {
				// Unhandled OBJ face layout (probably not triangulated).
				jedi.logWarning("Line " + (l + 1) + ": OBJ importer can only handle triangulated mesh faces!");
				continue;
			}

			if (validFace) {
				if (currObject) {
					currObject.faceCount++;
				} else {
					currObject = makeObjObject();
				}
			}

		} else if (line.indexOf("usemtl") >= 0) { // Start of material

			if (!currObject) {
				currObject = makeObjObject();
			}
			currObject.material = line.substr(6).trim();

			// Uncomment the following for (very) verbose debugging.
			//if (currObject.material) {
			//	jedi.logComment("Mesh '" + currObject.name + 
			//		"' uses material '" + currObject.material.getName() + "'.");
			//}

		} else {
			// Unhandled OBJ element or a line-comment.
		}
	}

	// The last one has to be manually added.
	if (currObject) {
		objects.push(currObject);
	}

	//
	// Now we expand the faces into interleaved vertexes.
	// TODO: Try to add indexing to see if there's any savings!
	//

	var addPosition = function (array, idx, x, y, z) {
		array[idx + 0] = x;
		array[idx + 1] = y;
		array[idx + 2] = z;
	};
	var addNormalVec = function (array, idx, x, y, z) {
		array[idx + 3] = x;
		array[idx + 4] = y;
		array[idx + 5] = z;
	};
	var addTexCoords = function (array, idx, u, v) {
		array[idx + 12] = u;
		array[idx + 13] = v;
	};
	var addDefaults = function (array, idx) {
		// Vertex tangent (null):
		array[idx + 6]  = 0.0;
		array[idx + 7]  = 0.0;
		array[idx + 8]  = 0.0;
		// Vertex bi-tangent (null):
		array[idx + 9]  = 0.0;
		array[idx + 10] = 0.0;
		array[idx + 11] = 0.0;
		// Vertex color (white):
		array[idx + 14] = 1.0;
		array[idx + 15] = 1.0;
		array[idx + 16] = 1.0;
		array[idx + 17] = 1.0;
	};

	var vertexCount = faces.length; // For each face there are 3 entries in the `faces` array.
	var vertexArray = new Float32Array(vertexCount * jedi.Model3D.ELEMENTS_PER_VERTEX);
	var vert = 0, face, f, o, v, t, n;

	for (f = 0; f < faces.length; ++f) {
		face = faces[f];
		v = face[0] * 3; // vertex  (xyz)
		t = face[1] * 2; // texture (uv)
		n = face[2] * 3; // normal  (xyz)

		addDefaults(vertexArray, vert);
		addPosition(vertexArray, vert, vertexes[v], vertexes[v + 1], vertexes[v + 2]);

		if (n >= 0) {
			addNormalVec(vertexArray, vert, normals[n], normals[n + 1], normals[n + 2]);
		} else {
			addNormalVec(vertexArray, vert, 0.0, 0.0, 0.0);
		}

		if (t >= 0) {
			addTexCoords(vertexArray, vert, texcoords[t], texcoords[t + 1]);
		} else {
			addTexCoords(vertexArray, vert, 0.0, 0.0);
		}

		vert += jedi.Model3D.ELEMENTS_PER_VERTEX;
	}

	// Expand OBJ objects/groups into Mesh3Ds:
	var meshArray = [];
	for (o = 0; o < objects.length; ++o) {
		if (objects[o].faceCount == 0) {
			//jedi.logWarning("OBJ object/group #" + o + " has no faces! Ignoring it...");
			continue;
		}

		meshArray.push(new jedi.Mesh3D(
			objects[o].firstFace * 3, objects[o].faceCount * 3, 
			0, 0, objects[o].material, objects[o].name));
	}

	jedi.logComment("OBJ model has " + vertexCount + " vertexes, " + 
		(vertexCount / 3) + " triangles and " + objects.length + " OBJ objects/groups.");

	// Finish setting up the WebGL vertex/index buffers.
	return model.initWithData(vertexArray, null, meshArray, deriveTangents, modelName, storageHint);
};
