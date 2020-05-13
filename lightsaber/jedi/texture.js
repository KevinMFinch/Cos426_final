/*
 * ================================================================================================
 * -*- JavaScript -*-
 * File: texture.js
 * Author: Guilherme R. Lampert
 * Created on: 2015-04-29
 * Brief: Object wrapper for a WebGL texture with methods to load from an image file.
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
Texture constants and enumerations:
===========================================================
*/

/*
 * Texture types/usages
 */
jedi.TextureType = jedi.makeImmutable({
	TEXTURE_2D  : 1, // 2D texture (WxH).
	CUBE_MAP    : 2, // 6-sided cube-map for skyboxes and environment-maps.
	UNDEFINED   : undefined // Dummy value; Used internally.
});

/*
 * Texture addressing (or wrapping) modes
 */
jedi.TextureAddressing = jedi.makeImmutable({
	CLAMP       : 1, // Clamp (or stretch) texture to fill surface using the color of the edge pixel.
	REPEAT      : 2, // Repeat texture to fill surface.
	DEFAULT     : 3  // Default addressing mode. Same as 'REPEAT'.
});

/*
 * Texture filtering modes
 */
jedi.TextureFilter = jedi.makeImmutable({
	NEAREST     : 1, // Nearest neighbor (or Manhattan Distance) filtering. Worst quality, best performance.
	LINEAR      : 2, // Linear, mip-mapped filtering. Reasonable quality, good performance.
	ANISOTROPIC : 3, // Anisotropic filtering. Best quality, more expensive. Paired with an anisotropy amount.
	DEFAULT     : 4  // Let the renderer decide based on global configurations.
});

/*
 * Internal texture image formats
 */
jedi.TextureFormat = jedi.makeImmutable({
	RGB_U8      : 1, // RGB  8:8:8   color.
	RGBA_U8     : 2, // RGBA 8:8:8:8 color.
	UNDEFINED   : undefined // Dummy value; Used internally.
});

/*
===========================================================
Convert our enum constants to WebGL constants:
===========================================================
*/

jedi.textureType2WebGL = function (type) { // -> GLenum
	var gl = jedi.Renderer.getWebGLContext();

	switch (type) {
	case jedi.TextureType.TEXTURE_2D : return gl.TEXTURE_2D;
	case jedi.TextureType.CUBE_MAP   : return gl.TEXTURE_CUBE_MAP;
	default : jedi.fatalError("Invalid jedi.TextureType!");
	} // switch (type)
};

jedi.textureAddressing2WebGL = function (addr) { // -> GLenum
	var gl = jedi.Renderer.getWebGLContext();

	switch (addr) {
	case jedi.TextureAddressing.CLAMP   : return gl.CLAMP_TO_EDGE;
	case jedi.TextureAddressing.REPEAT  : return gl.REPEAT;
	case jedi.TextureAddressing.DEFAULT : return gl.REPEAT;
	default : jedi.fatalError("Invalid jedi.TextureAddressing!");
	} // switch (addr)
};

jedi.textureFilter2WebGL = function (filter, withMipMaps) { // -> { minFilter: GLenum, magFilter: GLenum }
	var gl = jedi.Renderer.getWebGLContext();
	var result = {};

	switch (filter) {
	case jedi.TextureFilter.NEAREST :
		result.minFilter = withMipMaps ? gl.NEAREST_MIPMAP_NEAREST : gl.NEAREST;
		result.magFilter = gl.NEAREST;
		break;

	case jedi.TextureFilter.LINEAR :
		result.minFilter = withMipMaps ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR;
		result.magFilter = gl.LINEAR;
		break;

	case jedi.TextureFilter.ANISOTROPIC :
		// Same as trilinear, but user also have to set `gl.TEXTURE_MAX_ANISOTROPY_EXT`.
		result.minFilter = gl.LINEAR_MIPMAP_LINEAR;
		result.magFilter = gl.LINEAR;
		break;

	case jedi.TextureFilter.DEFAULT :
		// Query the renderer:
		result = jedi.Renderer.getDefaultWebGLTextureFilter(withMipMaps);
		break;

	default :
		jedi.fatalError("Invalid jedi.TextureFilter!");
	} // switch (filter)

	return result;
};

jedi.textureFormat2WebGL = function (pixelFormat) { // -> { internalFormat: GLenum, format: GLenum, type: GLenum }
	var gl = jedi.Renderer.getWebGLContext();
	var result = {};

	switch (pixelFormat) {
	case jedi.TextureFormat.RGB_U8 :
		result.internalFormat = gl.RGB;
		result.format         = gl.RGB;
		result.type           = gl.UNSIGNED_BYTE;
		break;

	case jedi.TextureFormat.RGBA_U8 :
		result.internalFormat = gl.RGBA;
		result.format         = gl.RGBA;
		result.type           = gl.UNSIGNED_BYTE;
		break;

	default :
		jedi.fatalError("Invalid jedi.TextureFormat!");
	} // switch (pixelFormat)

	return result;
};

/*
===========================================================
jedi.Texture class:
===========================================================
*/
jedi.Texture = function (texName) {
	this.detail = {
		gl               : jedi.Renderer.getWebGLContext(),
		webGLTextureObj  : null,
		glBindingTarget  : 0,
		width            : 0,
		height           : 0,
		anisotropy       : 0,
		mipmapped        : false,
		addressing       : jedi.TextureAddressing.DEFAULT,
		filter           : jedi.TextureFilter.DEFAULT,
		type             : jedi.TextureType.UNDEFINED,
		format           : jedi.TextureFormat.UNDEFINED,
		asyncLoadPending : false,               // Only set if loading an image with `initAsyncFromFile()`.
		name             : texName || "unnamed" // Filename that originated the texture or some other unique id.
	};

	/*
	 * Initialize the default texture for the first and only time:
	 */
	if (typeof jedi.Texture.DEFAULT_2D_TEXTURE === "undefined") {
		// This will init the Texture if not created yet.
		jedi.Texture.getDefault();
	}
};

/*
 * ---- Methods of Texture: ----
 */

jedi.Texture.prototype.initEmpty = function (wantsMipmaps, textureType, addressingMode,
                                             filterType, anisotropyAmount, texName) { // -> bool

	if (this.detail.webGLTextureObj) {
		jedi.logWarning("Dispose the current texture before initializing it again!");
		return true;
	}

	this.detail.webGLTextureObj = this.detail.gl.createTexture();
	if (!this.detail.webGLTextureObj) {
		jedi.logError("Failed to allocate new WebGL texture object! Possibly out of memory...");
		return false;
	}

	this.detail.mipmapped       = wantsMipmaps     || false;
	this.detail.type            = textureType      || jedi.TextureType.TEXTURE_2D;
	this.detail.addressing      = addressingMode   || jedi.TextureAddressing.DEFAULT;
	this.detail.filter          = filterType       || jedi.TextureFilter.DEFAULT;
	this.detail.anisotropy      = anisotropyAmount || 0;
	this.detail.glBindingTarget = jedi.textureType2WebGL(this.detail.type);

	if (texName) {
		this.detail.name = texName;
	}

	return true;
};

jedi.Texture.prototype.initWithData = function (data, width, height, pixelFormat, flipV, wantsMipmaps, textureType,
                                                addressingMode, filterType, anisotropyAmount, texName) { // -> bool

	jedi.assert(width  > 0);
	jedi.assert(height > 0);
	jedi.assert(data, "Provide valid pixel data for texture!");

	if (!this.initEmpty(wantsMipmaps, textureType, addressingMode, filterType, anisotropyAmount, texName)) {
		jedi.logError("Failed to initialize texture '" + this.detail.name + "'! initEmpty() failed.");
		return false;
	}

	// We have to break the current texture binding when creating a new one.
	this.detail.gl.bindTexture(this.detail.glBindingTarget, this.detail.webGLTextureObj);

	// If the image needs to be flipped vertically, such as it is with JPEGs,
	// WebGL offers us the UNPACK_FLIP_Y_WEBGL extension. This is of great help,
	// since accessing the raw pixel data of an image in JS is not a trivial task.
	if (flipV === undefined || flipV === null) {
		flipV = false;
	}
	this.detail.gl.pixelStorei(this.detail.gl.UNPACK_FLIP_Y_WEBGL, flipV);

	// Upload data to the GL:
	var texImgInfo = jedi.textureFormat2WebGL(pixelFormat);
	this.detail.gl.texImage2D(this.detail.glBindingTarget, 0, texImgInfo.internalFormat,
			width, height, 0, texImgInfo.format, texImgInfo.type, data);

	// Save new parameters:
	this.detail.width  = width;
	this.detail.height = height;
	this.detail.format = pixelFormat;

	// Refresh OpenGL states to match this texture:
	this.updateSamplerParameters();
	this.regenerateMipmaps();

	// Clear texture binding.
	this.detail.gl.bindTexture(this.detail.glBindingTarget, null);

	jedi.Renderer.checkErrors();
	if (!this.isPowerOfTwo()) {
		jedi.logComment("New Texture '" + this.detail.name + "' initialized (NOTE: Texture size not power-of-two!)");
	} else {
		jedi.logComment("New Texture '" + this.detail.name + "' initialized.");
	}
	return true;
};

jedi.Texture.prototype.initWithImage = function (img, pixelFormat, flipV, wantsMipmaps, textureType,
                                                 addressingMode, filterType, anisotropyAmount, texName) { // -> bool

	jedi.assert(img, "Provide a valid image for texture initialization!");

	if (!this.initEmpty(wantsMipmaps, textureType, addressingMode, filterType, anisotropyAmount, texName)) {
		jedi.logError("Failed to initialize texture '" + this.detail.name + "'! initEmpty() failed.");
		return false;
	}

	// We have to break the current texture binding when creating a new one.
	this.detail.gl.bindTexture(this.detail.glBindingTarget, this.detail.webGLTextureObj);

	// If the image needs to be flipped vertically, such as it is with JPEGs,
	// WebGL offers us the UNPACK_FLIP_Y_WEBGL extension. This is of great help,
	// since accessing the raw pixel data of an image in JS is not a trivial task.
	if (flipV === undefined || flipV === null) {
		flipV = false;
	}
	this.detail.gl.pixelStorei(this.detail.gl.UNPACK_FLIP_Y_WEBGL, flipV);

	// Upload data to the GL:
	var texImgInfo = jedi.textureFormat2WebGL(pixelFormat);
	this.detail.gl.texImage2D(this.detail.glBindingTarget, 0, texImgInfo.internalFormat,
			texImgInfo.format, texImgInfo.type, img);

	// Save new parameters:
	this.detail.width  = img.width;
	this.detail.height = img.height;
	this.detail.format = pixelFormat;

	// Refresh OpenGL states to match this texture:
	this.updateSamplerParameters();
	this.regenerateMipmaps();

	// Clear texture binding.
	this.detail.gl.bindTexture(this.detail.glBindingTarget, null);

	jedi.Renderer.checkErrors();
	if (!this.isPowerOfTwo()) {
		jedi.logComment("New Texture '" + this.detail.name + "' initialized (NOTE: Texture size not power-of-two!)");
	} else {
		jedi.logComment("New Texture '" + this.detail.name + "' initialized.");
	}
	return true;
};

jedi.Texture.prototype.initAsyncFromFile = function (filename, completionCallback, flipV, wantsMipmaps, textureType,
                                                     addressingMode, filterType, anisotropyAmount, texName) { // -> bool

	jedi.assert(filename, "Invalid image filename!");
	jedi.assert(!this.isLoading(), "An async load request is already in-flight for '" + this.detail.name + "'!");

	var isTGA      = false;
	var textureRef = this;
	var lastDot    = filename.lastIndexOf('.');

	if (lastDot >= 0) {
		var extension = filename.substring(lastDot).toLowerCase();
		if (extension === ".tga") {
			isTGA = true;
		}
	}

	if (isTGA) {

		// TGA images will require the custom TGA loader library,
		// since most browsers don't support it out-of-the-box.
		var tgaImage = new TGA();

		textureRef.detail.asyncLoadPending = true;
		tgaImage.open(filename, 
			function () {

				// Force image to RGBA. It seems to work better with WebGL.
				var imageData = {
					width  : tgaImage.getWidth(),
					height : tgaImage.getHeight(),
					data   : new Uint8Array(tgaImage.getWidth() * tgaImage.getHeight() * 4)
				};

				textureRef.initWithData(tgaImage.getImageData(imageData).data, 
					tgaImage.getWidth(), tgaImage.getHeight(), jedi.TextureFormat.RGBA_U8, 
					flipV, wantsMipmaps, textureType, addressingMode, filterType, 
					anisotropyAmount, (texName || filename));

				textureRef.detail.asyncLoadPending = false;

				if (completionCallback) {
					completionCallback(textureRef, "'TGA.open' completed for '" + filename + "'!");
				}
			},
			/* async = */ true);

	} else {

		// Supported format. Let the browser load and decompress the image.
		var domImage = new Image();

		domImage.onload = function () {
			// Initialized the texture object / set up WebGL handles:
			var success = textureRef.initWithImage(domImage, jedi.TextureFormat.RGBA_U8, flipV, wantsMipmaps,
					textureType, addressingMode, filterType, anisotropyAmount, (texName || filename));

			textureRef.detail.asyncLoadPending = false;

			// Notify completion to user if a callback was provided. `null` will indicate a
			// failure in the WebGL texture setup. More info will be logged in such case.
			if (completionCallback) {
				completionCallback(
					(success ? textureRef : null),
					(success ? "'Image.onload' completed for '"  + filename + "'!" :
					 	"'Texture.initWithImage()' failed for '" + filename + "'!")
				);
			}
		};

		domImage.onerror = function () {
			textureRef.detail.asyncLoadPending = false;
			var errorMessage = "'Image.onerror' triggered! Unable to load image file '" + filename + "'";

			if (completionCallback) {
				completionCallback(null, errorMessage);
			} else {
				jedi.logError(errorMessage);
			}
		};

		textureRef.detail.asyncLoadPending = true;
		domImage.src = filename; // Begin asynchronous download.
	}

	// No way to check errors now, so always succeed.
	return true;
};

jedi.Texture.prototype.initDefault = function () { // -> bool
	if (!this.initEmpty(false, jedi.TextureType.TEXTURE_2D,
		jedi.TextureAddressing.DEFAULT, jedi.TextureFilter.DEFAULT, 0, "default")) {
		return false;
	}

	// The default texture is an ugly 2x2 pink image. Easy to debug.
	var defaultImageData = new Uint8Array([
		0xFF, 0x14, 0x93, 0xFF,   0xFF, 0x14, 0x93, 0xFF,
		0xFF, 0x14, 0x93, 0xFF,   0xFF, 0x14, 0x93, 0xFF ]);

	this.detail.gl.bindTexture(this.detail.glBindingTarget, this.detail.webGLTextureObj);
	this.detail.gl.pixelStorei(this.detail.gl.UNPACK_FLIP_Y_WEBGL, false);

	// 2x2 pixels RGBA image.
	this.detail.gl.texImage2D(this.detail.glBindingTarget, 0, this.detail.gl.RGBA,
			2, 2, 0, this.detail.gl.RGBA, this.detail.gl.UNSIGNED_BYTE, defaultImageData);

	this.detail.width  = 2;
	this.detail.height = 2;
	this.detail.format = jedi.TextureFormat.RGBA_U8;
	this.updateSamplerParameters();

	this.detail.gl.bindTexture(this.detail.glBindingTarget, null);

	jedi.Renderer.checkErrors();
	jedi.logComment("Initialized a default texture.");
	return true;
};

jedi.Texture.getDefault = function () { // -> jedi.Texture
	if (jedi.Texture.DEFAULT_2D_TEXTURE) {
		return jedi.Texture.DEFAULT_2D_TEXTURE;
	}

	// A default debug texture for the TEXTURE_2D target.
	// Initialized when the first texture is created.
	// Shared by the whole application; Immutable.

	// Define the property:
	jedi.Texture.DEFAULT_2D_TEXTURE = null;

	// Initialize the object:
	jedi.Texture.DEFAULT_2D_TEXTURE = new jedi.Texture();
	jedi.Texture.DEFAULT_2D_TEXTURE.initDefault();

	// Freeze it / make it immutable:
	jedi.makeImmutable(jedi.Texture.DEFAULT_2D_TEXTURE);
	return jedi.Texture.DEFAULT_2D_TEXTURE;
};

jedi.Texture.prototype.updateSamplerParameters = function () { // -> void
	if (this.detail.webGLTextureObj) {
		// gl.TEXTURE_WRAP:
		var glAddressingMode = jedi.textureAddressing2WebGL(this.detail.addressing);
		this.detail.gl.texParameteri(this.detail.glBindingTarget, this.detail.gl.TEXTURE_WRAP_S, glAddressingMode);
		this.detail.gl.texParameteri(this.detail.glBindingTarget, this.detail.gl.TEXTURE_WRAP_T, glAddressingMode);
		// gl.TEXTURE_FILTER:
		var glFilter = jedi.textureFilter2WebGL(this.detail.filter, this.detail.mipmapped);
		this.detail.gl.texParameteri(this.detail.glBindingTarget, this.detail.gl.TEXTURE_MAG_FILTER, glFilter.magFilter);
		this.detail.gl.texParameteri(this.detail.glBindingTarget, this.detail.gl.TEXTURE_MIN_FILTER, glFilter.minFilter);
	}
};

jedi.Texture.prototype.regenerateMipmaps = function () { // -> void
	if (this.detail.webGLTextureObj && this.detail.mipmapped) {
		if (this.isPowerOfTwo()) {
			jedi.logComment("Generating mipmaps for '" + this.detail.name + "'...");
			//
			// Now automatically generate a mipmap chain for the texture.
			//  NOTE: This doesn't work with non power-of-two textures!
			//  Good thread to take a look at on SO: http://stackoverflow.com/a/19748905/1198654
			//
			this.detail.gl.generateMipmap(this.detail.glBindingTarget);
		} else {
			jedi.logWarning("Texture '" + this.detail.name + "' is not PoT. Can't generate mipmaps!");
		}
	}
};

jedi.Texture.prototype.getWidth = function () { // -> int
	return this.detail.width;
};

jedi.Texture.prototype.getHeight = function () { // -> int
	return this.detail.height;
};

jedi.Texture.prototype.getAnisotropy  = function () { // -> int
	return this.detail.anisotropy;
};

jedi.Texture.prototype.getAddressing  = function () { // -> jedi.TextureAddressing
	return this.detail.addressing;
};

jedi.Texture.prototype.getFilter = function () { // -> jedi.TextureFilter
	return this.detail.filter;
};

jedi.Texture.prototype.getType = function () { // -> jedi.TextureType
	return this.detail.type;
};

jedi.Texture.prototype.getFormat = function () { // -> jedi.TextureFormat
	return this.detail.format;
};

jedi.Texture.prototype.getName = function () { // -> String
	return this.detail.name;
};

jedi.Texture.prototype.isMipmapped = function () { // -> bool
	return this.detail.mipmapped;
};

jedi.Texture.prototype.isPowerOfTwo = function () { // -> bool
	var wPoT = (this.detail.width  > 0) && ((this.detail.width  & (this.detail.width  - 1)) == 0);
	var hPoT = (this.detail.height > 0) && ((this.detail.height & (this.detail.height - 1)) == 0);
	return wPoT && hPoT;
};

jedi.Texture.prototype.isLoading = function () { // -> bool
	return this.detail.asyncLoadPending;
};

jedi.Texture.prototype.isDefault = function () { // -> bool
	return this.detail.name === "default";
};

jedi.Texture.prototype.setAnisotropy = function (anisotropyAmount) { // -> void
	this.detail.anisotropy = anisotropyAmount;
	// Should updateSamplerParameters() afterwards!!!
};

jedi.Texture.prototype.setAddressing = function (addressingMode) { // -> void
	this.detail.addressing = addressingMode;
	// Should updateSamplerParameters() afterwards!!!
};

jedi.Texture.prototype.setFilter = function (filterType) { // -> void
	this.detail.filter = filterType;
	// Should updateSamplerParameters() afterwards!!!
};

jedi.Texture.prototype.setName = function (newName) { // -> void
	this.detail.name = newName;
};

jedi.Texture.prototype.dispose = function () { // -> void
	if (this.detail.webGLTextureObj) {
		// Unbind first if needed.
		var textureBinding = (this.detail.type === jedi.TextureType.CUBE_MAP) ?
		                      this.detail.gl.TEXTURE_BINDING_CUBE_MAP :
		                      this.detail.gl.TEXTURE_BINDING_2D;

		if (this.detail.gl.getParameter(textureBinding) === this.detail.webGLTextureObj) {
			this.detail.gl.bindTexture(this.detail.glBindingTarget, null);
		}

		this.detail.gl.deleteTexture(this.detail.webGLTextureObj);
		this.detail.webGLTextureObj = null;

		// Set most parameters to back defaults:
		this.detail.glBindingTarget  = 0;
		this.detail.width            = 0;
		this.detail.height           = 0;
		this.detail.anisotropy       = 0;
		this.detail.mipmapped        = false;
		this.detail.addressing       = jedi.TextureAddressing.DEFAULT;
		this.detail.filter           = jedi.TextureFilter.DEFAULT;
		this.detail.type             = jedi.TextureType.UNDEFINED;
		this.detail.format           = jedi.TextureFormat.UNDEFINED;
		this.detail.asyncLoadPending = false;

		if (this.isDefault()) {
			this.detail.name = "unnamed";
		}
	}
};

jedi.Texture.prototype.bind = function (texUnit) { // -> void
	if (!texUnit || texUnit < 0) {
		texUnit = 0;
	}

	if (this.detail.webGLTextureObj && !this.isLoading()) {
		jedi.assert(this.detail.glBindingTarget, "Currupted 'glBindingTarget'!");
		this.detail.gl.activeTexture(this.detail.gl.TEXTURE0 + texUnit);
		this.detail.gl.bindTexture(this.detail.glBindingTarget, this.detail.webGLTextureObj);
	} else {
		// Invalid texture object or still loading. Bind a default.
		jedi.Texture.DEFAULT_2D_TEXTURE.bind(texUnit);
	}
};

jedi.Texture.bindNull = function (texUnit) { // -> void ['static' method]
	if (!texUnit || texUnit < 0) {
		texUnit = 0;
	}

	var gl = jedi.Renderer.getWebGLContext();

	// Make given unit active:
	gl.activeTexture(gl.TEXTURE0 + texUnit);

	// Clear both targets currently supported by WebGL.
	gl.bindTexture(gl.TEXTURE_2D,       null);
	gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
};

jedi.Texture.prototype.isBound = function (texUnit) { // -> bool
	if (!this.detail.webGLTextureObj) {
		return false;
	}

	var textureBinding = (this.detail.type === jedi.TextureType.CUBE_MAP) ?
	                      this.detail.gl.TEXTURE_BINDING_CUBE_MAP :
	                      this.detail.gl.TEXTURE_BINDING_2D;

	return this.detail.gl.getParameter(textureBinding) === this.detail.webGLTextureObj;
};
