/*
 * ================================================================================================
 * -*- JavaScript -*-
 * File: input.js
 * Author: Guilherme R. Lampert
 * Created on: 2015-04-26
 * Brief: Keyboard and mouse input helpers.
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
jedi.Keys keyChar => keyCode map (constant):

Maps characters and key names to integer key codes.
Can be used with Input.isKeyDown/isKeyDown as well as
with the keyboard callbacks.

NOTE: These key codes were only tested on a Mac Laptop
keyboard, so expect a few discrepancies when porting.
The basic alphanumeric keys should be fine on any keyboard.
===========================================================
*/
jedi.Keys = jedi.makeImmutable({
	// Numerical keys:
	'0'         : 48,
	'1'         : 49,
	'2'         : 50,
	'3'         : 51,
	'4'         : 52,
	'5'         : 53,
	'6'         : 54,
	'7'         : 55,
	'8'         : 56,
	'9'         : 57,
	// Alphabet keys:
	'A'         : 65,
	'B'         : 66,
	'C'         : 67,
	'D'         : 68,
	'E'         : 69,
	'F'         : 70,
	'G'         : 71,
	'H'         : 72,
	'I'         : 73,
	'J'         : 74,
	'K'         : 75,
	'L'         : 76,
	'M'         : 77,
	'N'         : 78,
	'O'         : 79,
	'P'         : 80,
	'Q'         : 81,
	'R'         : 82,
	'S'         : 83,
	'T'         : 84,
	'U'         : 85,
	'V'         : 86,
	'W'         : 87,
	'X'         : 88,
	'Y'         : 89,
	'Z'         : 90,
	// Punctuation keys:
	':'         : 186,
	'+'         : 187,
	'<'         : 188,
	'-'         : 189,
	'>'         : 190,
	'?'         : 191,
	'~'         : 192,
	'{'         : 219,
	'|'         : 220,
	'}'         : 221,
	'"'         : 222,
	// Special keys / modifiers:
	'BACKSPACE' : 8,
	'TAB'       : 9,
	'RETURN'    : 13,
	'ENTER'     : 13,
	'SHIFT'     : 16,
	'CTRL'      : 17,
	'ALT'       : 18,
	'CAPS_LOCK' : 20,
	'SPACE'     : 32,
	'LEFT'      : 37,
	'UP'        : 38,
	'RIGHT'     : 39,
	'DOWN'      : 40,
	'LEFT_CMD'  : 91,
	'RIGHT_CMD' : 93
});

/*
===========================================================
jedi.Input singleton class:
===========================================================
*/
jedi.Input = (function () {

	/*
	 * Private data:
	 */
	var inputInitialized   = false;

	// User callbacks:
	var keyDownCallback    = null;
	var keyUpCallback      = null;
	var mouseMovedCallback = null;

	// Input state caches:
	var mousePosXY         = [0,0];
	var keyboardState      = []; // One entry for each `keyEvent.keyCode`. True for down, false for up.

	/*
	 * Internal helpers:
	 */
	function handleKeyDown(keyEvent) {
		keyboardState[keyEvent.keyCode] = true;

		if (keyDownCallback) {
			keyDownCallback(keyEvent.keyCode);
		}
	}

	function handleKeyUp(keyEvent) {
		keyboardState[keyEvent.keyCode] = false;

		if (keyUpCallback) {
			keyUpCallback(keyEvent.keyCode);
		}
	}

	function handleMouseMove(mouseEvent) {
		mousePosXY[0] = mouseEvent.clientX;
		mousePosXY[1] = mouseEvent.clientY;

		if (mouseMovedCallback) {
			mouseMovedCallback(mouseEvent.clientX, mouseEvent.clientY);
		}
	}

	/*
	 * Public interface:
	 */
	return {
		init : function (onKeyDown, onKeyUp, onMouseMoved) {
			if (inputInitialized) {
				jedi.logWarning("Duplicate Input initialization!");
				return true;
			}

			jedi.logComment("---- jedi.Input.init() ----");

			// These are optional. If not provided, user can still query input
			// states with `isKeyUp/Down` and `getMousePosition`.
			keyDownCallback      = onKeyDown;
			keyUpCallback        = onKeyUp;
			mouseMovedCallback   = onMouseMoved;

			document.onkeydown   = handleKeyDown;
			document.onkeyup     = handleKeyUp;
			document.onmousemove = handleMouseMove;

			jedi.logComment("Input initialization completed.");
			return (inputInitialized = true);
		},

		clear : function () {
			mousePosXY    = [0,0];
			keyboardState = [];
		},

		keyCodeToKey : function (keyCode) { // Key code to key string.
			for (var prop in jedi.Keys) {
				if (jedi.Keys.hasOwnProperty(prop)) {
					if (jedi.Keys[prop] == keyCode) {
						return prop;
					}
				}
			}
		},

		isKeyDown : function (keyCode) { // Takes one of the `jedi.Keys` constants.
			return keyboardState[keyCode] ? true : false;
		},

		isKeyUp : function (keyCode) { // Takes one of the `jedi.Keys` constants.
			return keyboardState[keyCode] ? false : true;
		},

		/*
		 * Miscellaneous accessors:
		 */
		getMousePosition : function () { return mousePosXY;       },
		isInitialized    : function () { return inputInitialized; }
	};
}());
