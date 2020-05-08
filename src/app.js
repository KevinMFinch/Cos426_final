/**
 * app.js
 *
 * This is the first file loaded. It sets up the Renderer,
 * Scene and Camera. It also starts the render loop and
 * handles window resizes.
 *
 */
import {
  WebGLRenderer,
  PerspectiveCamera,
  Vector3,
  Vector2
} from 'three';
import {
  OrbitControls
} from 'three/examples/jsm/controls/OrbitControls.js';
import {
  SeedScene
} from 'scenes';
import {
  EffectComposer
} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {
  UnrealBloomPass
} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {
  RenderPass
} from 'three/examples/jsm/postprocessing/RenderPass.js';

document.getElementById('startButton').addEventListener('click', () => initGame());
document.getElementById('replayButton').addEventListener('click', () => initGame());


let scene = null;
let camera = null;
let renderer = null;

const initGame = () => {
  console.log('init game');
  document.getElementById('menu-screen').style.display = 'none';
  document.getElementById('finish-screen').style.display = 'none';
  // Initialize core ThreeJS components
  const scene = new SeedScene(endGame);

  // glow
  var composer;

  var params = {
    exposure: 1,
    bloomStrength: 1.5,
    bloomThreshold: 0,
    bloomRadius: 1
  };

  const renderer = new WebGLRenderer({
    antialias: true,
  });
  const camera = new PerspectiveCamera();

  const renderScene = new RenderPass( scene, camera );

  const vec = new Vector2( window.innerWidth, window.innerHeight );
  const bloomPass = new UnrealBloomPass(vec, 1.5, 0.4, 0.85 );
  bloomPass.threshold = params.bloomThreshold;
  bloomPass.strength = params.bloomStrength;
  bloomPass.radius = params.bloomRadius;

  composer = new EffectComposer( renderer );
  composer.setSize( window.innerWidth, window.innerHeight );
  composer.addPass( renderScene );
  composer.addPass( bloomPass );

  // Set up camera
  camera.position.set(0, 300, -300);
  camera.lookAt(new Vector3(0, 0, 0));

  // Set up renderer, canvas, and minor CSS adjustments
  const canvas = renderer.domElement;
  renderer.setPixelRatio(window.devicePixelRatio);
  canvas.style.display = 'block'; // Removes padding below canvas
  document.body.style.margin = 0; // Removes margin around page
  document.body.style.overflow = 'hidden'; // Fix scrolling
  document.body.appendChild(canvas);

  // Set up controls
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableKeys = false;
  controls.minDistance = 4;
  controls.update();

  // Render loop
  const onAnimationFrameHandler = (timeStamp) => {
    controls.update();
    composer.render(scene, camera);
    scene.update && scene.update(timeStamp);
    if (!scene.state.gameOver)
      window.requestAnimationFrame(onAnimationFrameHandler);
  };
  window.requestAnimationFrame(onAnimationFrameHandler);

  // Resize Handler
  const windowResizeHandler = () => {
    const {
      innerHeight,
      innerWidth
    } = window;
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  windowResizeHandler();
  window.addEventListener('resize', windowResizeHandler, false);

  const onKeyDown = (keyEvent) => {
    const turningMoves = ['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight'];
    if (turningMoves.includes(keyEvent.code)) {
      scene.keyUpdate && scene.keyUpdate(keyEvent.code, true);
    }
  };

  const onKeyUp = (keyEvent) => {
    const turningMoves = ['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight'];
    if (turningMoves.includes(keyEvent.code)) {
      scene.keyUpdate && scene.keyUpdate(keyEvent.code, false);
    }
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
};

const endGame = (loserId) => {
  const winnerId = loserId === 1 ? 2 : 1;
  document.querySelector('canvas').remove();
  document.getElementById('finish-screen').style.display = 'flex';
  document.getElementById('winnerText').innerText = 'winner is player ' + winnerId;
};