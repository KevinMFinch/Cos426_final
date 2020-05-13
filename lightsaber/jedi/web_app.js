/*
 * ================================================================================================
 * -*- JavaScript -*-
 * File: web_app.js
 * Author: Guilherme R. Lampert
 * Created on: 2015-04-26
 * Brief: Application context/interface and misc helpers.
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
jedi.WebApp singleton class:
===========================================================
*/
jedi.WebApp = (function () {

	/*
	 * Private data:
	 */
	var appInitialized  = false;

	// Frame callbacks:
	var updateCallback  = null;
	var renderCallback  = null;

	// Frame times:
	var startupMillisec = 0;
	var deltaMillisec   = 1.0 / 60.0; // Assume initial frame-rate of 60fps

	// `getTime()` is very inaccurate and requires instantiating
	// a new Date every time. Prefer a more efficient path if available.
	var hiResTimer = window.performance || {};
	hiResTimer.now = (function() {
		return hiResTimer.now       ||
		       hiResTimer.mozNow    ||
		       hiResTimer.msNow     ||
		       hiResTimer.oNow      ||
		       hiResTimer.webkitNow ||
		       Date.now             ||
		       function () { return (new Date()).getTime(); };
	})();

	// Function that registers a user callback to run every frame using
	// the proper browser API or a portable fallback with `window.setTimeout()`.
	var browserRequestAnimFrameFunc =
		window.requestAnimationFrame       ||
		window.webkitRequestAnimationFrame ||
		window.mozRequestAnimationFrame    ||
		window.oRequestAnimationFrame      ||
		window.msRequestAnimationFrame     ||
		function (callback) { window.setTimeout(callback, 1000.0 / 60.0); };

	/*
	 * Internal helpers:
	 */
	function formatStrList(list) {
		if (list.length == 0) {
			return "[none]<br />";
		}

		// Build a string with HTML line-breaks for each item in the list/array.
		var string = "";
		for (var i = 0; i < list.length; ++i) {
			string += list[i] + "<br />";
		}
		return string;
	}

	function mainLoop() {
		var t0Millisec = hiResTimer.now();

		browserRequestAnimFrameFunc(mainLoop);

		if (updateCallback) {
			updateCallback(deltaMillisec);
		}
		if (renderCallback) {
			renderCallback(deltaMillisec);
		}

		var t1Millisec = hiResTimer.now();
		deltaMillisec  = t1Millisec - t0Millisec;

		// Ugly hack to prevent (some) animation freezing if
		// we are using the crappy `getTime()` fallback path.
		if (deltaMillisec == 0) {
			deltaMillisec = (1.0 / 60.0); // Just assume we are running really fast, at 60fps.
		}
	}

	/*
	 * Public interface:
	 */
	return {
		init : function (onUpdate, onRender) {
			if (appInitialized) {
				jedi.logWarning("Duplicate WebApp initialization!");
				return true;
			}

			jedi.logComment("---- jedi.WebApp.init() ----");

			startupMillisec = hiResTimer.now();
			updateCallback  = onUpdate;
			renderCallback  = onRender;

			jedi.logComment("WebApp initialization completed.");
			return (appInitialized = true);
		},

		run : function () {
			jedi.assert(appInitialized, "Call WebApp.init() first!");
			jedi.logComment("Entering application main loop...");
			mainLoop();
		},

		loadPageAsync : function (url, completionHandler) {
			jedi.assert(url, "No URL provided!");
			jedi.logComment("Trying to load page '" + url + "' asynchronously...");

			var reqHandler = function () {
				var successful;
				if (this.status == 200 && this.responseText != null) {
					jedi.logComment("Page '" + url + "' loaded!");
					successful = true;
				} else {
					// Something went wrong...
					jedi.logWarning("Failed to load page '" + url + "'. Status: " + this.status);
					successful = false;
				}
				if (completionHandler) {
					completionHandler(successful, this.responseText);
				}
			};

			var xmlHttpReq = new XMLHttpRequest();
			xmlHttpReq.onload = reqHandler;
			xmlHttpReq.open(/* method = */ "GET", /* path = */ url, /* async = */ true);
			xmlHttpReq.send();
		},

		renderErrorPage : function (errorPageUrl, destElementId, errorDumpElementId) {
			// Supply defaults if missing:
			if (!errorPageUrl) {
				errorPageUrl = "error.html";
			}
			if (!destElementId) {
				destElementId = "page_body";
			}
			if (!errorDumpElementId) {
				errorDumpElementId = "error_dump";
			}

			this.loadPageAsync(errorPageUrl,
				function (successful, responseText) {
					if (!successful) {
						jedi.fatalError("Unable to load error dump page '" + errorPageUrl + "'!");
					}

					// Need to first convert raw text to DOM so we can edit the error dump element.
					var errorPageHtmlDoc = (new DOMParser()).parseFromString(responseText, "text/html");

					// Fill error element in the loaded page with warning and error lists:
					var errorDumpElement = errorPageHtmlDoc.getElementById(errorDumpElementId);
					if (errorDumpElement) {
						errorDumpElement.innerHTML = "Warnings: <br />" +
						                             "========= <br />" +
						                             formatStrList(jedi.warningList) + "<br />" +
						                             "Errors:   <br />" +
						                             "========= <br />" +
						                             formatStrList(jedi.errorList) + "<br />";
					} else {
						jedi.logError("No such element '" + errorDumpElementId + "' in the error page!");
					}

					// Overwrite this page with the error page contents:
					var destElement = document.getElementById(destElementId);
					if (destElement) {
						destElement.innerHTML = errorPageHtmlDoc.body.innerHTML;
					} else {
						jedi.logError("No such element '" + destElementId + "' in the current page!");
						return;
					}

					// Completed successfully. Error page should be showing already.
					jedi.logComment("Error page is rendered!");
				}
			);
		},

		renderLoadingPage : function (loadingPageUrl, destElementId) {
			// Supply defaults if missing:
			if (!loadingPageUrl) {
				loadingPageUrl = "loading.html";
			}
			if (!destElementId) {
				destElementId = "page_body";
			}

			this.loadPageAsync(loadingPageUrl,
				function (successful, responseText) {
					if (!successful) {
						jedi.fatalError("Unable to load loading screen page '" + loadingPageUrl + "'!");
					}

					var destElement = document.getElementById(destElementId);
					if (destElement) {
						destElement.innerHTML = responseText;
					} else {
						jedi.logError("No such element '" + destElementId + "' in the current page!");
						return;
					}

					// Completed successfully. Loading screen page should be showing already.
					jedi.logComment("Loading screen page is rendered!");
				}
			);
		},

		/*
		 * Miscellaneous accessors:
		 */
		isInitialized     : function () { return appInitialized; },
		deltaMilliseconds : function () { return deltaMillisec;  },
		clockMilliseconds : function () { return hiResTimer.now() - startupMillisec; }
	};
}());
