import {
  Scene,
  MeshPhongMaterial,
  BoxGeometry,
  Color,
  PlaneGeometry,
  MeshBasicMaterial,
  GridHelper,
  Mesh,
  Vector2,
  Matrix4,
  Box3,
  VertexColors,
  AmbientLight,
  DoubleSide,
  MeshLambertMaterial,
  CircleBufferGeometry,
  MixOperation,
  Clock,
  Vector3,
} from 'three';
import {
  Motorcycle
} from 'objects';
import {
  BasicLights
} from 'lights';
import {
  boardSizeWorld,
  LEFT,
  RIGHT,
} from '../../constants.js';


// thank you: http://darrendev.blogspot.com/2016/03/gradients-in-threejs.html
function makeGradientCube(c1, c2, w, d, h, opacity){
  if(typeof opacity === 'undefined') opacity = 1.0;
  if(typeof c1 === 'number') c1 = new Color( c1 );
  if(typeof c2 === 'number') c2 = new Color( c2 );
  
  var cubeGeometry = new BoxGeometry(w, h, d);
  
  var cubeMaterial = new MeshPhongMaterial({
      vertexColors: VertexColors
  });
  
  if(opacity < 1.0){
      cubeMaterial.opacity = opacity;
      cubeMaterial.transparent = true;
  }
  const black = 0x000000;

  for(var ix=0; ix<12; ++ix){
      if(ix==4 || ix==5){ //Top edge, all c2
          // cubeGeometry.faces[ix].vertexColors = [c2,c2,c2];
          cubeGeometry.faces[ix].vertexColors = [black,black,black];
          }
      else if(ix==6 || ix==7){ //Bottom edge, all c1
          cubeGeometry.faces[ix].vertexColors = [c1,c1,c1];
          }
      else if(ix%2 ==0){ //First triangle on each side edge
          cubeGeometry.faces[ix].vertexColors = [c2,c1,c2];
          }
      else{ //Second triangle on each side edge
          cubeGeometry.faces[ix].vertexColors = [c1,c1,c2];
          }
  }
  
  return new Mesh(cubeGeometry, cubeMaterial);
}


class SeedScene extends Scene {
  constructor(endGame) {
    // Call parent Scene() constructor
    super();

    const playerOne = {
      id: 1,
      bike: undefined,
      direction: undefined,
      position: undefined,
      space_position: undefined,
      lose: undefined
    };
    const playerTwo = {
      id: 2,
      bike: undefined,
      direction: undefined,
      position: undefined,
      space_position: undefined,
      lose: undefined
    };

    // Init state
    this.state = {
      rotationSpeed: 1,
      updateList: [],
      players: [playerOne, playerTwo],
      trailsPlayer1: [],
      trailsPlayer2: [],
      trailCount1: 0,
      trailCount2: 0,
      keysDown: {
        KeyA: false,
        KeyD: false,
        ArrowLeft: false,
        ArrowRight: false,
      },
      gameOver: false,
      endGameFunc: endGame,
      loserId: -1,
    };

    // Set background to a nice color
    this.background = new Color(0x000000);

    // Add meshes to scene
    const lights = new BasicLights();
    const redMotor = new Motorcycle(this, 1);
    const blueMotor = new Motorcycle(this, 2);

    const SCALE = 0.2;
    redMotor.position.set(130, -2, 110);
    redMotor.scale.set(SCALE, SCALE, SCALE);

    blueMotor.position.set(-130, -2, -110);
    blueMotor.rotateY(Math.PI);
    blueMotor.scale.set(SCALE, SCALE, SCALE);

    this.state.players[0].bike = redMotor;
    this.state.players[1].bike = blueMotor;

    const HEIGHT = 10;
    const shortWallGeometry = new PlaneGeometry(boardSizeWorld, HEIGHT, 1);
    const longWallGeometry = new PlaneGeometry(boardSizeWorld, HEIGHT, 1);

    const shortWallGeometry2 = new PlaneGeometry(boardSizeWorld * 0.85, HEIGHT, 1);
    const longWallGeometry2 = new PlaneGeometry(boardSizeWorld * 0.85, HEIGHT, 1);

    const shortWallGeometry3 = new PlaneGeometry(boardSizeWorld * 0.6, HEIGHT, 1);
    const longWallGeometry3 = new PlaneGeometry(boardSizeWorld * 0.6, HEIGHT, 1);

    const wallMat = new MeshBasicMaterial({
      color: 0xFF9933,
      side: DoubleSide
    });

    const wallPlaneTop = new Mesh(longWallGeometry, wallMat);
    const wallPlaneBot = new Mesh(longWallGeometry, wallMat);
    const wallPlaneRight = new Mesh(shortWallGeometry, wallMat);
    const wallPlaneLeft = new Mesh(shortWallGeometry, wallMat);

    wallPlaneTop.position.set(0, 0, boardSizeWorld / 2);
    wallPlaneBot.position.set(0, 0, -boardSizeWorld / 2);
    wallPlaneRight.position.set(boardSizeWorld / 2, 0, 0);
    wallPlaneRight.rotateY(Math.PI / 2);
    wallPlaneLeft.position.set(-boardSizeWorld / 2, 0, 0);
    wallPlaneLeft.rotateY(Math.PI / 2);
    const wallPlanes = [wallPlaneTop, wallPlaneBot, wallPlaneRight, wallPlaneLeft];

    const gradientBox = makeGradientCube(0x000000, 0x003366, boardSizeWorld, boardSizeWorld, 200, 0.6);
    gradientBox.position.set(0,-100,0);
    this.add(redMotor, blueMotor, ...wallPlanes, lights, gradientBox);

    // // second set of walls
    // const wallPlaneTop2 = new Mesh(longWallGeometry2, wallMat);
    // const wallPlaneBot2 = new Mesh(longWallGeometry2, wallMat);
    // const wallPlaneRight2 = new Mesh(shortWallGeometry2, wallMat);
    // const wallPlaneLeft2 = new Mesh(shortWallGeometry2, wallMat);
    // wallPlaneTop2.position.set(0, -50, boardSizeWorld * 0.85 / 2);
    // wallPlaneBot2.position.set(0, -50, -boardSizeWorld * 0.85 / 2);
    // wallPlaneRight2.position.set(boardSizeWorld * 0.85 / 2, -50, 0);
    // wallPlaneRight2.rotateY(Math.PI / 2);
    // wallPlaneLeft2.position.set(-boardSizeWorld * 0.85 / 2, -50, 0);
    // wallPlaneLeft2.rotateY(Math.PI / 2);
    // const wallPlanes2 = [wallPlaneTop2, wallPlaneBot2, wallPlaneRight2, wallPlaneLeft2];

    // // third set of walls
    // const wallPlaneTop3 = new Mesh(longWallGeometry3, wallMat);
    // const wallPlaneBot3 = new Mesh(longWallGeometry3, wallMat);
    // const wallPlaneRight3 = new Mesh(shortWallGeometry3, wallMat);
    // const wallPlaneLeft3 = new Mesh(shortWallGeometry3, wallMat);
    // wallPlaneTop3.position.set(0, -100, boardSizeWorld * 0.6 / 2);
    // wallPlaneBot3.position.set(0, -100, -boardSizeWorld * 0.6 / 2);
    // wallPlaneRight3.position.set(boardSizeWorld * .6 / 2, -100, 0);
    // wallPlaneRight3.rotateY(Math.PI / 2);
    // wallPlaneLeft3.position.set(-boardSizeWorld * .6 / 2, -100, 0);
    // wallPlaneLeft3.rotateY(Math.PI / 2);
    // const wallPlanes3 = [wallPlaneTop3, wallPlaneBot3, wallPlaneRight3, wallPlaneLeft3];


    // this.add(myGridHelper, redMotor, blueMotor, ...wallPlanes, lights, ...wallPlanes2, ...wallPlanes3);

    // lightsabers!
    // LightSaberDemo.onUpdate;
    // LightSaberDemo.onRender;
    // this.add(LightSaberDemo);

  }

  addToUpdateList(object) {
    this.state.updateList.push(object);
  }

  turnBikes() {
    // Player 1 bike
    if (this.state.keysDown.ArrowLeft) {
      this.state.players[0].bike.updateDir(LEFT);
    }
    if (this.state.keysDown.ArrowRight) {
      this.state.players[0].bike.updateDir(RIGHT);
    }
    if (this.state.keysDown.KeyA) { // Player 2 bike
      this.state.players[1].bike.updateDir(LEFT);
    }
    if (this.state.keysDown.KeyD) {
      this.state.players[1].bike.updateDir(RIGHT);
    }
  }

  keyUpdate(keyCode, down) {
    this.state.keysDown[keyCode] = down;
  }

  update(timeStamp) {
    if (!this.state.gameOver) {
      const {
        updateList
      } = this.state;

      this.turnBikes();

      // Call update for each object in the updateList
      for (const obj of updateList) {
        obj.update(timeStamp, this);
      }

      if (this.state.gameOver) {
        var endPause = new Clock();
        endPause.start();
        while (endPause.getElapsedTime() < 1) {
          continue;
        }
        this.state.endGameFunc(this.state.loserId);
      }
    }
  }

}

export default SeedScene;