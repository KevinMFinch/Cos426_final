
// ================================================================================================
// -*- JavaScript -*-
// File: Utils.js
// Author: Guilherme R. Lampert
// Created on: 2014-05-07
// Brief: Miscellaneous WebGL utilities and helpers.
// ================================================================================================

"use strict";

// =============================================
// Common Utilities:
// =============================================

//
// utils singleton -- Our local utilities and WebGL helpers.
//
var utils = {

	// ---- Properties: ----

	// The WebGL context, initialized by initWebGL().
	gl : null,

	// Default color used to clear the screen (floats).
	defaultClearColor : [ 0.7, 0.7, 0.7, 1.0 ],

	// The default texture is an ugly pink image. Easy to debug.
	defaultTexColor : [ 0xff, 0x14, 0x93, 0xff ],

	// Texture filter for all texture created here.
	// Accepts: "nearest", "nearestMipMap", "linear", "linearMipMap".
	defaultTexFilter : "linearMipMap",

	// Texture addressing mode for all textures created here.
	// Accepts: "repeat" and "clampToEdge".
	defaultTexAddressMode : "clampToEdge",

	// Table of currently loaded textures, used by loadTextureFromFile().
	// Avoids reloading the same texture more than once.
	loadedTextures : { },

	// VBO for a screen aligned quad. Used by drawFullScreenQuad().
	screenQuadVBO : null,

	// Degrees/radians conversion:
	DEG_TO_RAD : (Math.PI / 180.0),
	RAD_TO_DEG : (180.0 / Math.PI),

	// ---- Methods: ----

	//
	// Display error message in an alert() popup.
	//
	error : function(argument) {
		alert("Fatal Error: " + argument);
	},

	//
	// Display warning message in an alert() popup.
	//
	warning : function(argument) {
		alert("Warning: " + argument);
	},

	//
	// Portable way to create the WebGL rendering context.
	// Returns null on failure, context object otherwise.
	//
	create3DContext : function(canvas) {

		var names = ["experimental-webgl", "webgl", "webkit-3d", "moz-webgl"];
		var context = null;

		for (var i = 0; i < names.length; ++i)
		{
			try {
				context = canvas.getContext(names[i]);
			} catch(e) { }
			if (context)
			{
				break;
			}
		}

		return (context);
	},

	//
	// Full WebGL setup.
	//
	initWebGL : function(canvasElementId) {

		// Grab the 'canvas' element:
		var canvas = document.getElementById(canvasElementId);
		if (!canvas)
		{
			this.error("Unable to get the document's canvas element from id: " + canvasElementId);
			return (false);
		}

		// Try to initialize WebGL.
		// This will fail if the browser doesn't support WebGL or if the feature is disabled.
		// (as it is with some versions of Safari, where WebGL is disabled by default and has to be manually enabled).
		this.gl = this.create3DContext(canvas);
		if (!this.gl)
		{
			this.error("Could not initialize WebGL! Your browser may not support it or it my be disabled.");
			return (false);
		}

		this.gl.viewportWidth  = canvas.width;
		this.gl.viewportHeight = canvas.height;

		// Set the appropriate GL render states:
		this.gl.enable(this.gl.DEPTH_TEST);
		this.gl.cullFace(this.gl.BACK);
		this.gl.enable(this.gl.CULL_FACE);
		this.gl.clearColor(this.defaultClearColor[0], this.defaultClearColor[1], this.defaultClearColor[2], this.defaultClearColor[3]);
		this.gl.viewport(0, 0, this.gl.viewportWidth, this.gl.viewportHeight);
		this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

		return (true);
	},

	//
	// Registers a user callback to run every frame.
	// Uses the proper browser API or a portable fallback with window.setTimeout().
	//
	requestAnimFrame : function(callback) {

		var getAnimFrameRequestFunc = function() {
			return window.requestAnimationFrame       ||
			       window.webkitRequestAnimationFrame ||
			       window.mozRequestAnimationFrame    ||
			       window.oRequestAnimationFrame      ||
			       window.msRequestAnimationFrame     ||
			       function(callback, element) {
			           window.setTimeout(callback, 1000/60);
			       };
		};
		getAnimFrameRequestFunc()(callback);
	},

	//
	// Loads a GLSL Vertex or Fragment shader from and HTML element.
	//
	loadShader : function(shaderElementId) {

		// Get shader text source element:
		var shaderScript = document.getElementById(shaderElementId);
		if (!shaderScript)
		{
			this.error("Unable to find shader element for id: " + shaderElementId);
			return (null);
		}

		// Grab the GLSL source code:
		var shaderSourceText = "";
		var domNode = shaderScript.firstChild;
		while (domNode)
		{
			// NOTE: nodeType == 3 indicates a TEXT mode, which is what we want.
			// See http://www.w3schools.com/jsref/prop_node_nodetype.asp
			// for a list of all node types.
			if (domNode.nodeType == 3)
			{
				shaderSourceText += domNode.textContent;
			}
			domNode = domNode.nextSibling;
		}

		// Created WebGL shader object:
		//
		// (Note that the 'x-shader' type is a user defined value.
		// It could be any arbitrary string that does not conflict
		// with a string expected by the common browsers).
		//
		var shader;
		if (shaderScript.type == "x-shader/x-vertex")
		{
			shader = this.gl.createShader(this.gl.VERTEX_SHADER);
		}
		else if (shaderScript.type == "x-shader/x-fragment")
		{
			shader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
		}
		else
		{
			this.error("Invalid shader type! shaderElementId: " + shaderElementId);
			return (null);
		}

		// Set source data & compile:
		this.gl.shaderSource(shader, shaderSourceText);
		this.gl.compileShader(shader);

		// Get the info log with possible warnings and errors:
		var infolog = this.gl.getShaderInfoLog(shader);

		// Return a null shader on failure:
		if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS))
		{
			this.error("Failed to compile shader " + shaderElementId + "\n" +
			           "Compiler info log:\n" + infolog);
			return (null);
		}

		// If the got and info log but COMPILE_STATUS was OK,
		// there might be some warnings and other issues with the code
		// that we should still print.
		if (infolog)
		{
			this.warning("Shader compile info log:\n" + infolog);
		}

		// If we get here, the shader should be in a valid state for rendering.
		return (shader);
	},

	//
	// Loads a complete shader program (vs + fs).
	//
	loadProgram : function(vertexShader, fragmentShader, vertexAttributes, uniformVars) {

		if (!vertexShader || !fragmentShader)
		{
			this.error("Null shaders for loadProgram()!");
			return (null);
		}

		// Create WebGL program object:
		var programObject = this.gl.createProgram();

		// Attach the shaders to it:
		this.gl.attachShader(programObject, vertexShader);
		this.gl.attachShader(programObject, fragmentShader);

		// Bind the vertex attribute, if any.
		// This must happen BEFORE linking the program.
		if (vertexAttributes)
		{
			programObject.vertexAttributes = [];
			for (var i = 0; i < vertexAttributes.length; ++i)
			{
				// Bind to user defined index:
				this.gl.bindAttribLocation(programObject,
					vertexAttributes[i].index, vertexAttributes[i].name);

				// Save the attribute index inside the program object
				// for use with gl.vertexAttribPointer()
				programObject.vertexAttributes[vertexAttributes[i].name] = vertexAttributes[i].index;
			}
		}

		// Link the program into a GPU "executable":
		this.gl.linkProgram(programObject);

		// Check link status:
		if (!this.gl.getProgramParameter(programObject, this.gl.LINK_STATUS))
		{
			this.error("Could not link GLSL program!");
			return (null);
		}

		// Query uniform variable locations
		// and store their handles inside the program object.
		if (uniformVars)
		{
			this.gl.useProgram(programObject);

			programObject.uniforms = [];
			for (var i = 0; i < uniformVars.length; ++i)
			{
				var uniLoc = this.gl.getUniformLocation(programObject, uniformVars[i]);
				if (!uniLoc)
				{
					this.warning("Unable to get uniform \'" + uniformVars[i] + "\' location!");
				}
				programObject.uniforms[uniformVars[i]] = uniLoc;
			}

			this.gl.useProgram(null);
		}

		// GPU Program ready for use.
		return (programObject);
	},

	//
	// Creates and returns a WebGL texture object from a
	// JavaScript Image() object or raw pixel data.
	//
	createTextureFromImage : function(imageObject, flipV) {

		if (!imageObject)
		{
			this.error("Invalid image object for createTextureFromImage()!");
			return (null);
		}

		var textureObject;
		if (imageObject.glTextureObject == null)
		{
			textureObject = this.gl.createTexture();
		}
		else
		{
			textureObject = imageObject.glTextureObject;
		}

		this.gl.bindTexture(this.gl.TEXTURE_2D, textureObject);

		// If the image needs to be flipped vertically, such as with JPEGs,
		// WebGL offers us the UNPACK_FLIP_Y_WEBGL extension. This is of great help,
		// since accessing the raw pixel data of an image in JS is not a trivial task.
		this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, flipV); // flipV must be 'true' or 'false'.

		// Send image pixel to GL:
		if (imageObject.isLoaded == true)
		{
			if (imageObject.isTGA == true)
			{
				var tga = imageObject.tgaImage;

				// Force the image to RGBA. It seems to work better with WebGL.
				var imageData = {
					width  : tga.getWidth(),
					height : tga.getHeight(),
					data   : new Uint8Array(tga.getWidth() * tga.getHeight() * 4)
				};
				this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, tga.getWidth(), tga.getHeight(),
						0, this.gl.RGBA, gl.UNSIGNED_BYTE, tga.getImageData(imageData).data);
			}
			else
			{
				this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA,
						this.gl.UNSIGNED_BYTE, imageObject.htmlImage);
			}
		}
		else
		{
			// Default to a 1x1 image:
			this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, 1, 1, 0, this.gl.RGBA,
					gl.UNSIGNED_BYTE, new Uint8Array(this.defaultTexColor));
		}

		var genMipMap = false;

		// Set filtering options:
		if (this.defaultTexFilter == "nearest") // Crappy
		{
			this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
			this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
			genMipMap = false;
		}
		else if (this.defaultTexFilter == "nearestMipMap") // Good
		{
			this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
			this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST_MIPMAP_NEAREST);
			genMipMap = true;
		}
		else if (this.defaultTexFilter == "linear") // Better
		{
			this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
			this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
			genMipMap = false;
		}
		else if (this.defaultTexFilter == "linearMipMap") // Best
		{
			this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
			this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);
			genMipMap = true;
		}
		else
		{
			this.warning("Invalid texture filtering option! Must be: [nearest, nearestMipMap, linear, linearMipMap]");
		}

		// Set texture addressing mode (this should optimally be function parameter:
		if (this.defaultTexAddressMode == "repeat")
		{
			this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
			this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
		}
		else if (this.defaultTexAddressMode == "clampToEdge")
		{
			this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
			this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
		}
		else
		{
			this.warning("Invalid texture addressing option! Must be: [repeat, clampToEdge]");
		}

		if (genMipMap)
		{
			// Now automatically generate a mip-map chain for the image:
			// (this will fail for non power-of-two images!)
			// Good thread to take a look at on SO: http://stackoverflow.com/a/19748905/1198654
			this.gl.generateMipmap(this.gl.TEXTURE_2D);
		}

		// As a good practice, unbind the texture to avoid
		// accidental external modifications.
		this.gl.bindTexture(this.gl.TEXTURE_2D, null);

		// Return the user handle:
		return (textureObject);
	},

	//
	// Loads a texture from an image file.
	// The file must be in the application directory or must be preceded by a full path.
	//
	// The returned variable will be compound type (object).
	// The object will contain a field named 'glTextureObject' which is
	// the WebGL texture.
	//
	loadTextureFromFile : function(filename, flipV) {

		// First, lookup the table of loaded textures
		// and avoid loading again if already loaded.
		if (this.loadedTextures.hasOwnProperty(filename))
		{
			return (this.loadedTextures[filename]);
		}
		// Else, load new:

		// Image/texture object:
		var image = {
			isLoaded        : false,
			isTGA           : false,
			htmlImage       : null,
			tgaImage        : null,
			glTextureObject : null
		};

		// Function called when the image finishes loading.
		var completionCallback = function() {
			// Mark as ready:
			image.isLoaded = true;
			// Call createTextureFromImage() again with a valid image.glTextureObject
			// to just replace the default texture data with the desired image.
			utils.createTextureFromImage(image, flipV);
		}

		// Create a placeholder image, saving the
		// created texture object into the 'glTextureObject' field.
		image.glTextureObject = this.createTextureFromImage(image, flipV);

		// TGA images will require the custom TGA library,
		// since most browsers don't support it out-of-the-box.
		if (filename.lastIndexOf(".tga") != -1)
		{
			// Load asynchronously:
			image.isTGA = true;
			image.tgaImage = new TGA();
			image.tgaImage.open(filename, completionCallback, /* async = */ true);
		}
		else
		{
			image.htmlImage = new Image();

			// Once loading is complete, trigger this callback to
			// fill the texture with the actual data.
			image.htmlImage.onload = completionCallback;

			// This will start downloading the image or loading the file.
			// It is an asynchronous operation.
			image.htmlImage.src = filename;
		}

		// Add to table and return new texture:
		this.loadedTextures[filename] = image;
		return (image);
	},

	//
	// Dumps a list of the loaded textures as HTML text.
	//
	dumpLoadedTextures : function(htmlElement) {

		var dumpDiv = document.getElementById(htmlElement);
		if (dumpDiv)
		{
			var text = "-------- Loaded Textures: --------<br />";
			for (var t in this.loadedTextures)
			{
				text += "(" + this.loadedTextures[t].glTextureObject +
					" | ready:" + this.loadedTextures[t].isLoaded + ") => " + t + "<br />";
			}
			dumpDiv.innerHTML = text;
		}
	},

	//
	// Draws a full-screen quad with texture coordinates.
	// Useful for debug overlays and visualization of render targets.
	// The quadrilateral starts at 0,0 (lower-left corner).
	//
	drawFullScreenQuad : function(shaderProgram) {

		if (!shaderProgram)
		{
			utils.warning("Missing the shader program!");
			return;
		}

		// Only created once
		if (this.screenQuadVBO == null)
		{
			var verts = [
				// First triangle:
				 1.0,  1.0,
				-1.0,  1.0,
				-1.0, -1.0,
				// Second triangle:
				-1.0, -1.0,
				 1.0, -1.0,
				 1.0,  1.0
			];
			this.screenQuadVBO = this.gl.createBuffer();
			this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.screenQuadVBO);
			this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(verts), this.gl.STATIC_DRAW);
		}

		// Bind:
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.screenQuadVBO);
		this.gl.enableVertexAttribArray(shaderProgram.vertexAttributes.vertexPositionNDC);
		this.gl.vertexAttribPointer(shaderProgram.vertexAttributes.vertexPositionNDC, 2, this.gl.FLOAT, false, 0, 0);

		// Draw 6 vertexes => 2 triangles:
		this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

		// Cleanup:
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
	},

	// ---- Debug Line Drawing: ----

	// Debug line drawing context:
	debugLines : {
		lineCount        : 0,
		linesInitialized : false,
		needToUpdateVBO  : false,
		positions        : [],
		colors           : [],
		posVBO           : null,
		colorVBO         : null,
		shaderProgram    : null
	},

	//
	// Initialize the debug line drawing tool.
	// Must be called once before drawing the lines.
	//
	initDebugLines : function() {

		if (this.debugLines.linesInitialized == true)
		{
			// Silently avoid duplicate initializations.
			return;
		}

		// Create buffers:
		this.debugLines.posVBO   = this.gl.createBuffer();
		this.debugLines.colorVBO = this.gl.createBuffer();

		// Load shaders:
		var vertexAttibs = [
			{ name: "vertexPosition", index: 0 },
			{ name: "vertexColor",    index: 1 }
		];
		var shaderUniforms = [
			"mvpMatrix"
		];
		this.debugLines.shaderProgram = this.loadProgram(this.loadShader("debugLine-vs"),
				this.loadShader("debugLine-fs"), vertexAttibs, shaderUniforms);

		// Done!
		this.debugLines.linesInitialized = true;
	},

	//
	// Draws the debug lines that where buffered with addDebugLine().
	//
	drawDebugLines : function(mvpMatrix) {

		if ((this.debugLines.lineCount == 0) || (mvpMatrix == null))
		{
			return; // Nothing to draw.
		}

		// Shortcut variable:
		var shaderProgram = this.debugLines.shaderProgram;

		// Set shader program:
		this.gl.useProgram(shaderProgram);
		this.gl.uniformMatrix4fv(shaderProgram.uniforms.mvpMatrix, false, mvpMatrix);

		// Update only when new lines are added:
		if (this.debugLines.needToUpdateVBO == true)
		{
			// DYNAMIC_DRAW: We update once, use a few times, then discard.
			this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.debugLines.posVBO);
			this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.debugLines.positions), this.gl.DYNAMIC_DRAW);

			this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.debugLines.colorVBO);
			this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.debugLines.colors), this.gl.DYNAMIC_DRAW);

			this.debugLines.needToUpdateVBO = false;
		}

		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.debugLines.posVBO);
		this.gl.enableVertexAttribArray(shaderProgram.vertexAttributes.vertexPosition);
		this.gl.vertexAttribPointer(shaderProgram.vertexAttributes.vertexPosition, 3, this.gl.FLOAT, false, 0, 0);

		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.debugLines.colorVBO);
		this.gl.enableVertexAttribArray(shaderProgram.vertexAttributes.vertexColor);
		this.gl.vertexAttribPointer(shaderProgram.vertexAttributes.vertexColor, 3, this.gl.FLOAT, false, 0, 0);

		// Draw:
		this.gl.drawArrays(this.gl.LINES, 0, this.debugLines.lineCount * 2); // 2 vertexes per line

		// Cleanup:
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
	},

	//
	// Add a new debug line.
	// The line is assumed to be in world space and is not further transformed.
	// The line lives until the next clearDebugLines().
	//
	addDebugLine : function(from, to, colorRGB) {

		this.debugLines.positions.push(from[0]);
		this.debugLines.positions.push(from[1]);
		this.debugLines.positions.push(from[2]);
		this.debugLines.positions.push(to[0]);
		this.debugLines.positions.push(to[1]);
		this.debugLines.positions.push(to[2]);

		this.debugLines.colors.push(colorRGB[0]);
		this.debugLines.colors.push(colorRGB[1]);
		this.debugLines.colors.push(colorRGB[2]);
		this.debugLines.colors.push(colorRGB[0]);
		this.debugLines.colors.push(colorRGB[1]);
		this.debugLines.colors.push(colorRGB[2]);

		this.debugLines.lineCount++;
		this.debugLines.needToUpdateVBO = true;
	},

	//
	// Clears all lines added with addDebugLine().
	//
	clearDebugLines : function() {

		this.debugLines.needToUpdateVBO = false;
		this.debugLines.lineCount = 0;
		this.debugLines.positions = [];
		this.debugLines.colors    = [];
	}
};
