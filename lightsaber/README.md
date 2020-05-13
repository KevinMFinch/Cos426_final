
#WebGL rendering demos

----

##About:

This repository contains a couple of WebGL rendering demos that I wrote
as pastime and to further improve my JavaScript coding skills.

It also includes a tiny WebGL helper framework which I call "jedi".
This framework is a thin wrapper over the WebGL API that provides a
more object-oriented interface to the library. It is by no means complete
or better than something like [three.js](http://threejs.org/), but
it is usable, and still better than the raw WebGL API, plus it was an
interesting undertake writing it in JavaScript, coming from a C++ background...
Feel free to use it if you find it interesting or helpful!

##Directory Structure:

    +-webgl-tests/
     |
     +-demos/        => Soure code and supporting files for the individual demos.
      |
      +--hellocube/  => Minimal usage example of the jedi framework. Draws a colored cube.
      |
      +--doom3md5/   => Loads and displays a md5 model from Doom 3.
      |
      +--lightsaber/ => The fancy WebGL lightsaber demo, with sound effects and a couple post-processing effects.
      |
     ++-jedi/        => My homebrew WebGL wrapper and game framework.
     |
     +-shaders/      => GLSL shaders used by the demos.
     |
     +-thirdparty    => Third-party code, such as the glMatrix library.
     |
     +-misc/         => All kinds of extras...

##How to run the demos locally:

If you'd like to run these demos in your browser from the local file system, you need to
first fire up a local server, since your browser can't directly open files in the disk from
JavaScript, for safety reasons. The easiest way I've found to create a server in my local machine is
by using the built-in Python HTTP server module. Install Python in your machine (if you don't already have it),
navigate to the directory where the demos were downloaded and run the following command in the terminal:

    $ python -m SimpleHTTPServer

Done deal! Now a server will be running and servicing as `localhost` at port `8000`.
Just open the browser and type `localhost:8000` in the address bar and it should
show a list of files in the current directory. Selecting one of the `.html`s with
a demo name will start it.

Have fun!

##Browsers tested:

- **Safari 8.0.6 on MacOSX** - OK
- **Chrome 43.0.2 on MacOSX** - OK
- **FireFox 38.0.1 on MacOSX** - OK
- **Internet Explorer 11 on Win7** - Doom 3 Model Viewer fails to load TGA textures.
- **Safari on iOS** - OK, but might present depth precision issues on some devices (Z-fighting).

##License:

This project's source code is released under the [MIT License](http://opensource.org/licenses/MIT).

##Eye Candy:

![Hello Cube!](https://bytebucket.org/glampert/webgl-tests/raw/b4c4c8456632de401a7957dcb0202bfd81086179/misc/screens/cube.jpg "Hello Cube!")

![Lightsaber app](https://bytebucket.org/glampert/webgl-tests/raw/b4c4c8456632de401a7957dcb0202bfd81086179/misc/screens/lightsaber.jpg "Lightsaber app")

![Doom 3 MD5 model viewer](https://bytebucket.org/glampert/webgl-tests/raw/b4c4c8456632de401a7957dcb0202bfd81086179/misc/screens/md5viewer.jpg "Doom 3 MD5 model viewer")

----

You can test the demos above [from my website](http://glampert.com/webgl/).

