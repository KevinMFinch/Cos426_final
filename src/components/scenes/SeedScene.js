import * as Dat from 'dat.gui';
import {
  Scene,
  Color,
  PlaneGeometry,
  MeshBasicMaterial,
  GridHelper,
  Mesh,
  DoubleSide
} from 'three';
import {
  Motorcycle
} from 'objects';
import {
  BasicLights
} from 'lights';
import {
  boardSizeWorld
} from '../../constants.js';

class SeedScene extends Scene {
  constructor() {
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
    };

    // Set background to a nice color
    this.background = new Color(0x0D0614);

    // Add meshes to scene
    const lights = new BasicLights();
    const redMotor = new Motorcycle(this, 1);
    const yellowMotor = new Motorcycle(this, 2);

    redMotor.position.set(2, 0, 5);
    redMotor.scale.set(.02, .02, .02);

    yellowMotor.position.set(-5, 0, 5);
    yellowMotor.scale.set(.07, .07, .07);

    this.state.players[0].bike = redMotor;
    this.state.players[1].bike = yellowMotor;

    const floorGeometry = new PlaneGeometry(boardSizeWorld, boardSizeWorld, 1);
    floorGeometry.rotateX(-Math.PI / 2);

    const shortWallGeometry = new PlaneGeometry(boardSizeWorld, 5, 1);
    const longWallGeometry = new PlaneGeometry(boardSizeWorld, 5, 1);

    // Grid flooring
    const myGridHelper = new GridHelper(boardSizeWorld, 120, 0xFF9933, 0xFF9933);

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
    this.add(myGridHelper, redMotor, yellowMotor, ...wallPlanes, lights);
  }

  addToUpdateList(object) {
    this.state.updateList.push(object);
  }

  turnBike(keyCode) {
    // Player 1 bike
    if (keyCode === 'ArrowLeft') {
      this.state.players[0].bike.updateDir(0);
    } else if (keyCode === 'ArrowRight') {
      this.state.players[0].bike.updateDir(1);
    } else if (keyCode === 'KeyA') { // Player 2 bike
      this.state.players[1].bike.updateDir(0);
    } else {
      this.state.players[1].bike.updateDir(1);
    }
  }

  update(timeStamp) {
    const {
      updateList
    } = this.state;

    // Call update for each object in the updateList
    for (const obj of updateList) {
      obj.update(timeStamp);
    }
  }
}

export default SeedScene;