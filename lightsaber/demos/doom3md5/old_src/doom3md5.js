
// ================================================================================================
// -*- JavaScript -*-
// File: Doom3MD5.js
// Author: Guilherme R. Lampert
// Created on: 2014-05-07
// Brief: Classes and data structures to support loading and rendering of Doom 3 MD5 models.
// ================================================================================================

"use strict";

// =============================================
// MD5 Vertex class:
// =============================================

function DoomMD5Vertex() {

	// Texture coords (floats):
	this.tU = 0.0;
	this.tV = 0.0;

	this.start = 0; // Start weight (int)
	this.count = 0; // Weight count (int)
}

// =============================================
// MD5 Vertex weight class:
// =============================================

function DoomMD5Weight() {

	this.joint = 0;   // int
	this.bias  = 0.0; // float
	this.pos   = vec3.create([0.0, 0.0, 0.0]);
}

// =============================================
// MD5 Mesh Joint
// =============================================

function DoomMD5Joint() {

	this.name        = ""; // printable name
	this.parentIndex = 0;  // int
	this.pos         = vec3.create([0.0, 0.0, 0.0]);
	this.orient      = quat4.create([0.0, 0.0, 0.0, 1.0]);
}

// =============================================
// MD5 Mesh class:
// =============================================

function DoomMD5Mesh() {

	// Material info:
	// diffuseMap  name is baseTextureName
	// normalMap   name is baseTextureName + _local
	// specularMap name is baseTextureName + _s
	this.material = {
		baseTextureName : "",
		diffuseMap      : null,
		normalMap       : null,
		specularMap     : null
	};

	// Mesh data parsed from md5mesh file:
	this.vertexes = []; // Array of DoomMD5Vertex, loaded from file
	this.indexes  = []; // Array of int, loaded from file
	this.weights  = []; // Array of DoomMD5Weight, loaded from file

	// System side buffers:
	// Hold the same data of the WebGL buffers, which is expanded
	// from the DoomMD5Vertex and DoomMD5Weight arrays. We keep a system copy for convenience.
	this.vertexPositions  = null; // Float32Array[numVerts * 3]
	this.vertexUVs        = null; // Float32Array[numVerts * 2]
	this.vertexNormals    = null; // Float32Array[numVerts * 3]
	this.vertexTangents   = null; // Float32Array[numVerts * 3]
	this.vertexBitangents = null; // Float32Array[numVerts * 3]

	// GL rendering data:
	this.positionBuffer   = null; // WebGL Vertex Buffer for the vertex positions
	this.normalsBuffer    = null; // WebGL Vertex Buffer for the vertex normals
	this.tangentsBuffer   = null; // WebGL Vertex Buffer for the vertex tangents
	this.bitangentsBuffer = null; // WebGL Vertex Buffer for the vertex bi-tangents
	this.uvBuffer         = null; // WebGL Vertex Buffer for the vertex UVs
	this.indexBuffer      = null; // WebGL Index Buffer Object

	// Test if this mesh is valid for rendering.
	this.validForDrawing = function() {
		if (!this.positionBuffer || !this.uvBuffer || !this.normalsBuffer ||
			!this.tangentsBuffer || !this.bitangentsBuffer || !this.indexBuffer || !this.material)
		{
			return (false);
		}
		else
		{
			return (true);
		}
	}
}

// =============================================
// Doom3 MD5 Model class:
// =============================================

//
// class DoomMD5Model -- A 3D model loaded from a Doom 3 .md5mesh file.
// It contains the meshes and animations that compose the model.
//
function DoomMD5Model() {

	this.modelName    = ""; // MD5 File that originated this model or a descriptive name.
	this.meshes       = []; // array of DoomMD5Mesh
	this.baseSkeleton = []; // array of DoomMD5Joint
}

// ---- Methods of DoomMD5Model: ----

// Loads a model from a text source.
DoomMD5Model.prototype.loadFromString = function(mdlName, textData) {

	if (!textData || textData == "")
	{
		utils.warning("No MD5 model data found on source!");
		return (false);
	}

	try {

		// Split the input by lines:
		var lines = textData.split("\n");

		// Temps:
		var meshesExpected = 0;
		var jointsExpected = 0;
		var currentMesh = null;

		// Parse each line...
		for (var l = 0; l < lines.length; ++l)
		{
			var line = lines[l].trim();

			if (line.search("MD5Version") != -1) // MD5Version file version (Doom3 used v10)
			{
				var versionNum = parseInt(line.substr(("MD5Version").length), 10);
				if (versionNum != 10)
				{
					utils.warning("Bad MD5 file version! Should be 10, got " + versionNum);
					// Continue anyway...
				}
			}
			else if (line.search("mesh {") != -1) // mesh { }
			{
				currentMesh = new DoomMD5Mesh();
				this.meshes.push(currentMesh);
			}
			else if (line.search("numMeshes") != -1) // numMeshes
			{
				meshesExpected = parseInt(line.substr(("numMeshes").length), 10);
			}
			else if (line.search("numJoints") != -1) // numJoints
			{
				jointsExpected = parseInt(line.substr(("numJoints").length), 10);
			}
			else if (line.search("numverts") != -1) // numverts
			{
				if (currentMesh)
				{
					currentMesh.vertexes.length = parseInt(line.substr(("numverts").length), 10);
				}
			}
			else if (line.search("numtris") != -1) // numtris
			{
				if (currentMesh)
				{
					currentMesh.indexes.length = (parseInt(line.substr(("numtris").length), 10) * 3);
				}
			}
			else if (line.search("numweights") != -1) // numweights
			{
				if (currentMesh)
				{
					currentMesh.weights.length = parseInt(line.substr(("numweights").length), 10);
				}
			}
			else if (line.search("shader") != -1) // mesh.shader
			{
				if (currentMesh)
				{
					// Get string, replacing quotes by nothing:
					currentMesh.material.baseTextureName = line.substr(("shader").length).replace(/[\"\']/g, "").trim();
				}
			}
			else if (line.search("vert") != -1) // mesh.vert
			{
				// Vertex format:
				// vert <vertex_num> ( <u> <v> ) <vert_weight> <weight_count>
				//
				if (currentMesh)
				{
					var tokens = line.split(/[vert\(\)\s\t]+/g); // This RegExp could be a lot better...
					var dVert  = new DoomMD5Vertex();

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
					// direction for the V coordinate. So when loading a texture we'd have to flip it vertically or
                    // take the opposite of the V texture coordinate for MD5 Mesh vertexes (i.e. 1.0 - V).
					dVert.tV = 1.0 - parseFloat(tokens[3]);
					//
					// [4] = vertex weight
					dVert.start = parseInt(tokens[4], 10);
					//
					// [5] = vertexes affected
					dVert.count = parseInt(tokens[5], 10);

					// Store new vertex:
					currentMesh.vertexes[vertexIndex] = dVert;
				}
			}
			else if (line.search("tri") != -1) // mesh.tri
			{
				// Triangle format:
				// tri <tri_num> <vert_index_0> <vert_index_1> <vert_index_2>
				//
				if (currentMesh)
				{
					var tokens = line.split(/[tri\s\t]+/g); // Another poor RegExp...

					// [0] = nothing
					//
					// [1] = tri index
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
					currentMesh.indexes[triIndex * 3 + 0] = i0;
					currentMesh.indexes[triIndex * 3 + 1] = i1;
					currentMesh.indexes[triIndex * 3 + 2] = i2;
				}
			}
			else if (line.search("weight") != -1) // mesh.weight
			{
				// Weight line format:
				// weight <weight_index> <joint> <bias> ( <p.x> <p.y> <p.z> )
				//
				if (currentMesh)
				{
					var tokens  = line.split(/[weight\(\)\s\t]+/g); // And yet another...
					var dWeight = new DoomMD5Weight();

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
					vec3.set([parseFloat(tokens[4]), parseFloat(tokens[5]), parseFloat(tokens[6])], dWeight.pos);

					// Store it:
					currentMesh.weights[weightIndex] = dWeight;
				}
			}
			else if (line.search("joints {") != -1) // joints { }
			{
				// Joint format:
				// <"joint_name"> <parent_index> ( <p.x> <p.y> <p.z> ) ( <q.x> <q.y> <q.z> )
				//
				for (var n = 0; n < jointsExpected; ++n)
				{
					// Fetch next line:
					line = lines[++l].trim();
					if (line.charAt(0) == '}') // Closing "joints" block?
					{
						break;
					}

					var tokens = line.split(/[\"\'\(\)\s\t]+/g);
					var dJoint = new DoomMD5Joint();
					var q = quat4.create([0.0, 0.0, 0.0, 1.0]);

					// [0] = nothing
					//
					// [1] = joint_name (string)
					dJoint.name = tokens[1].trim();
					//
					// [2] = parent_index (int)
					dJoint.parentIndex = parseInt(tokens[2], 10);
					//
					// [3,4,5] = positions (vec3)
					vec3.set([parseFloat(tokens[3]), parseFloat(tokens[4]), parseFloat(tokens[5])], dJoint.pos);
					//
					// [6,7,8] = orientation (quaternion)
					quat4.set([parseFloat(tokens[6]), parseFloat(tokens[7]), parseFloat(tokens[8]), 1.0], q);

					// Compute the w component of the quaternion and store it into 'dJoint.orient':
					quat4.calculateW(q, dJoint.orient);

					// Store it:
					this.baseSkeleton.push(dJoint);

					// No more lines?
					if (l >= lines.length)
					{
						break;
					}
				}
			}
		}

		// Do some basic validation:
		if (this.meshes.length != meshesExpected)
		{
			utils.warning("Expected " + meshesExpected +
				" meshes in MD5 file, but found " + this.meshes.length + " ...");
		}
		if (this.baseSkeleton.length != jointsExpected)
		{
			utils.warning("Expected " + jointsExpected +
				" joints in MD5 file, but found " + this.baseSkeleton.length + " ...");
		}

		// Finally, load any textures referenced by the model:
		for (var m = 0; m < this.meshes.length; ++m)
		{
			if (this.meshes[m].material.baseTextureName == "")
			{
				continue;
			}

			var imgFileNameExt = "";
			var imgFileName = this.meshes[m].material.baseTextureName;

			if (imgFileName.lastIndexOf(".") == -1)
			{
				// Append default file extension if needed (Doom3 used TGA for most textures):
				imgFileNameExt = ".tga";
			}

			// Load the set of diffuse/normal/spec textures:
			this.meshes[m].material.diffuseMap  = utils.loadTextureFromFile(imgFileName + imgFileNameExt, true);
			this.meshes[m].material.normalMap   = utils.loadTextureFromFile(imgFileName + "_local" + imgFileNameExt, true);
			this.meshes[m].material.specularMap = utils.loadTextureFromFile(imgFileName + "_s" + imgFileNameExt, true);
		}

		// All went OK...
		this.modelName = mdlName;
		return (true);

	} catch (e) {

		utils.error("Failed to load MD5 model from text data! Uncaught exception: " + e);
		return (false);
	}
};

// Loads a model from an .md5 file.
DoomMD5Model.prototype.loadFromFile = function(filename, async) {

	if (!filename)
	{
		utils.warning("Missing model filename!");
		return (false);
	}

	var success = false;
	var sender  = this;
	function reqListener() {
		success = sender.loadFromString(filename, this.responseText);
	};

	// Very basic (synchronous) HTTP request to get the file contents.
	var request = new XMLHttpRequest();
	request.onload = reqListener;
	request.open(/* method = */ "GET", /* url = */ filename, /* asynchronous = */ async);
	request.send();

	return (success);
};

// Draws a single mesh of the model.
DoomMD5Model.prototype.drawMesh = function(mesh, shaderProgram) {

	// Param validation:
	if (!mesh || !mesh.validForDrawing() || !shaderProgram || !shaderProgram.vertexAttributes)
	{
		utils.warning("Invalid arguments for DoomMD5Model.drawMesh()!");
		return;
	}

	// Shortcut variable for our WebGL singleton:
	var gl = utils.gl;

	//
	// Bind buffers:
	//

	// Position buffer:
	gl.bindBuffer(gl.ARRAY_BUFFER, mesh.positionBuffer);
	gl.enableVertexAttribArray(shaderProgram.vertexAttributes.vertexPosition);
	gl.vertexAttribPointer(shaderProgram.vertexAttributes.vertexPosition, 3, gl.FLOAT, false, 0, 0);

	// Vertex normals buffer:
	gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normalsBuffer);
	gl.enableVertexAttribArray(shaderProgram.vertexAttributes.vertexNormal);
	gl.vertexAttribPointer(shaderProgram.vertexAttributes.vertexNormal, 3, gl.FLOAT, false, 0, 0);

	// Tangents buffer:
	gl.bindBuffer(gl.ARRAY_BUFFER, mesh.tangentsBuffer);
	gl.enableVertexAttribArray(shaderProgram.vertexAttributes.vertexTangent);
	gl.vertexAttribPointer(shaderProgram.vertexAttributes.vertexTangent, 3, gl.FLOAT, false, 0, 0);

	// Bi-tangents buffer:
	gl.bindBuffer(gl.ARRAY_BUFFER, mesh.bitangentsBuffer);
	gl.enableVertexAttribArray(shaderProgram.vertexAttributes.vertexBitangent);
	gl.vertexAttribPointer(shaderProgram.vertexAttributes.vertexBitangent, 3, gl.FLOAT, false, 0, 0);

	// UV buffer:
	gl.bindBuffer(gl.ARRAY_BUFFER, mesh.uvBuffer);
	gl.enableVertexAttribArray(shaderProgram.vertexAttributes.texCoords);
	gl.vertexAttribPointer(shaderProgram.vertexAttributes.texCoords, 2, gl.FLOAT, false, 0, 0);

	// Bind index buffer:
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);

	//
	// Bind textures, if any:
	//

	// Texture unit 0: DIFFUSE
	if (mesh.material.diffuseMap && mesh.material.diffuseMap.glTextureObject)
	{
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, mesh.material.diffuseMap.glTextureObject);
		gl.uniform1i(shaderProgram.uniforms.diffuseMap, 0);
	}
	// Texture unit 1: NORMAL
	if (mesh.material.normalMap && mesh.material.normalMap.glTextureObject)
	{
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, mesh.material.normalMap.glTextureObject);
		gl.uniform1i(shaderProgram.uniforms.normalMap, 1);
	}
	// Texture unit 2: SPECULAR
	if (mesh.material.specularMap && mesh.material.specularMap.glTextureObject)
	{
		gl.activeTexture(gl.TEXTURE2);
		gl.bindTexture(gl.TEXTURE_2D, mesh.material.specularMap.glTextureObject);
		gl.uniform1i(shaderProgram.uniforms.specularMap, 2);
	}

	// Perform draw call:
	gl.drawElements(gl.TRIANGLES, mesh.indexes.length, gl.UNSIGNED_SHORT, 0);

	// Unbid buffers:
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
};

// Draw all meshes of the model.
DoomMD5Model.prototype.draw = function(shaderProgram) {

	for (var m = 0; m < this.meshes.length; ++m)
	{
		this.drawMesh(this.meshes[m], shaderProgram);
	}
};

// Sets up the GL buffers and states for this model.
DoomMD5Model.prototype.setUpGLBuffers = function(bufferUsage, skeleton) {

	// Shortcut variable for our WebGL singleton:
	var gl = utils.gl;

	for (var m = 0; m < this.meshes.length; ++m)
	{
		var mesh = this.meshes[m];

		//
		// Create buffers for the first time if needed:
		//
		if (mesh.positionBuffer == null)
		{
			mesh.positionBuffer = gl.createBuffer();
		}
		if (mesh.normalsBuffer == null)
		{
			mesh.normalsBuffer = gl.createBuffer();
		}
		if (mesh.tangentsBuffer == null)
		{
			mesh.tangentsBuffer = gl.createBuffer();
		}
		if (mesh.bitangentsBuffer == null)
		{
			mesh.bitangentsBuffer = gl.createBuffer();
		}
		if (mesh.uvBuffer == null)
		{
			mesh.uvBuffer = gl.createBuffer();
		}
		if (mesh.indexBuffer == null)
		{
			mesh.indexBuffer = gl.createBuffer();
		}

		this.buildMeshVertexesAndUVs(mesh, ((skeleton == null) ? this.baseSkeleton : skeleton));
		this.deriveNormalsAndTangents(mesh);

		// Upload vertexes to GL:
		gl.bindBuffer(gl.ARRAY_BUFFER, mesh.positionBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, mesh.vertexPositions, bufferUsage);

		// Upload vertex normals to GL:
		gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normalsBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, mesh.vertexNormals, bufferUsage);

		// Upload tangents to GL:
		gl.bindBuffer(gl.ARRAY_BUFFER, mesh.tangentsBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, mesh.vertexTangents, bufferUsage);

		// Upload bi-tangents to GL:
		gl.bindBuffer(gl.ARRAY_BUFFER, mesh.bitangentsBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, mesh.vertexBitangents, bufferUsage);

		// Upload UVs to GL:
		gl.bindBuffer(gl.ARRAY_BUFFER, mesh.uvBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, mesh.vertexUVs, bufferUsage);

		// Upload indexes to GL:
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(mesh.indexes), bufferUsage);
		// Note that GL ES and WebGL don't support 32bit indexing, so the data type here
		// must be either Uint16Array or Uint8Array.
		// For gl.drawElements, the type must be UNSIGNED_SHORT or UNSIGNED_BYTE.
	}

	// Unbid:
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
};

// Normal, tangent and bi-tangent basis:
DoomMD5Model.prototype.deriveNormalsAndTangents = function(mesh) {

	//
	// Derives the normal and orthogonal tangent vectors for the mesh vertexes.
	// For each vertex the normal and tangent vectors are derived from all triangles
	// using the vertex which results in smooth tangents across the mesh.
	//
	// Based almost entirely on R_DeriveNormalsAndTangents() from Doom3 BFG:
	// See: https://github.com/id-Software/DOOM-3-BFG/blob/master/neo/renderer/tr_trisurf.cpp#L901
	//

	if (!mesh || !mesh.vertexPositions || !mesh.vertexUVs || !mesh.indexes)
	{
		utils.warning("Invalid arguments for DoomMD5Model.deriveNormalsAndTangents()!");
		return;
	}

	var signf = function(x) {
		return ((x > 0.0) ? 1 : (x < 0.0) ? -1 : 0);
	};

	var numVerts   = mesh.vertexes.length;
	var numIndexes = mesh.indexes.length;

	var vertexNormals    = new Float32Array(numVerts * 3); // 3 floats per normal
	var vertexTangents   = new Float32Array(numVerts * 3); // 3 floats per tangent
	var vertexBitangents = new Float32Array(numVerts * 3); // 3 floats per bi-tangent

	for (var i = 0; i < numIndexes; i += 3)
	{
		var v0 = mesh.indexes[i + 0];
		var v1 = mesh.indexes[i + 1];
		var v2 = mesh.indexes[i + 2];

		var aX = mesh.vertexPositions[v0 * 3 + 0];
		var aY = mesh.vertexPositions[v0 * 3 + 1];
		var aZ = mesh.vertexPositions[v0 * 3 + 2];
		var bX = mesh.vertexPositions[v1 * 3 + 0];
		var bY = mesh.vertexPositions[v1 * 3 + 1];
		var bZ = mesh.vertexPositions[v1 * 3 + 2];
		var cX = mesh.vertexPositions[v2 * 3 + 0];
		var cY = mesh.vertexPositions[v2 * 3 + 1];
		var cZ = mesh.vertexPositions[v2 * 3 + 2];

		var aU = mesh.vertexUVs[v0 * 2 + 0];
		var aV = mesh.vertexUVs[v0 * 2 + 1];
		var bU = mesh.vertexUVs[v1 * 2 + 0];
		var bV = mesh.vertexUVs[v1 * 2 + 1];
		var cU = mesh.vertexUVs[v2 * 2 + 0];
		var cV = mesh.vertexUVs[v2 * 2 + 1];

		var d0 = new Float32Array(5);
		d0[0] = bX - aX;
		d0[1] = bY - aY;
		d0[2] = bZ - aZ;
		d0[3] = bU - aU;
		d0[4] = bV - aV;

		var d1 = new Float32Array(5);
		d1[0] = cX - aX;
		d1[1] = cY - aY;
		d1[2] = cZ - aZ;
		d1[3] = cU - aU;
		d1[4] = cV - aV;

		var area = d0[3] * d1[4] - d0[4] * d1[3];
		var areaSign = signf(area);

		// ---- Normal: ----
		var normal = new Float32Array(3);
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
		var tangent = new Float32Array(3);
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
		var bitangent = new Float32Array(3);
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

	// TODO do we really need this?
	/*
	// add the normal of a duplicated vertex to the normal of the first vertex with the same XYZ
	for ( int i = 0; i < tri->numDupVerts; i++ ) {
		vertexNormals[tri->dupVerts[i*2+0]] += vertexNormals[tri->dupVerts[i*2+1]];
	}
	// copy vertex normals to duplicated vertexes
	for ( int i = 0; i < tri->numDupVerts; i++ ) {
		vertexNormals[tri->dupVerts[i*2+1]] = vertexNormals[tri->dupVerts[i*2+0]];
	}
	*/

	// Project the summed vectors onto the normal plane and normalize.
	// The tangent vectors will not necessarily be orthogonal to each
	// other, but they will be orthogonal to the surface normal.
	for (var i = 0; i < numVerts; ++i)
	{
		var ix = (i * 3 + 0);
		var iy = (i * 3 + 1);
		var iz = (i * 3 + 2);

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

	// Save into the mesh object:
	mesh.vertexNormals    = vertexNormals;
	mesh.vertexTangents   = vertexTangents;
	mesh.vertexBitangents = vertexBitangents;
};

// Build GL renderable vertex and UV buffers from the skeleton data for a given mesh.
DoomMD5Model.prototype.buildMeshVertexesAndUVs = function(mesh, skeleton) {

	if (!mesh || !skeleton || !mesh.vertexes || !mesh.weights)
	{
		utils.warning("Invalid arguments for DoomMD5Model.buildMeshVertexesAndUVs()!");
		return;
	}

	// Allocate memory:
	mesh.vertexPositions = new Float32Array(mesh.vertexes.length * 3);
	mesh.vertexUVs       = new Float32Array(mesh.vertexes.length * 2);

	// Set up vertexes:
	for (var v = 0; v < mesh.vertexes.length; ++v)
	{
		var finalVertex = vec3.create([0.0, 0.0, 0.0]);

		// Calculate final vertex to draw with weights:
		for (var w = 0; w < mesh.vertexes[v].count; ++w)
		{
			var dWeight = mesh.weights[mesh.vertexes[v].start + w];
			var dJoint  = skeleton[dWeight.joint];

			// Calculate transformed vertex for this weight:
			var wv = vec3.create([0.0, 0.0, 0.0]);
			vec3.transformQuat(wv, dWeight.pos, dJoint.orient);
			finalVertex[0] += (dJoint.pos[0] + wv[0]) * dWeight.bias;
			finalVertex[1] += (dJoint.pos[1] + wv[1]) * dWeight.bias;
			finalVertex[2] += (dJoint.pos[2] + wv[2]) * dWeight.bias;
		}

		// Add to output, breaking the vec3 into three floats.
		// Also swizzles y/z. Id Software historically used this different axis layout.
		mesh.vertexPositions[v * 3 + 0] = finalVertex[0];
		mesh.vertexPositions[v * 3 + 1] = finalVertex[2];
		mesh.vertexPositions[v * 3 + 2] = finalVertex[1];

		// Add tex-coord UVs:
		mesh.vertexUVs[v * 2 + 0] = mesh.vertexes[v].tU;
		mesh.vertexUVs[v * 2 + 1] = mesh.vertexes[v].tV;
	}
};

// Adds debug lines for the tangent basis (normal, tangent and bi-tangent).
DoomMD5Model.prototype.addDebugTangentBasis = function(scale) {

	// A little helper nested function...
	var addTBN = function(origin, t, b, n) {

		// Vertex normals are WHITE:
		var vn = [ (origin[0] + n[0] * scale), (origin[1] + n[1] * scale), (origin[2] + n[2] * scale) ];
		utils.addDebugLine(origin, vn, [1.0, 1.0, 1.0]);

		// Tangents are YELLOW:
		var vt = [ (origin[0] + t[0] * scale), (origin[1] + t[1] * scale), (origin[2] + t[2] * scale) ];
		utils.addDebugLine(origin, vt, [1.0, 1.0, 0.0]);

		// Bi-tangents are MAGENTA:
		var vb = [ (origin[0] + b[0] * scale), (origin[1] + b[1] * scale), (origin[2] + b[2] * scale) ];
		utils.addDebugLine(origin, vb, [1.0, 0.0, 1.0]);
	};

	// Add for all meshes in this model:
	for (var m = 0; m < this.meshes.length; ++m)
	{
		var mesh = this.meshes[m];
		var numVerts = mesh.vertexes.length;
		for (var v = 0; v < numVerts; ++v)
		{
			var vx = (v * 3 + 0);
			var vy = (v * 3 + 1);
			var vz = (v * 3 + 2);
			var p = [ mesh.vertexPositions[vx],  mesh.vertexPositions[vy],  mesh.vertexPositions[vz]  ];
			var t = [ mesh.vertexTangents[vx],   mesh.vertexTangents[vy],   mesh.vertexTangents[vz]   ];
			var b = [ mesh.vertexBitangents[vx], mesh.vertexBitangents[vy], mesh.vertexBitangents[vz] ];
			var n = [ mesh.vertexNormals[vx],    mesh.vertexNormals[vy],    mesh.vertexNormals[vz]    ];
			addTBN(p, t, b, n);
		}
	}
};

// Dumps the loaded contents of the MD5 model into the innerHTML of a given element.
DoomMD5Model.prototype.dumpToHTML = function(htmlElement) {

	var dumpDiv = document.getElementById(htmlElement);
	if (dumpDiv)
	{
		// Dump as JSON formatted text:
		var text = JSON.stringify(this, null, "\t");
		var withLineBreaks = text.replace(/\n/gm, "<br />");
		var withTabs = withLineBreaks.replace(/\t/gm, "&nbsp&nbsp&nbsp&nbsp"); // 4 non-breaking spaces
		dumpDiv.innerHTML = withTabs;
	}
};
