import { Vector3 } from 'three';

export const boardSizeWorld = 300;
export const boardSizeGame = 30;
export const turnAngle = 5 * Math.PI / 180;
export const trailMaxLength = 1200;

// Constants defining the directions
export const WEST = 1;
export const NORTH = 2;
export const EAST = 3;
export const SOUTH = 4;

// directions that be input for players to turn
export const LEFT = 5;
export const RIGHT = 6;

// Constants for THREE Vectors
export const Y_HEIGHT = 0; // Constant height and should not change because it is a flat plane
export const DELTA_X = new Vector3(1.0, 0.0, 0.0); // How much moving up or down changes the position of the player 
export const DELTA_Z = new Vector3(0.0, 0.0, 1.0); // Hw much moving left or right changes the position of the player
