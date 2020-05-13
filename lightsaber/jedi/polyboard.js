/*
 * ================================================================================================
 * -*- JavaScript -*-
 * File: polyboard.js
 * Author: Guilherme R. Lampert
 * Created on: 2015-05-18
 * Brief: Poly(gon) board renderer.
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
jedi.Polyboard class:
===========================================================
*/
jedi.Polyboard = function () {
	this.detail = {
		gl                   : jedi.Renderer.getWebGLContext(),
		webGLVbo             : null,  // WebGL VBO instance. Null is invalid.
		needVboUpdate        : false, // Set when new points are added and the GL VBO must be updated.
		shaderProgram        : null,  // Special shader used to render the polyboard.
		texture              : null,  // Texture applied. Defaults to a white texture if null.
		points               : [],    // Array of small objects, for each point in the base polyline.
		pointLifeMax         : 0,     // Lifetime in milliseconds for new points added.
		pointAlphaFadeFactor : 0.001, // Amount to fade the alpha color of expired points.
		pointCountMax        : 0,     // Max points you can add. This is regulates the size of the VBO.
		boardRadius          : 1.0,   // Radius or thickness of the polyboard.
		cameraFacing         : true,  // Set this to false if using `addPointEx()` and you don't want camera-facing polyboards.
		cameraPosition       : vec3.create()
	};
};

/*
 * ---- Methods of Polyboard: ----
 */

jedi.Polyboard.prototype.initWithParams = function (maxPoints, pointLifeMillisec, radius, baseTexName) { // -> bool

	if (!maxPoints)         { maxPoints         = 128; }
	if (!pointLifeMillisec) { pointLifeMillisec = 1;   }
	if (!radius)            { radius            = 1.0; }
	if (!baseTexName)       { baseTexName       = "misc/white.jpg"; }

	this.detail.webGLVbo = this.detail.gl.createBuffer();
	if (!this.detail.webGLVbo) {
		jedi.logError("Failed to allocate new WebGL VBO! Possibly out of memory...");
		return false;
	}

	this.detail.shaderProgram = jedi.ResourceManager.findShaderProgram("polyboard");
	this.detail.texture       = jedi.ResourceManager.findTexture(baseTexName);
	this.detail.pointLifeMax  = pointLifeMillisec;
	this.detail.pointCountMax = maxPoints;
	this.detail.boardRadius   = radius;
	this.detail.needVboUpdate = false;

	return true;
};

jedi.Polyboard.prototype.dispose = function () { // -> void
	if (this.detail.webGLVbo) {
		// Make sure buffer bindings are clear first:
		this.detail.gl.bindBuffer(this.detail.gl.ARRAY_BUFFER, null);
		// Delete the WebGL object:
		this.detail.gl.deleteBuffer(this.detail.webGLVbo);
		this.detail.webGLVbo = null;
	}

	// Reset the rest.
	this.detail.needVboUpdate        = false;
	this.detail.shaderProgram        = null;
	this.detail.texture              = null;
	this.detail.points               = [];
	this.detail.pointLifeMax         = 0;
	this.detail.pointCountMax        = 0;
	this.detail.pointAlphaFadeFactor = 0.001;
	this.detail.boardRadius          = 1.0;
	this.detail.cameraFacing         = true;
	this.detail.cameraPosition       = vec3.create();
};

jedi.Polyboard.prototype.clearPoints = function () { // -> void
	this.detail.points = [];
};

jedi.Polyboard.prototype.getPointCount = function () { // -> int
	return this.detail.points.length;
};

jedi.Polyboard.prototype.getMaxPointCount = function () { // -> int
	return this.detail.pointCountMax;
};

jedi.Polyboard.prototype.getCameraPosition = function () { // -> vec3
	return this.detail.cameraPosition;
};

jedi.Polyboard.prototype.setCameraPosition = function (pos) { // -> void
	this.detail.cameraPosition = pos;
};

jedi.Polyboard.prototype.getCameraFacing = function () { // -> bool
	return this.detail.cameraFacing;
};

jedi.Polyboard.prototype.setCameraFacing = function (yesNo) { // -> void
	this.detail.cameraFacing = yesNo;
};

jedi.Polyboard.prototype.getBoardRadius = function () { // -> float
	return this.detail.boardRadius;
};

jedi.Polyboard.prototype.setBoardRadius = function (radius) { // -> void
	this.detail.boardRadius = radius;
};

jedi.Polyboard.prototype.getPointLifeMax = function () { // -> int
	return this.detail.pointLifeMax;
};

jedi.Polyboard.prototype.setPointLifeMax = function (maxMillisec) { // -> void
	this.detail.pointLifeMax = maxMillisec;
};

jedi.Polyboard.prototype.getPointAlphaFadeFactor = function () { // -> float
	return this.detail.pointAlphaFadeFactor;
};

jedi.Polyboard.prototype.setPointAlphaFadeFactor = function (factor) { // -> void
	this.detail.pointAlphaFadeFactor = factor;
};

jedi.Polyboard.prototype.getBaseTexture = function () { // -> jedi.Texture
	return this.detail.texture;
};

jedi.Polyboard.prototype.setBaseTexture = function (tex) { // -> void
	this.detail.texture = tex;
};

jedi.Polyboard.prototype.addPoint = function (pos, color) {  // -> bool
	jedi.assert(pos   && pos.length   >= 3, "Point must be a valid vec3 instance!");
	jedi.assert(color && color.length >= 4, "Point color must be RGBA!");

	if (this.detail.points.length < this.detail.pointCountMax) {	
		this.detail.points.push({
			position : pos,
			color    : color,
			lifetime : 0.0
		});

		this.detail.needVboUpdate = true;
		return true;
	}

	return false; // Too many points!
};

jedi.Polyboard.prototype.addPointEx = function (o, color) {  // -> bool
	jedi.assert(o, "First parameter is a compound object!");
	jedi.assert(color && color.length >= 4, "Point color must be RGBA!");

	if (this.detail.points.length < this.detail.pointCountMax) {	
		this.detail.points.push({
			position : o.center,
			top      : o.top,
			base     : o.base,
			color    : color,
			lifetime : 0.0
		});

		this.detail.needVboUpdate = true;
		return true;
	}

	return false; // Too many points!
};

jedi.Polyboard.prototype.update = function (deltaTimeMillisec) {  // -> void
	if (this.getPointCount() == 0) {
		return;
	}

	var points               = this.detail.points;
	var pointLifeMax         = this.detail.pointLifeMax;
	var pointAlphaFadeFactor = this.detail.pointAlphaFadeFactor * deltaTimeMillisec;
	var pointsUpdated        = 0;

	for (var p = 0; p < points.length; ++p) {
		points[p].lifetime += deltaTimeMillisec;

		// Begin fading out.
		if (points[p].lifetime >= pointLifeMax) {
			points[p].color[3] -= pointAlphaFadeFactor;
			if (points[p].color[3] < 0.0) {
				points[p].color[3] = 0.0;
			}
			++pointsUpdated;
		}
	}

	// Once the oldest (first in the list) point is fully 
	// transparent, we can pop it. This works much like a circular queue.
	if (points[0].lifetime >= pointLifeMax) {
		if (points[0].color[3] <= 0.0) {
			points.shift();
		}
	}

	if (pointsUpdated > 0) {
		this.detail.needVboUpdate = true;
	}
};

jedi.Polyboard.prototype.draw = function () {  // -> void
	if (!this.detail.webGLVbo || !this.detail.shaderProgram) {
		jedi.logWarning("Invalid VBO or shader in jedi.Polyboard.draw()!");
		return;
	}

	// Need at least two points to make a quadrilateral.
	if (this.getPointCount() < 2) {
		return;
	}

	// Shortcut variables:
	var gl = this.detail.gl;
	var shaderProgram = this.detail.shaderProgram;
	var pointsToDraw  = this.getPointCount();

	var QUADS_PER_POINT = 2; // Each point in the line expands to a pair of quads (one on each side)
	var TRIS_PER_QUAD   = 2; // We break each quad into two triangles to simplify rendering.
	var VERTS_PER_TRI   = 3; // And obviously, three vertexes to make each triangle.
	var drawVertCount   = (pointsToDraw - 1) * QUADS_PER_POINT * TRIS_PER_QUAD * VERTS_PER_TRI;

	// Update only when needed.
	if (this.detail.needVboUpdate) {
		//
		// Vertex format is:
		// - position[3]
		// - color[4]
		// - texcoords[2]
		//
		var ELEMENTS_PER_VERTEX = 3 + 4 + 2;
		var vertexArray = new Float32Array(drawVertCount * ELEMENTS_PER_VERTEX);

		// Expand each point into a pair of quadrilaterals to give the base line some thickness.
		this.expandPointVertexes(vertexArray, drawVertCount, ELEMENTS_PER_VERTEX);
	
		// DYNAMIC_DRAW: We update once, use a few times, then discard.
		gl.bindBuffer(gl.ARRAY_BUFFER, this.detail.webGLVbo);
		gl.bufferData(gl.ARRAY_BUFFER, vertexArray, gl.DYNAMIC_DRAW);
		this.detail.needVboUpdate = false;

	} else {
		// Just bind for drawing.
		gl.bindBuffer(gl.ARRAY_BUFFER, this.detail.webGLVbo);
	}

	// Set vertex format/layout:
	var VERT_OFFSET_POS    = 0;
	var VERT_OFFSET_COLOR  = (3 * 4);
	var VERT_OFFSET_TEX    = (3 * 4) + (4 * 4);
	var VERT_SIZE_BYTES    = (3 * 4) + (4 * 4) + (2 * 4);

	var positionAttribIndex = shaderProgram.getVertexAttribIndex("a_position");
	var colorAttribIndex    = shaderProgram.getVertexAttribIndex("a_color");
	var texcoordAttribIndex = shaderProgram.getVertexAttribIndex("a_texcoords");

	gl.enableVertexAttribArray(positionAttribIndex);
	gl.vertexAttribPointer(positionAttribIndex, 3, gl.FLOAT, false, VERT_SIZE_BYTES, VERT_OFFSET_POS);

	gl.enableVertexAttribArray(colorAttribIndex);
	gl.vertexAttribPointer(colorAttribIndex, 4, gl.FLOAT, false, VERT_SIZE_BYTES, VERT_OFFSET_COLOR);

	gl.enableVertexAttribArray(texcoordAttribIndex);
	gl.vertexAttribPointer(texcoordAttribIndex, 2, gl.FLOAT, false, VERT_SIZE_BYTES, VERT_OFFSET_TEX);

	// Set texture (TMU=0):
	if (this.detail.texture) {
		this.detail.texture.bind(0);
	}

	// Set up the shader program:
	shaderProgram.bind();
	if (shaderProgram.hasUniformVar("u_diffuse_texture")) {
		shaderProgram.setUniform1i("u_diffuse_texture", 0); // TMU=0
	}
	if (shaderProgram.hasUniformVar("u_rp_mvp_matrix")) {
		shaderProgram.setUniformMatrix4x4("u_rp_mvp_matrix", jedi.Renderer.getMvpMatrix());
	}

	// Culling only really needs to be disabled if your polyboard
	// is going to be forming loops around itself. If the polyboard
	// is only seen from one side, the this could be removed. 
	gl.disable(gl.CULL_FACE);

	// Transparency must be enabled to the polyboard
	// to fade out gradually.
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

	// Draw. The point set will produce quadrilaterals; 
	// 2 tris per quadrilateral; 3 verts per tri.
	gl.drawArrays(jedi.Renderer.getWebGLRenderMode(), 0, drawVertCount); 

	// Cleanup:
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
	gl.disable(gl.BLEND);
	gl.enable(gl.CULL_FACE);
};

jedi.Polyboard.prototype.expandPointVertexes = function (vertexArray, maxVertCount, elementsPerVert) { // -> Array[3]

	var nextVert = 0;
	var emitVertex = function (xyz, rgba, uv) {
		jedi.assert(nextVert < (maxVertCount * elementsPerVert), "Buffer overflow!");
		// Vertex position (xyz):
		vertexArray[nextVert + 0] = xyz[0];
		vertexArray[nextVert + 1] = xyz[1];
		vertexArray[nextVert + 2] = xyz[2];
		// Vertex color (rgba):
		vertexArray[nextVert + 3] = rgba[0];
		vertexArray[nextVert + 4] = rgba[1];
		vertexArray[nextVert + 5] = rgba[2];
		vertexArray[nextVert + 6] = rgba[3];
		// Vertex tex-coords (uv):
		vertexArray[nextVert + 7] = uv[0];
		vertexArray[nextVert + 8] = uv[1];
		// Advance vertex pointer:
		nextVert += elementsPerVert;
	};

	var points  = this.detail.points;
	var edgeSet = jedi.Polyboard.buildPolyboardEdges(this.detail.cameraPosition, 
		this.detail.cameraFacing, points, this.detail.boardRadius);

	var texPctCoveredByEachPoint = (points.length - 1) / 100.0;
	var uPercent0 = 0.0;
	var uPercent1 = texPctCoveredByEachPoint;

	for (var e = 0, p = 0; p < (points.length - 1); e += 2, p += 1) {
		//
		// Triangles are in CCW order!
		//
		var center = points[p].position;
		var color  = points[p].color;
		var nextCenter = points[p + 1].position;
		var nextColor  = points[p + 1].color;

		// Lower quadrilateral: 
		//
		var edgeA = edgeSet[e + 0];
		var nextEdgeA = edgeSet[e + 2];

		// For tiled UVs use
		/*
		[0,0] [0,1] [1,1]
		[0,0] [1,1] [1,0]
		*/
		emitVertex(center,     color,     [uPercent0, 0.5]);
		emitVertex(edgeA,      color,     [uPercent0, 1.0]);
		emitVertex(nextEdgeA,  nextColor, [uPercent1, 1.0]);

		emitVertex(center,     color,     [uPercent0, 0.5]);
		emitVertex(nextEdgeA,  nextColor, [uPercent1, 1.0]);
		emitVertex(nextCenter, nextColor, [uPercent1, 0.5]);

		// Upper quadrilateral:
		//
		var edgeB = edgeSet[e + 1];
		var nextEdgeB = edgeSet[e + 3];

		// For tiled UVs use
		/*
		[0,1] [1,0] [0,0]
		[0,1] [1,1] [1,0]
		*/
		emitVertex(center,     color,     [uPercent0, 0.5]);
		emitVertex(nextEdgeB,  nextColor, [uPercent1, 0.0]);
		emitVertex(edgeB,      color,     [uPercent0, 0.0]);

		emitVertex(center,     color,     [uPercent0, 0.5]);
		emitVertex(nextCenter, nextColor, [uPercent1, 0.5]);
		emitVertex(nextEdgeB,  nextColor, [uPercent1, 0.0]);

		uPercent0 += texPctCoveredByEachPoint;
		uPercent1 += texPctCoveredByEachPoint;
	}
};

jedi.Polyboard.buildPolyboardEdges = function (cameraPosition, cameraFacing, points, radius) { // -> Array ['static' method]
	var edgeSet = [];
	var p = 0;

	if (cameraFacing) {
		// Compute end points for a given center point
		// in a way that they face the given camera world position.

		var tmp       = vec3.create();
		var diff      = vec3.create();
		var edgeA     = vec3.create();
		var edgeB     = vec3.create();
		var tangent   = vec3.create();
		var TcrossC   = vec3.create();
		var cameraDir = vec3.create();

		for (p = 0; p < points.length; ++p) {
			vec3.subtract(diff, cameraPosition, points[p].position);
			vec3.normalize(cameraDir, diff);

			if (p == 0) { // Fist point
				vec3.subtract(diff, points[p + 1].position, points[p].position);
			} else if (p == (points.length - 1)) { // Last point
				vec3.subtract(diff, points[p].position, points[p - 1].position);
			} else { // In between
				vec3.subtract(diff, points[p + 1].position, points[p - 1].position);
			}
			vec3.normalize(tangent, diff);

			// Compute the polyboard edge vertexes:
			vec3.cross(TcrossC, tangent, cameraDir);
			vec3.scale(tmp, TcrossC, radius);

			vec3.add(edgeA, points[p].position, tmp);
			vec3.sub(edgeB, points[p].position, tmp);

			edgeSet.push(vec3.clone(edgeA));
			edgeSet.push(vec3.clone(edgeB));
		}
	} else {
		// User has specified both end points of each
		// sample (center) in the polyboard base line.
		for (p = 0; p < points.length; ++p) {
			edgeSet.push(vec3.clone(points[p].top));
			edgeSet.push(vec3.clone(points[p].base));
		}
	}

	return edgeSet;
};
