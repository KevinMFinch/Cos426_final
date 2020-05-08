import * as Dat from 'dat.gui';
import {
  Scene,
  MeshPhongMaterial,
  BoxGeometry,
  Color,
  PlaneGeometry,
  MeshBasicMaterial,
  GridHelper,
  Mesh,
  Box3,
  DoubleSide
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
      gui: new Dat.GUI(), // Create GUI for scene
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
    this.background = new Color(0x0D0614);

    // Add meshes to scene
    const lights = new BasicLights();
    const redMotor = new Motorcycle(this, 1);
    const yellowMotor = new Motorcycle(this, 2);

    redMotor.position.set(7.5, 0, 5);
    redMotor.scale.set(.1, .1, .1);

    yellowMotor.position.set(-7.5, 0, 5);
    yellowMotor.scale.set(.35, .35, .35);

    this.state.players[0].bike = redMotor;
    this.state.players[1].bike = yellowMotor;

    const floorGeometry = new PlaneGeometry(boardSizeWorld, boardSizeWorld, 1);
    floorGeometry.rotateX(-Math.PI / 2);

    const wallMat = new MeshBasicMaterial({
      color: 0xFF9933,
      side: DoubleSide
    });

    const walls = [];
    let iterations = 1;
    for (let factor = 1; factor >= 0.1; factor -= 0.05) {
      const wallGeometry = new PlaneGeometry(boardSizeWorld * factor, 5, 1);
      const wallPlaneTop = new Mesh(wallGeometry, wallMat);
      const wallPlaneBot = new Mesh(wallGeometry, wallMat);
      const wallPlaneRight = new Mesh(wallGeometry, wallMat);
      const wallPlaneLeft = new Mesh(wallGeometry, wallMat);
      wallPlaneTop.position.set(0, -5 * iterations, boardSizeWorld * factor / 2);
      wallPlaneBot.position.set(0, -5 * iterations, -boardSizeWorld * factor / 2);
      wallPlaneRight.position.set(boardSizeWorld * factor / 2, -5 * iterations, 0);
      wallPlaneRight.rotateY(Math.PI / 2);
      wallPlaneLeft.position.set(-boardSizeWorld * factor / 2, -5 * iterations, 0);
      wallPlaneLeft.rotateY(Math.PI / 2);
      walls.push(wallPlaneTop, wallPlaneLeft, wallPlaneRight, wallPlaneBot);
      iterations++;
    }

    this.add(redMotor, yellowMotor, ...walls, lights);
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
        this.state.endGameFunc(this.state.loserId);
      }
    }
  }

}

export default SeedScene;