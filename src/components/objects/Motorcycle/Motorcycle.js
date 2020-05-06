import {
  Group
} from 'three';
import {
  MTLLoader
} from 'three/examples/jsm/loaders/MTLLoader';
import {
  OBJLoader
} from 'three/examples/jsm/loaders/OBJLoader.js';
import {
  TWEEN
} from 'three/examples/jsm/libs/tween.module.min.js';
import MODEL_ONE from './1388 Motorcycle.obj';
import MAT_ONE from './1388 Motorcycle.mtl';
import MODEL_TWO from './Motorcycle_1388.obj';
import MAT_TWO from './Motorcycle_1388.mtl';

class Motorcycle extends Group {
  constructor(parent, playerId) {
    // Call parent Group() constructor
    super();

    // Init state
    this.state = {
      gui: parent.state.gui,
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
  updatePosition() {
    const currPosition = this.position;
    this.position.set(currPosition.x - 1, currPosition.y, currPosition.z);
  }

  update(timeStamp) {
    switch (timeStamp.key) {
      case "ArrowLeft":
        this.rotateY(Math.PI / 2);
        break;
      case "ArrowRight":
        this.rotateY(-Math.PI / 2);
    }
  }
}

export default Motorcycle;