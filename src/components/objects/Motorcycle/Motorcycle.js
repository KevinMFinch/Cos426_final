import {
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  Group,
  Vector3,
} from 'three';
import {
  MTLLoader
} from 'three/examples/jsm/loaders/MTLLoader';
import {
  OBJLoader
} from 'three/examples/jsm/loaders/OBJLoader.js';
import MODEL_ONE from './1388 Motorcycle.obj';
import MAT_ONE from './1388 Motorcycle.mtl';
import MODEL_TWO from './Motorcycle_1388.obj';
import MAT_TWO from './Motorcycle_1388.mtl';
import {
  boardSizeWorld,
  LEFT,
  RIGHT,
  turnAngle,
  trailMaxLength,
} from '../../../constants.js';

class Motorcycle extends Group {
  constructor(parent, playerId) {
    // Call parent Group() constructor
    super();

    // Init state
    this.state = {
      gui: parent.state.gui,
      direction: playerId === 1 ? new Vector3(0, 0, -1) : new Vector3(0, 0, 1),
      playerId,
      lost: false,
      trailCount: 0,
    };

    // Load object
    const loader = new OBJLoader();
    const mtlLoader = new MTLLoader();
    this.name = playerId === 1 ? 'redCycle' : 'yellowCycle';
    const model = playerId === 1 ? MODEL_ONE : MODEL_TWO;
    const mat = playerId === 1 ? MAT_ONE : MAT_TWO;

    mtlLoader.setResourcePath('src/components/objects/Motorcycle/');
    mtlLoader.load(mat, (material) => {
      material.preload();
      loader.setMaterials(material).load(model, (obj) => {
        this.add(obj);
      });
    });

    // Add self to parent's update list
    parent.addToUpdateList(this);
  }

  updateDir(dir) {
    // 0 is left, 1 is right
    switch (dir) {
      case LEFT: {
        this.rotateY(turnAngle);
        const axis = new Vector3(0, 1, 0);
        const angle = turnAngle;
        this.state.direction = this.state.direction.applyAxisAngle(axis, angle);
        break;
      }
      case RIGHT: {
        this.rotateY(-turnAngle);
        const axis = new Vector3(0, 1, 0);
        const angle = -turnAngle;
        this.state.direction = this.state.direction.applyAxisAngle(axis, angle);
        break;
      }
    }
  }

  update(timeStamp, scene) {
    const playerId = this.state.playerId;
    const trailArray = playerId === 1 ? scene.state.trailsPlayer1 : scene.state.trailsPlayer2;

    if (!this.state.lost) {
      const x = this.state.direction.clone();
      const old = this.position.clone();
      const move = this.position.clone().add(x.multiplyScalar(1));

      this.position.set(move.x, move.y, move.z);
      if (this.position.x < -boardSizeWorld / 2 || this.position.x > boardSizeWorld / 2 || this.position.z > boardSizeWorld / 2 || this.position.z < -boardSizeWorld / 2) {
        this.state.lost = true;
      }

      const geometry = new BoxGeometry(1, 1, 1);
      let material = undefined;
      if (this.state.playerId === 1) {
        material = new MeshBasicMaterial({
          color: 0x0BF7FE
        });
      } else {
        material = new MeshBasicMaterial({
          color: 0xFE0BAF
        });
      }
      const cube = new Mesh(geometry, material);
      cube.position.set(old.x, 0, old.z);
      cube.name = playerId + '_cube_' + this.state.trailCount;
      this.state.trailCount++;
      trailArray.push(cube);
      scene.add(cube);
      if (trailArray.length > trailMaxLength) {
        const toRemove = scene.getObjectByName(trailArray.shift().name);
        scene.remove(toRemove);
      }
    }
  }
}


export default Motorcycle;