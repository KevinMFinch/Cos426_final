import { Vector3 } from "three";

// Constants defining the directions
const LEFT = 1;
const UP = 2;
const RIGHT = 3;
const DOWN = 4;

// Constants for THREE Vectors
const Z_HEIGHT = 30; // Constant height and should not change because it is a flat plane
const DELTA_X = new THREE.Vector3(30.0, 0.0, 0.0); // How much moving up or down changes the position of the player 
const DELTA_Y = new THREE.Vector3(0.0, 30.0, 0.0); // Hw much moving left or right changes the position of the player

// Creates a game board 
function gameBoard() {
	this.width = 50;
	this.length = 50;
	this.board = new Array(width);

	// Initializing a 2D representation of the board
	for (let i = 0; i < this.width; i++) {
		this.board[i] = new Array(this.length);
		for (let j = 0; j < this.length; j++) {
			this.board[i][j] = 0;
		}
	}

	// These constants determine which players are wh
	this.PLAYER_ONE.id = 1;
	this.PLAYER_TWO.id = 2;

	// These numbers indicate the direction a player is facing
	// 1 should be to the left wall
	// 2 should be toward the top wall
	// 3 should be the right wall
	// 4 should be the bottom/back wall
	this.PLAYER_ONE.direction = UP;
	this.PLAYER_TWO.direction = DOWN;

	// These starting positions are subject to change. Maybe even randomized
	// The 0th position is the X poition and the 1st position is the y position
	this.PLAYER_ONE.position = [Math.round(this.width / 2), Math.round(this.length / 4)]
	this.PLAYER_TWO.position = [Math.round(this.width / 2), Math.round(3 * this.length / 4)]

	this.PLAYER_ONE.space_position = new THREE Vector3(0.0, 0.0, Z_HEIGHT);
	this.PLAYER_TWO.space_position = new THREE Vector3(0.0, 0.0, Z_HEIGHT);
};


gameBoard.movePlayer = function(player_id, direction) {
	// Check if player is valid
	if (player_id != this.PLAYER_ONE && player_id != this.PLAYER_ONE) {
		console.log("The player", player_id, "is not a valid player!");
	}
	// Check if direction is valid
	if (direction != LEFT && direction != RIGHT && direction != UP && direction != DOWN) {
		console.log("The direction", direction, "is not a valid direction!");
	}

	// Get the corresponding player
	let player;
	let opposite_player;
	if (player_id == this.PLAYER_ONE.id) {
		player = this.PLAYER_ONE;
		opposite_player = this.PLAYER_TWO;
	}
	else {
		player = this.PLAYER_TWO;
		opposite_player = this.PLAYER_ONE;
	}

	if (direction == UP ) {
		// If facing the top wall and are about to collide, turn right
		if (player.position[0] == 0) {
			player.direction = RIGHT;
		}
		// Otherwise move towards the wall
		else {
			player.position[0] -= 1;
			player.direction = direction;
		}
	}
	else if (direction == DOWN) {
		// If facing the bottom wall and are about to collide, turn left
		if (player.position[0] == this.width - 1) {
			player.direction = LEFT;
		}
		// Otherwise move towards the wall
		else {
			player.position[0] += 1;
			player.direction = direction;
		}
	}
	else if (direction == LEFT) {
		// If facing the left wall and are about to collide, turn up
		if (player.position[1] == 0) {
			player.direction = UP;
		}
		// Otherwise move towards the wall
		else {
			player.position[1] -= 1;
			player.direction = direction;
		}
	}
	// else the direction must be RIGHT
	else {
		// If facing the right wall and are about to collide, turn down
		if (player.position[1] == this.length - 1) {
			player.direction = DOWN;
		}
		// Otherwise move towards the wall
		else {
			player.position[1] += 1;
			player.direction = direction;
		}

	}

	// if the current position has been covered by the opponent, trigger the end game
	if (this.board[player.position[0]][player.position[1]] == opposite_player.id) {
		this.gameEnd(opposite_player, player);
	}
	// update the board to have the correct player id in that location
	else {
	this.board[player.position[0]][player.position[1]] = this.player.id;
	}


};


gameBoard.gameEnd = function(winner, loser) {
	console.log("The winner is", winner,"and the loser is", loser);
};