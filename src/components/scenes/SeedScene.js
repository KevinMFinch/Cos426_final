import * as Dat from 'dat.gui';
import { Scene, Color, PlaneGeometry, MeshBasicMaterial, Mesh, DoubleSide, Plane } from 'three';
import { Flower, Land, Motorcycle } from 'objects';
import { BasicLights } from 'lights';

class SeedScene extends Scene {
    constructor() {
        // Call parent Scene() constructor
        super();

        // Init state
        this.state = {
            gui: new Dat.GUI(), // Create GUI for scene
            rotationSpeed: 1,
            updateList: [],
        };

        // Set background to a nice color
        this.background = new Color(0x7ec0ee);

        // Add meshes to scene
        const land = new Land();
        const flower = new Flower(this);
        const lights = new BasicLights();
        const redMotor = new Motorcycle(this);
        redMotor.position.set(2, 1, 5);
        redMotor.scale.set(.02, .02, .02);

        flower.position.set(2, 0, 2);

        const floorGeometry = new PlaneGeometry(200, 100, 1);
        floorGeometry.rotateX(-Math.PI / 2);

        const shortWallGeometry = new PlaneGeometry(100, 5, 1);
        const longWallGeometry = new PlaneGeometry(200, 5, 1);

        const floorMat = new MeshBasicMaterial({color: 0x33DDFF, side: DoubleSide});
        const wallMat = new MeshBasicMaterial({color: 0xffddcc, side: DoubleSide});

        const floorPlane = new Mesh(floorGeometry, floorMat);

        const wallPlaneTop = new Mesh(longWallGeometry, wallMat);
        const wallPlaneBot = new Mesh(longWallGeometry, wallMat);
        const wallPlaneRight = new Mesh(shortWallGeometry, wallMat);
        const wallPlaneLeft = new Mesh(shortWallGeometry, wallMat);

        wallPlaneTop.position.set(0, 0, 50);
        wallPlaneBot.position.set(0, 0, -50);
        wallPlaneRight.position.set(100, 0, 0);
        wallPlaneRight.rotateY(Math.PI / 2);
        wallPlaneLeft.position.set(-100, 0, 0);
        wallPlaneLeft.rotateY(Math.PI / 2);

        const wallPlanes = [wallPlaneTop, wallPlaneBot, wallPlaneRight, wallPlaneLeft];
        this.add(floorPlane, redMotor, ...wallPlanes, lights);

        // Populate GUI
        this.state.gui.add(this.state, 'rotationSpeed', -5, 5);
    }

    addToUpdateList(object) {
        this.state.updateList.push(object);
    }

    update(timeStamp) {
        const { rotationSpeed, updateList } = this.state;

        // moving screen
        // this.rotation.y = (rotationSpeed * timeStamp) / 10000; 

        // Call update for each object in the updateList
        for (const obj of updateList) {
            obj.update(timeStamp);
        }
    }
}

export default SeedScene;
