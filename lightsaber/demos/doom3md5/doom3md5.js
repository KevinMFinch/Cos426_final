/*
 * ================================================================================================
 * -*- JavaScript -*-
 * File: doom3md5.js
 * Author: Guilherme R. Lampert
 * Created on: 2015-05-22
 * Brief: Doom 3 MD5 mesh loading classes.
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

/*
===========================================================
DoomMd5Vertex class:
===========================================================
*/
function DoomMd5Vertex() {
	// Texture coordinates (floats):
	this.tU = 0.0;
	this.tV = 0.0;
	// Vertex weights for animation (ints):
	this.start = 0;
	this.count = 0;
}

/*
===========================================================
DoomMd5Weight class:
===========================================================
*/
function DoomMd5Weight() {
	this.joint = 0;   // int
	this.bias  = 0.0; // float
	this.pos   = vec3.create();
}

/*
===========================================================
DoomMd5Joint class:
===========================================================
*/
function DoomMd5Joint() {
	this.name        = ""; // printable name
	this.parentIndex = 0;  // int
	this.pos         = vec3.create();
	this.orient      = quat.create();
}

/*
===========================================================
DoomMd5Mesh class:
===========================================================
*/
function DoomMd5Mesh() {
	//
	// Material info:
	//  `diffuseMap`  name is baseTextureName
	//  `normalMap`   name is baseTextureName + "_local"
	//  `specularMap name is baseTextureName + "_s"
	//
	this.material = {
		baseTextureName : "",
		diffuseMap      : null,
		normalMap       : null,
		specularMap     : null
	};

	//
	// Mesh data parsed from md5mesh file:
	//
	this.vertexes = [];   // Array of DoomMd5Vertex, loaded from file
	this.weights  = [];   // Array of DoomMd5Weight, loaded from file
	this.indexes  = null; // Uint16Array

	//
	// System side buffers:
	// Hold the same data of the WebGL buffers, which is expanded from the
	// DoomMd5Vertex and DoomMd5Weight arrays. We keep a system copy for convenience.
	//
	this.vertexPositions  = null; // Float32Array[vertCount * 3]
	this.vertexUVs        = null; // Float32Array[vertCount * 2]
	this.vertexNormals    = null; // Float32Array[vertCount * 3]
	this.vertexTangents   = null; // Float32Array[vertCount * 3]
	this.vertexBitangents = null; // Float32Array[vertCount * 3]
	this.vertexColors     = null; // Float32Array[vertCount * 4]

	//
	// GL rendering data:
	//
	this.positionBuffer   = null; // WebGL Vertex Buffer for the vertex positions
	this.normalsBuffer    = null; // WebGL Vertex Buffer for the vertex normals
	this.tangentsBuffer   = null; // WebGL Vertex Buffer for the vertex tangents
	this.bitangentsBuffer = null; // WebGL Vertex Buffer for the vertex bi-tangents
	this.uvBuffer         = null; // WebGL Vertex Buffer for the vertex UVs
	this.colorBuffer      = null; // WebGL Vertex Buffer for the vertex colors (RGBA)
	this.indexBuffer      = null; // WebGL Index Buffer Object

	// Test if this mesh is valid for rendering.
	this.validForDrawing = function () {
		if (!this.positionBuffer   ||
			!this.uvBuffer         ||
			!this.normalsBuffer    ||
			!this.tangentsBuffer   ||
			!this.bitangentsBuffer ||
			!this.indexBuffer      ||
			!this.material) {
			return false;
		}
		return true;
	};
}

/*
===========================================================
DoomMd5Model class:
===========================================================
*/
function DoomMd5Model(modelName) {
	//
	// A 3D model loaded from a Doom 3 '.md5mesh' file.
	// It contains the meshes and animations that compose the model.
	//
	this.meshes           = [];    // array of DoomMd5Mesh
	this.baseSkeleton     = [];    // array of DoomMd5Joint
	this.asyncLoadPending = false; // Only set when loading from an async HTTP request.
	this.modelName        = modelName || "unnamed"; // MD5 File that originated this model or a descriptive name.
}

/*
 * ---- Methods of DoomMd5Model: ----
 */

DoomMd5Model.prototype.getName = function () { // -> String
	return this.modelName;
};

DoomMd5Model.prototype.isLoading = function () { // -> bool
	return this.asyncLoadPending;
};

DoomMd5Model.prototype.initWithData = function (modelName, textData, imgPathPrefix) { // -> bool
	if (!textData || textData == "") {
		jedi.logWarning("No MD5 model data found on source!");
		return false;
	}

	try {
		var lines = textData.split("\n"); // Split the input by lines.
		var versionNum, tokens, line, l;
		var meshesExpected = 0;
		var jointsExpected = 0;
		var currentMesh = null;

		for (l = 0; l < lines.length; ++l) {
			line = lines[l].trim();

			if (line.search("MD5Version") != -1) { // MD5Version file version (Doom 3 used v10)

				versionNum = parseInt(line.substr("MD5Version".length), 10);
				if (versionNum != 10) {
					utils.warning("Bad MD5 file version! Should be 10, got " + versionNum);
					// Continue anyway...
				}

			} else if (line.search("mesh {") != -1) { // mesh { }

				currentMesh = new DoomMd5Mesh();
				this.meshes.push(currentMesh);

			} else if (line.search("numMeshes") != -1) { // numMeshes

				meshesExpected = parseInt(line.substr("numMeshes".length), 10);

			} else if (line.search("numJoints") != -1) { // numJoints

				jointsExpected = parseInt(line.substr("numJoints".length), 10);

			} else if (line.search("numverts") != -1) { // numverts

				if (currentMesh) {
					currentMesh.vertexes.length = parseInt(line.substr("numverts".length), 10);
				}

			} else if (line.search("numtris") != -1) { // numtris

				if (currentMesh) {
					var indexCount = parseInt(line.substr("numtris".length), 10) * 3;
					currentMesh.indexes = new Uint16Array(indexCount);
				}

			} else if (line.search("numweights") != -1) { // numweights

				if (currentMesh) {
					currentMesh.weights.length = parseInt(line.substr("numweights".length), 10);
				}

			} else if (line.search("shader") != -1) { // mesh.shader (material name)

				if (currentMesh) {
					// Get string, replacing quotes by nothing.
					currentMesh.material.baseTextureName = 
						line.substr("shader".length).replace(/[\"\']/g, "").trim();
				}

			} else if (line.search("vert") != -1) { // mesh.vert
				//
				// Vertex format:
				// vert <vertex_num> ( <u> <v> ) <vert_weight> <weight_count>
				//
				if (currentMesh) {
					tokens = line.split(/[vert\(\)\s\t]+/g); // This RegExp could be a lot better...
					var dVert = new DoomMd5Vertex();

					// [0] = nothing
					//
					// [1] = vertex num
					var vertexIndex = parseInt(tokens[1], 10);
					//
					// [2] = U
					dVert.tU = parseFloat(tokens[2]);
					//
					// [3] = V
					// NOTE: The vertical direction of the texture coordinates is the inverse of the standard OpenGL
					// direction for the V coordinate. So when loading a texture we can either flip the image vertically 
					// or take the opposite of the V texture coordinate for MD5 Mesh vertexes (i.e. 1.0 - V).
					// No action is necessary if using TGA images as the ones used in game, which are stored upside-down.
					dVert.tV = parseFloat(tokens[3]);
					//
					// [4] = vertex weight
					dVert.start = parseInt(tokens[4], 10);
					//
					// [5] = vertexes affected
					dVert.count = parseInt(tokens[5], 10);

					// Store new vertex:
					currentMesh.vertexes[vertexIndex] = dVert;
				}

			} else if (line.search("tri") != -1) { // mesh.tri
				//
				// Triangle format:
				// tri <tri_num> <vert_index_0> <vert_index_1> <vert_index_2>
				//
				if (currentMesh) {
					tokens = line.split(/[tri\s\t]+/g); // Another lame RegExp...

					// [0] = nothing
					//
					// [1] = triangle index
					var triIndex = parseInt(tokens[1], 10);
					//
					// [2] = vert_index 0
					var i0 = parseInt(tokens[2], 10);
					//
					// [3] = vert_index 1
					var i1 = parseInt(tokens[3], 10);
					//
					// [4] = vert_index 2
					var i2 = parseInt(tokens[4], 10);

					// And save into the mesh's index array:
					currentMesh.indexes[(triIndex * 3) + 0] = i0;
					currentMesh.indexes[(triIndex * 3) + 1] = i1;
					currentMesh.indexes[(triIndex * 3) + 2] = i2;
				}

			} else if (line.search("weight") != -1) { // mesh.weight
				//
				// Weight line format:
				// weight <weight_index> <joint> <bias> ( <p.x> <p.y> <p.z> )
				//
				if (currentMesh) {
					tokens = line.split(/[weight\(\)\s\t]+/g); // And yet another...
					var dWeight = new DoomMd5Weight();

					// [0] = nothing
					//
					// [1] = weight index (int)
					var weightIndex = parseInt(tokens[1], 10);
					//
					// [2] = joint index (int)
					dWeight.joint = parseInt(tokens[2], 10);
					//
					// [3] = bias/weight (float)
					dWeight.bias = parseFloat(tokens[3]);
					//
					// [4,5,6] = positions (vec3)
					dWeight.pos[0] = parseFloat(tokens[4]);
					dWeight.pos[1] = parseFloat(tokens[5]);
					dWeight.pos[2] = parseFloat(tokens[6]);

					// Store it:
					currentMesh.weights[weightIndex] = dWeight;
				}

			} else if (line.search("joints {") != -1) { // joints set
				//
				// Joint format:
				// <"joint_name"> <parent_index> ( <p.x> <p.y> <p.z> ) ( <q.x> <q.y> <q.z> )
				//
				for (var n = 0; n < jointsExpected; ++n) {

					// Fetch next line:
					line = lines[++l].trim();
					if (line.charAt(0) == '}') { // Closing "joints" block?
						break;
					}

					tokens = line.split(/[\"\'\(\)\s\t]+/g);
					var dJoint = new DoomMd5Joint();
					var q = quat.create();

					// [0] = nothing
					//
					// [1] = joint_name (string)
					dJoint.name = tokens[1].trim();
					//
					// [2] = parent_index (int)
					dJoint.parentIndex = parseInt(tokens[2], 10);
					//
					// [3,4,5] = positions (vec3)
					dJoint.pos[0] = parseFloat(tokens[3]);
					dJoint.pos[1] = parseFloat(tokens[4]);
					dJoint.pos[2] = parseFloat(tokens[5]);
					//
					// [6,7,8] = orientation (quaternion)
					q[0] = parseFloat(tokens[6]);
					q[1] = parseFloat(tokens[7]);
					q[2] = parseFloat(tokens[8]);
					q[3] = 1.0;

					// Compute the w component of the quaternion 
					// and store it into `dJoint.orient`:
					quat.calculateW(dJoint.orient, q);

					// Store new joint:
					this.baseSkeleton.push(dJoint);

					// No more lines?
					if (l >= lines.length) {
						break;
					}
				}
			}
		}

		// Do some basic validation:
		if (this.meshes.length != meshesExpected) {
			jedi.logWarning("Expected " + meshesExpected +
				" meshes in MD5 file, but found " + this.meshes.length + " ...");
		}

		if (this.baseSkeleton.length != jointsExpected) {
			jedi.logWarning("Expected " + jointsExpected +
				" joints in MD5 file, but found " + this.baseSkeleton.length + " ...");
		}

		// Finally, load any textures referenced by the model:
		var imgFileName, imgFileNameExt;
		for (var m = 0; m < this.meshes.length; ++m) {
			if (this.meshes[m].material.baseTextureName == "") {
				continue;
			}

			if (imgPathPrefix) {
				imgFileName = imgPathPrefix + this.meshes[m].material.baseTextureName;
			} else {
				imgFileName = this.meshes[m].material.baseTextureName;
			}

			if (imgFileName.lastIndexOf(".") == -1) {
				// Append default file extension if needed.
				// (Doom 3 used TGA images for most textures).
				imgFileNameExt = ".tga";
			} else {
				imgFileNameExt = "";
			}

			// Fetch the set of diffuse/normal/specular textures:
			//  '_local' is the normal map
			//  '_s'     is the specular map
			this.meshes[m].material.diffuseMap  = jedi.ResourceManager.findTexture(imgFileName + imgFileNameExt);
			this.meshes[m].material.normalMap   = jedi.ResourceManager.findTexture(imgFileName + "_local" + imgFileNameExt);
			this.meshes[m].material.specularMap = jedi.ResourceManager.findTexture(imgFileName + "_s" + imgFileNameExt);
		}

		if (modelName) {
			this.modelName = modelName;
		}

		this.updateGpuBuffers();
		jedi.Renderer.checkErrors();
		return true;

	} catch (except) {
		jedi.logError("Failed to load MD5 model from text data! Uncaught exception: '" + except + "'");
		return false;
	}
};

DoomMd5Model.prototype.initAsyncFromFile = function (modelFileName, completionCallback, imgPathPrefix) { // -> bool
	jedi.assert(modelFileName, "Null filename!");

	// Nested helper function that fires the asynchronous file request.
	//
	var startDownload = function (url, completionHandler) {
		jedi.logComment("Trying to load MD5 model file '" + url + "' asynchronously...");
		var reqHandler = function () {
			if (this.status == 200 && this.responseText != null) {
				jedi.logComment("MD5 model file '" + url + "' loaded!");
				completionHandler(this.responseText);
			} else {
				// Something went wrong...
				jedi.logWarning("Failed to load MD5 model file '" + url + "'. Status: " + this.status);
				completionHandler(null);
			}
		};
		var xmlHttpReq = new XMLHttpRequest();
		xmlHttpReq.onload = reqHandler;
		xmlHttpReq.open(/* method = */ "GET", /* path = */ url, /* async = */ true);
		xmlHttpReq.send();
	};

	this.asyncLoadPending = true;
	var modelRef = this;

	// Fetch the file contents:
	//
	startDownload(modelFileName,
		function (fileContents) {
			if (fileContents) {
				var success = modelRef.initWithData(modelFileName, fileContents, imgPathPrefix);
				modelRef.asyncLoadPending = false;
				if (completionCallback) {
					completionCallback((success ? modelRef : null),
						(success ? "Successfully initialized MD5 model '" + modelRef.getName() + "'" :
							"Failed to initialize MD5 model '" + modelRef.getName() + "'!"));
				}
			} else {
				modelRef.asyncLoadPending = false;
				if (completionCallback) {
					completionCallback(null, "Failed to load MD5 model file '" + modelFileName + "'!");
				}
			}
		});

	// No way to validate if the request was successful right now.
	// Must wait until it completes.
	return true;
};

DoomMd5Model.prototype.updateGpuBuffers = function (webGLBufferUsage, skeleton) { // -> void

	var gl = jedi.Renderer.getWebGLContext();

	if (!webGLBufferUsage) {
		webGLBufferUsage = gl.STATIC_DRAW;
	}

	for (var m = 0; m < this.meshes.length; ++m) {
		var mesh = this.meshes[m];

		this.buildMeshVertexesAndUVs(mesh, (!skeleton) ? this.baseSkeleton : skeleton);
		this.deriveNormalsAndTangents(mesh);

		// Create buffers for the first time if needed:
		//
		if (!mesh.positionBuffer && mesh.vertexPositions) {
			mesh.positionBuffer = gl.createBuffer();
		}

		if (!mesh.normalsBuffer && mesh.vertexNormals) {
			mesh.normalsBuffer = gl.createBuffer();
		}

		if (!mesh.tangentsBuffer && mesh.vertexTangents) {
			mesh.tangentsBuffer = gl.createBuffer();
		}

		if (!mesh.bitangentsBuffer && mesh.vertexBitangents) {
			mesh.bitangentsBuffer = gl.createBuffer();
		}

		if (!mesh.uvBuffer && mesh.vertexUVs) {
			mesh.uvBuffer = gl.createBuffer();
		}

		if (!mesh.colorBuffer && mesh.vertexColors) {
			mesh.colorBuffer = gl.createBuffer();
		}

		if (!mesh.indexBuffer && mesh.indexes) {
			mesh.indexBuffer = gl.createBuffer();
		}

		// Upload vertexes to GL:
		if (mesh.positionBuffer) {
			gl.bindBuffer(gl.ARRAY_BUFFER, mesh.positionBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, mesh.vertexPositions, webGLBufferUsage);
		}

		// Upload vertex normals to GL:
		if (mesh.normalsBuffer) {
			gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normalsBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, mesh.vertexNormals, webGLBufferUsage);
		}

		// Upload tangents to GL:
		if (mesh.tangentsBuffer) {
			gl.bindBuffer(gl.ARRAY_BUFFER, mesh.tangentsBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, mesh.vertexTangents, webGLBufferUsage);
		}

		// Upload bi-tangents to GL:
		if (mesh.bitangentsBuffer) {
			gl.bindBuffer(gl.ARRAY_BUFFER, mesh.bitangentsBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, mesh.vertexBitangents, webGLBufferUsage);
		}

		// Upload UVs to GL:
		if (mesh.uvBuffer) {
			gl.bindBuffer(gl.ARRAY_BUFFER, mesh.uvBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, mesh.vertexUVs, webGLBufferUsage);
		}

		// Upload vertex color to GL:
		if (mesh.colorBuffer) {
			gl.bindBuffer(gl.ARRAY_BUFFER, mesh.colorBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, mesh.vertexColors, webGLBufferUsage);
		}

		// Upload indexes to GL:
		//  NOTE: OpenGL-ES and WebGL don't support 32bit indexing, so the data type 
		//  here must be either Uint16Array or Uint8Array. For the gl.drawElements() call, 
		//  the type must be UNSIGNED_SHORT or UNSIGNED_BYTE. In this case we have hardcoded 
		//  to Uint16Array. Also assume that the mesh is always indexed.
		//
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indexes, webGLBufferUsage);
	}

	// Cleanup:
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
};

DoomMd5Model.prototype.drawModel = function (shaderProgram, renderWireframe, 
                                             viewNormalMap, viewSpecularMap) { // -> void

	for (var m = 0; m < this.meshes.length; ++m) {
		this.drawMesh(this.meshes[m], shaderProgram, 
			renderWireframe, viewNormalMap, viewSpecularMap);
	}
};

DoomMd5Model.prototype.drawMesh = function (mesh, shaderProgram, renderWireframe, 
                                            viewNormalMap, viewSpecularMap) { // -> void

	jedi.assert(mesh, "Null MD5 mesh!");

	if (!shaderProgram) {
		shaderProgram = jedi.ShaderProgram.getDefault();
	}

	if (!shaderProgram.isBound()) {
		shaderProgram.bind();
	}

	var gl = jedi.Renderer.getWebGLContext();
	var positionAttribIndex  = shaderProgram.getVertexAttribIndex("a_position");
	var normalAttribIndex    = shaderProgram.getVertexAttribIndex("a_normal");
	var tangentAttribIndex   = shaderProgram.getVertexAttribIndex("a_tangent");
	var bitangentAttribIndex = shaderProgram.getVertexAttribIndex("a_bitangent");
	var texcoordAttribIndex  = shaderProgram.getVertexAttribIndex("a_texcoords");
	var colorAttribIndex     = shaderProgram.getVertexAttribIndex("a_color");

	// Vertex positions buffer:
	if (mesh.positionBuffer) {
		gl.bindBuffer(gl.ARRAY_BUFFER, mesh.positionBuffer);
		gl.enableVertexAttribArray(positionAttribIndex);
		gl.vertexAttribPointer(positionAttribIndex, 3, gl.FLOAT, false, 0, 0);
	}

	// Vertex normals buffer:
	if (mesh.normalsBuffer) {
		gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normalsBuffer);
		gl.enableVertexAttribArray(normalAttribIndex);
		gl.vertexAttribPointer(normalAttribIndex, 3, gl.FLOAT, false, 0, 0);
	}

	// Tangents buffer:
	if (mesh.tangentsBuffer) {
		gl.bindBuffer(gl.ARRAY_BUFFER, mesh.tangentsBuffer);
		gl.enableVertexAttribArray(tangentAttribIndex);
		gl.vertexAttribPointer(tangentAttribIndex, 3, gl.FLOAT, false, 0, 0);
	}

	// Bi-tangents buffer:
	if (mesh.bitangentsBuffer) {
		gl.bindBuffer(gl.ARRAY_BUFFER, mesh.bitangentsBuffer);
		gl.enableVertexAttribArray(bitangentAttribIndex);
		gl.vertexAttribPointer(bitangentAttribIndex, 3, gl.FLOAT, false, 0, 0);
	}

	// UV buffer:
	if (mesh.uvBuffer) {
		gl.bindBuffer(gl.ARRAY_BUFFER, mesh.uvBuffer);
		gl.enableVertexAttribArray(texcoordAttribIndex);
		gl.vertexAttribPointer(texcoordAttribIndex, 2, gl.FLOAT, false, 0, 0);
	}

	// Vertex color buffer:
	if (mesh.colorBuffer) {
		gl.bindBuffer(gl.ARRAY_BUFFER, mesh.colorBuffer);
		gl.enableVertexAttribArray(colorAttribIndex);
		gl.vertexAttribPointer(colorAttribIndex, 4, gl.FLOAT, false, 0, 0);
	}

	// Bind index buffer:
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);

	if (viewNormalMap) {
		// Bind the NORMAL texture to the diffuse texture slot instead.
		if (mesh.material.normalMap && shaderProgram.hasUniformVar("u_diffuse_texture")) {
			mesh.material.normalMap.bind(jedi.Material.DIFFUSE_MAP_TMU);
			shaderProgram.setUniform1i("u_diffuse_texture", jedi.Material.DIFFUSE_MAP_TMU);
		}
	} else if (viewSpecularMap) {
		// Bind the SPECULAR texture to the diffuse texture slot instead.
		if (mesh.material.specularMap && shaderProgram.hasUniformVar("u_diffuse_texture")) {
			mesh.material.specularMap.bind(jedi.Material.DIFFUSE_MAP_TMU);
			shaderProgram.setUniform1i("u_diffuse_texture", jedi.Material.DIFFUSE_MAP_TMU);
		}
	} else {
		// DIFFUSE_MAP Texture:
		if (mesh.material.diffuseMap && shaderProgram.hasUniformVar("u_diffuse_texture")) {
			mesh.material.diffuseMap.bind(jedi.Material.DIFFUSE_MAP_TMU);
			shaderProgram.setUniform1i("u_diffuse_texture", jedi.Material.DIFFUSE_MAP_TMU);
		}
		// NORMAL_MAP Texture:
		if (mesh.material.normalMap && shaderProgram.hasUniformVar("u_normal_texture")) {
			mesh.material.normalMap.bind(jedi.Material.NORMAL_MAP_TMU);
			shaderProgram.setUniform1i("u_normal_texture", jedi.Material.NORMAL_MAP_TMU);
		}
		// SPECULAR_MAP Texture:
		if (mesh.material.specularMap && shaderProgram.hasUniformVar("u_specular_texture")) {
			mesh.material.specularMap.bind(jedi.Material.SPECULAR_MAP_TMU)
			shaderProgram.setUniform1i("u_specular_texture", jedi.Material.SPECULAR_MAP_TMU);
		}
	}

	// "rp" is a renderer parameter.
	if (shaderProgram.hasUniformVar("u_rp_mvp_matrix")) {
		shaderProgram.setUniformMatrix4x4("u_rp_mvp_matrix", jedi.Renderer.getMvpMatrix());
	}
	if (shaderProgram.hasUniformVar("u_rp_model_matrix")) {
		shaderProgram.setUniformMatrix4x4("u_rp_model_matrix", jedi.Renderer.getModelMatrix());
	}
	if (shaderProgram.hasUniformVar("u_rp_inverse_model_matrix")) {
		shaderProgram.setUniformMatrix4x4("u_rp_inverse_model_matrix", jedi.Renderer.getInvModelMatrix());
	}
	if (shaderProgram.hasUniformVar("u_rp_world_space_eye")) {
		shaderProgram.setUniformVec4("u_rp_world_space_eye", jedi.Renderer.getEyePosition());
	}

	// Issue the draw call:
	gl.drawElements((renderWireframe ? gl.LINES : jedi.Renderer.getWebGLRenderMode()),
			mesh.indexes.length, gl.UNSIGNED_SHORT, 0);

	// Cleanup:
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
};

DoomMd5Model.prototype.buildMeshVertexesAndUVs = function (mesh, skeleton) { // -> void

	if (!mesh || !skeleton || !mesh.vertexes || !mesh.weights) {
		utils.warning("Invalid arguments for 'DoomMd5Model.buildMeshVertexesAndUVs()'!");
		return;
	}

	var vertCount    = mesh.vertexes.length;
	var finalVertex  = vec3.create();
	var weightedVert = vec3.create();
	var dWeight, dJoint, v, w;

	mesh.vertexPositions = new Float32Array(vertCount * 3);
	mesh.vertexUVs       = new Float32Array(vertCount * 2);

	// Build GL renderable vertex and UV buffers from the skeleton data for a given mesh.
	for (v = 0; v < vertCount; ++v) {
		finalVertex[0] = 0.0;
		finalVertex[1] = 0.0;
		finalVertex[2] = 0.0;

		// Calculate final vertex to draw with weights taken into account:
		for (w = 0; w < mesh.vertexes[v].count; ++w) {
			dWeight = mesh.weights[mesh.vertexes[v].start + w];
			dJoint  = skeleton[dWeight.joint];

			// Calculate transformed vertex for this weight:			
			vec3.transformQuat(weightedVert, dWeight.pos, dJoint.orient);
			finalVertex[0] += (dJoint.pos[0] + weightedVert[0]) * dWeight.bias;
			finalVertex[1] += (dJoint.pos[1] + weightedVert[1]) * dWeight.bias;
			finalVertex[2] += (dJoint.pos[2] + weightedVert[2]) * dWeight.bias;
		}

		// Add to output, breaking the vec3 into three floats.
		// Also swizzles y/z. idSoftware historically used this different axis layout.
		mesh.vertexPositions[(v * 3) + 0] = finalVertex[0];
		mesh.vertexPositions[(v * 3) + 1] = finalVertex[2];
		mesh.vertexPositions[(v * 3) + 2] = finalVertex[1];

		// Add texture coordinates:
		mesh.vertexUVs[(v * 2) + 0] = mesh.vertexes[v].tU;
		mesh.vertexUVs[(v * 2) + 1] = mesh.vertexes[v].tV;
	}
};

DoomMd5Model.prototype.deriveNormalsAndTangents = function (mesh) { // -> void
	//
	// Derives the normal and orthogonal tangent vectors for the mesh vertexes.
	// For each vertex the normal and tangent vectors are derived from all triangles
	// using the vertex which results in smooth tangents across the mesh.
	//
	// Based almost entirely on `R_DeriveNormalsAndTangents()` from Doom 3 BFG:
	// See: https://github.com/id-Software/DOOM-3-BFG/blob/master/neo/renderer/tr_trisurf.cpp#L901
	//

	if (!mesh || !mesh.vertexPositions || !mesh.vertexUVs || !mesh.indexes) {
		jedi.logWarning("Invalid arguments for 'DoomMd5Model.deriveNormalsAndTangents()'!");
		return;
	}

	var signf = function (x) {
		return (x > 0.0) ? 1 : (x < 0.0) ? -1 : 0;
	};

	var vertCount   = mesh.vertexes.length;
	var indexeCount = mesh.indexes.length;

	var vertexNormals    = new Float32Array(vertCount * 3); // 3 floats per normal
	var vertexTangents   = new Float32Array(vertCount * 3); // 3 floats per tangent
	var vertexBitangents = new Float32Array(vertCount * 3); // 3 floats per bi-tangent

	var d0        = new Float32Array(5);
	var d1        = new Float32Array(5);
	var normal    = vec3.create();
	var tangent   = vec3.create();
	var bitangent = vec3.create();
	var v, i;

	for (i = 0; i < indexeCount; i += 3) {

		var v0 = mesh.indexes[i + 0];
		var v1 = mesh.indexes[i + 1];
		var v2 = mesh.indexes[i + 2];

		var aX = mesh.vertexPositions[(v0 * 3) + 0];
		var aY = mesh.vertexPositions[(v0 * 3) + 1];
		var aZ = mesh.vertexPositions[(v0 * 3) + 2];

		var bX = mesh.vertexPositions[(v1 * 3) + 0];
		var bY = mesh.vertexPositions[(v1 * 3) + 1];
		var bZ = mesh.vertexPositions[(v1 * 3) + 2];

		var cX = mesh.vertexPositions[(v2 * 3) + 0];
		var cY = mesh.vertexPositions[(v2 * 3) + 1];
		var cZ = mesh.vertexPositions[(v2 * 3) + 2];

		var aU = mesh.vertexUVs[(v0 * 2) + 0];
		var aV = mesh.vertexUVs[(v0 * 2) + 1];

		var bU = mesh.vertexUVs[(v1 * 2) + 0];
		var bV = mesh.vertexUVs[(v1 * 2) + 1];

		var cU = mesh.vertexUVs[(v2 * 2) + 0];
		var cV = mesh.vertexUVs[(v2 * 2) + 1];

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
		var areaSign = signf(area);

		// ---- Normal: ----
		normal[0] = d1[1] * d0[2] - d1[2] * d0[1];
		normal[1] = d1[2] * d0[0] - d1[0] * d0[2];
		normal[2] = d1[0] * d0[1] - d1[1] * d0[0];
		// Normalize:
		var f0 = 1.0 / Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]);
		normal[0] *= f0;
		normal[1] *= f0;
		normal[2] *= f0;

		// Had to flip the normal direction.
		// This was not in the original D3 code.
		// Is this necessary because they use a different texture
		// and axis setup?
		normal[0] *= -1.0;
		normal[1] *= -1.0;
		normal[2] *= -1.0;

		// ---- Tangent: ----
		tangent[0] = d0[0] * d1[4] - d0[4] * d1[0];
		tangent[1] = d0[1] * d1[4] - d0[4] * d1[1];
		tangent[2] = d0[2] * d1[4] - d0[4] * d1[2];
		// Normalize:
		var f1 = 1.0 / Math.sqrt(tangent[0] * tangent[0] + tangent[1] * tangent[1] + tangent[2] * tangent[2]);
		if (areaSign == signf(f1))
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

		// ---- Bi-tangent: ----
		bitangent[0] = d0[3] * d1[0] - d0[0] * d1[3];
		bitangent[1] = d0[3] * d1[1] - d0[1] * d1[3];
		bitangent[2] = d0[3] * d1[2] - d0[2] * d1[3];
		// Normalize:
		var f2 = 1.0 / Math.sqrt(bitangent[0] * bitangent[0] + bitangent[1] * bitangent[1] + bitangent[2] * bitangent[2]);
		if (areaSign == signf(f2))
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

		// ---- Average the results: ----

		vertexNormals[(v0 * 3) + 0] += normal[0];
		vertexNormals[(v0 * 3) + 1] += normal[1];
		vertexNormals[(v0 * 3) + 2] += normal[2];
		vertexNormals[(v1 * 3) + 0] += normal[0];
		vertexNormals[(v1 * 3) + 1] += normal[1];
		vertexNormals[(v1 * 3) + 2] += normal[2];
		vertexNormals[(v2 * 3) + 0] += normal[0];
		vertexNormals[(v2 * 3) + 1] += normal[1];
		vertexNormals[(v2 * 3) + 2] += normal[2];

		vertexTangents[(v0 * 3) + 0] += tangent[0];
		vertexTangents[(v0 * 3) + 1] += tangent[1];
		vertexTangents[(v0 * 3) + 2] += tangent[2];
		vertexTangents[(v1 * 3) + 0] += tangent[0];
		vertexTangents[(v1 * 3) + 1] += tangent[1];
		vertexTangents[(v1 * 3) + 2] += tangent[2];
		vertexTangents[(v2 * 3) + 0] += tangent[0];
		vertexTangents[(v2 * 3) + 1] += tangent[1];
		vertexTangents[(v2 * 3) + 2] += tangent[2];

		vertexBitangents[(v0 * 3) + 0] += bitangent[0];
		vertexBitangents[(v0 * 3) + 1] += bitangent[1];
		vertexBitangents[(v0 * 3) + 2] += bitangent[2];
		vertexBitangents[(v1 * 3) + 0] += bitangent[0];
		vertexBitangents[(v1 * 3) + 1] += bitangent[1];
		vertexBitangents[(v1 * 3) + 2] += bitangent[2];
		vertexBitangents[(v2 * 3) + 0] += bitangent[0];
		vertexBitangents[(v2 * 3) + 1] += bitangent[1];
		vertexBitangents[(v2 * 3) + 2] += bitangent[2];
	}

	// Project the summed vectors onto the normal plane and normalize.
	// The tangent vectors will not necessarily be orthogonal to each
	// other, but they will be orthogonal to the surface normal.
	for (i = 0; i < vertCount; ++i) {

		var ix = (i * 3) + 0;
		var iy = (i * 3) + 1;
		var iz = (i * 3) + 2;

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

	// Save new stuff back into the mesh object:
	mesh.vertexNormals    = vertexNormals;
	mesh.vertexTangents   = vertexTangents;
	mesh.vertexBitangents = vertexBitangents;

	// Lastly, set vertex colors.
	// NOTE: At the moment, hardcoded to white!
	//
	mesh.vertexColors = new Float32Array(vertCount * 4); // RGBA
	for (v = 0; v < vertCount; ++v) {
		mesh.vertexColors[(v * 4) + 0] = 1.0;
		mesh.vertexColors[(v * 4) + 1] = 1.0;
		mesh.vertexColors[(v * 4) + 2] = 1.0;
		mesh.vertexColors[(v * 4) + 3] = 1.0;
	}
};

DoomMd5Model.prototype.addDebugTangentBasis = function (scale) { // -> void
	if (scale === undefined || scale === null) {
		scale = 1.0;
	}

	// Adds debug lines for the tangent basis (normal, tangent and bi-tangent).
	var addTBN = function(origin, t, b, n) {
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

	// Add for all meshes in this model:
	for (var m = 0; m < this.meshes.length; ++m) {
		var mesh = this.meshes[m];

		var vertCount = mesh.vertexes.length;
		for (var v = 0; v < vertCount; ++v) {

			var vx = (v * 3) + 0;
			var vy = (v * 3) + 1;
			var vz = (v * 3) + 2;

			var p = [ mesh.vertexPositions [vx], mesh.vertexPositions [vy], mesh.vertexPositions [vz] ];
			var t = [ mesh.vertexTangents  [vx], mesh.vertexTangents  [vy], mesh.vertexTangents  [vz] ];
			var b = [ mesh.vertexBitangents[vx], mesh.vertexBitangents[vy], mesh.vertexBitangents[vz] ];
			var n = [ mesh.vertexNormals   [vx], mesh.vertexNormals   [vy], mesh.vertexNormals   [vz] ];

			addTBN(p, t, b, n);
		}
	}
};
