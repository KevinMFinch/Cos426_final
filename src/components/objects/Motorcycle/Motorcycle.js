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
// import {
//     boardSizeWorld
// } from '../../constants.js';

class Motorcycle extends Group {
  constructor(parent, playerId) {
    // Call parent Group() constructor
    super();

    // Init state
    this.state = {
      gui: parent.state.gui,
      direction: playerId === 1 ? new Vector3(0, 0, -1) : new Vector3(0, 0, 1),
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
      case 0: {
        this.rotateY(Math.PI / 2);
        const axis = new Vector3(0, 1, 0);
        const angle = Math.PI / 2;
        this.state.direction = this.state.direction.applyAxisAngle(axis, angle);
        break;
      }
      case 1: {
        this.rotateY(-Math.PI / 2);
        const axis = new Vector3(0, 1, 0);
        const angle = -Math.PI / 2;
        this.state.direction = this.state.direction.applyAxisAngle(axis, angle);
        break;
      }
    }
  }

  update(timeStamp) {
    const x = this.state.direction.clone();
    const old = this.position.clone();
    const move = this.position.clone().add(x.multiplyScalar(0.01));
  
    this.position.set(move.x, move.y, move.z);

    var boxSize = 300 / 120;
    var geometry = new BoxGeometry( boxSize, boxSize, boxSize );
    var material = new MeshBasicMaterial( {color: 0x00ff00} );
    var cube = new Mesh( geometry, material );
    
    cube.position.set(old.x, old.y, old.z);
    this.add( cube );
  }
}


export default Motorcycle;
