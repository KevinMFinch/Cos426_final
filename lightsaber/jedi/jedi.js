/*
 * ================================================================================================
 * -*- JavaScript -*-
 * File: jedi.js
 * Author: Guilherme R. Lampert
 * Created on: 2015-04-25
 * Brief: Common code and types.
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
if (typeof jedi !== "undefined") {
	alert("Error: 'jedi.js' must be the first script imported/loaded!");
	throw "Script load error";
}
var jedi = {}; /* This must be the fist reference to the script, so declare our namespace. */

/*
===========================================================
jedi.warningList[] & jedi.errorList[] public properties:
===========================================================
*/
jedi.warningList = [];
jedi.errorList   = [];

/*
===========================================================
jedi.hasDeveloperConsole() function:
===========================================================
*/
jedi.hasDeveloperConsole = function () {
	return typeof console !== "undefined" && console !== null;
};

/*
===========================================================
jedi.logComment() function:
===========================================================
*/
jedi.logComment = function (message) {
	if (jedi.hasDeveloperConsole()) {
		console.log("%c[c] %s", "color:green; font-size:10pt", message);
	}
};

/*
===========================================================
jedi.logWarning() function:
===========================================================
*/
jedi.logWarning = function (message) {
	if (jedi.hasDeveloperConsole()) {
		console.warn("%c[w] %s", "color:orange; font-size:10pt", message);
	}
	jedi.warningList.push(message);
};

/*
===========================================================
jedi.logError() function:
===========================================================
*/
jedi.logError = function (message) {
	if (jedi.hasDeveloperConsole()) {
		console.error("%c[e] %s", "color:red; font-size:10pt", message);
	}
	jedi.errorList.push(message);
};

/*
===========================================================
jedi.fatalError() function:
===========================================================
*/
jedi.fatalError = function (message) {
	if (jedi.hasDeveloperConsole()) {
		console.error("%c[f] %s", "color:red; background:yellow; font-size:10pt", message);
	}
	jedi.errorList.push(message);
	throw "Breaking due to fatal error: '" + message + "'";
};

/*
===========================================================
jedi.assert() function:
===========================================================
*/
jedi.assert = function (expr, message) {
	if (!expr) {
		if (!message) {
			message = "Unknown error";
		}

		jedi.errorList.push(message);

		if (jedi.hasDeveloperConsole()) {
			console.assert(expr, message);
		} else {
			throw "Assertion failed: '" + expr + "', " + message;
		}
	}
};

/*
===========================================================
jedi.clamp() function:
===========================================================
*/

jedi.clamp = function (x, minimum, maximum) {
	return (x < minimum) ? minimum : (x > maximum) ? maximum : x;
};

/*
===========================================================
jedi.makeImmutable() function:
===========================================================
*/
jedi.makeImmutable = function (obj) {
	if (!obj || !Object.freeze) {
		return obj;
	}

	// The following doesn't play well with jQuery!!!
	// No idea why, it just crashes...
	/*
	//
	// This performs a "deep freeze" of the given object.
	// E.g. recursively freezes any sub-object in its hierarchy.
	//
	// Adapted from a code sample found on MDN:
	//  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze
	//
	// Having this wrapper over a raw `Object.freeze()` call also
	// allows us to provide a no-op fallback if the function is
	// not supported on a target browser.
	//
	var prop, propKey;
	Object.freeze(obj); // First freeze the parent object.

	// Now freeze its children:
	for (propKey in obj) {
		prop = obj[propKey];

		if (!prop || typeof prop !== "object" || !obj.hasOwnProperty(propKey) || Object.isFrozen(prop)) {
			// If the object is on the prototype, not an object, or is already frozen,
			// skip it. Note that this might leave an unfrozen reference somewhere in the
			// object if there is an already frozen object containing an unfrozen object.
			continue;
		}

		jedi.makeImmutable(prop); // Recurse down the object hierarchy.
	}
	*/

	// "Shallow freeze" as a fallback.
	return Object.freeze(obj);
};
