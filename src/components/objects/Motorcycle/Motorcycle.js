import {
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshPhongMaterial,
  Group,
  Box3,
  Vector3,
  Clock,
  CylinderGeometry
} from 'three';
import {
  MTLLoader
} from 'three/examples/jsm/loaders/MTLLoader';
import {
  OBJLoader
} from 'three/examples/jsm/loaders/OBJLoader.js';
import MODEL from './1388_Motorcycle.obj';
import MAT_ONE from './1388_Motorcycle.mtl';
import MAT_TWO from './1388_Motorcycle_Blue.mtl';

import {
  boardSizeWorld,
  LEFT,
  RIGHT,
  SPEED,
  OFFSET,
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
    this.name = playerId === 1 ? 'redCycle' : 'blueCycle';
    const mat = playerId === 1 ? MAT_ONE : MAT_TWO;

    const objLoader = new OBJLoader();
    const mtlLoader = new MTLLoader();
    objLoader.setMaterials(mtlLoader.parse(mat)).load(MODEL, (obj) => {
      this.add(obj);
    });


    // Add self to parent's update list
    parent.addToUpdateList(this);
  }

  // check if player's bounding box has collided with trail meshes, given in array
  hasCollided(trails, bbox) {
    if (trails.length < OFFSET || bbox.min.x === Infinity) return false;

    for (let i = 0; i < trails.length - OFFSET; i++) {
      let trailMeshBBox = new Box3().setFromObject(trails[i]);

      if (bbox.intersectsBox(trailMeshBBox)) {
        return true;
      }
    }
    return false;
  }

  // update direction of player based on key
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
    const opposingTrailArray = playerId === 1 ? scene.state.trailsPlayer2 : scene.state.trailsPlayer1;

    if (!scene.state.gameOver) {
      const x = this.state.direction.clone();
      const old = this.position.clone();

      const move = old.clone().add(x.clone().multiplyScalar(SPEED));

      this.position.set(move.x, move.y, move.z);
      var bbox = new Box3().setFromObject(this);

      if (this.position.x < -boardSizeWorld / 2 || this.position.x > boardSizeWorld / 2 || this.position.z > boardSizeWorld / 2 || this.position.z < -boardSizeWorld / 2) {
        this.state.lost = true;
      }

      const geometry = new CylinderGeometry(2.7, 2.7, 7, 20);
      geometry.rotateX(Math.PI / 2)
      let material = undefined;
      if (this.state.playerId === 1) {
        material = new MeshPhongMaterial({
          color: 0x0BF7FE,
          emissive: 0x0BF7FE,
          emissiveIntensity: 7
        });
      } else {
        material = new MeshPhongMaterial({
          color: 0xFE0BAF,
          emissive: 0xFE0BAF,
          emissiveIntensity: 7
        });
      }
      
      

      // collisions check for self
      if (this.hasCollided(trailArray, bbox)) {
        this.state.lost = true;

      }

      // collisions check for opposing player
      if (this.hasCollided(opposingTrailArray, bbox)) {
        this.state.lost = true;
      }

      if (this.state.lost) {
        scene.state.gameOver = true;
        scene.state.loserId = this.state.playerId;
      }

      const trailComponent = new Mesh(geometry, material);
      const trailPos = old.clone().add(x.multiplyScalar(-14));
      trailComponent.position.set(trailPos.x, 5, trailPos.z);
      trailComponent.name = playerId + '_cube_' + this.state.trailCount;
      this.state.trailCount++;
      trailArray.push(trailComponent);
      scene.add(trailComponent);
      if (trailArray.length > trailMaxLength) {
        const toRemove = scene.getObjectByName(trailArray.shift().name);
        scene.remove(toRemove);
      }
    }
  }
}


export default Motorcycle;