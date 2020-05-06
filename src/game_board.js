import { Vector3 } from "three";

// Creates a game board 
function gameBoard(playerOne, playerTwo) {
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
	// initialize the two players
	this.PLAYER_ONE = playerOne;
	this.PLAYER_TWO = playerTwo;

	// These constants determine which players are wh
	// this.PLAYER_ONE.id = 1;
	// this.PLAYER_TWO.id = 2;

	// These numbers indicate the direction a player is facing
	// 1 should be to the left wall
	// 2 should be toward the top wall
	// 3 should be the right wall
	// 4 should be the bottom/back wall
	this.PLAYER_ONE.direction = NORTH;
	this.PLAYER_TWO.direction = SOUTH;

	// These starting positions are subject to change. Maybe even randomized
	// The 0th position is the X poition and the 1st position is the y position
	this.PLAYER_ONE.position = [Math.round(this.width / 2), Math.round(this.length / 4)]
	this.PLAYER_TWO.position = [Math.round(this.width / 2), Math.round(3 * this.length / 4)]

	// Both objects always have the same Z coordinate
	this.PLAYER_ONE.space_position = new THREE Vector(0.0, Y_HEIGHT, 0.0);
	this.PLAYER_TWO.space_position = new THREE Vector(0.0, Y_HEIGHT, 0.0);

	this.PLAYER_ONE.space_position = updatedPlayerPosition(this.PLAYER_ONE);
	this.PLAYER_TWO.space_position = updatedPlayerPosition(this.PLAYER_TWO);

	// True if player has lost and false otherwise
	this.PLAYER_ONE.lose = false;
	this.PLAYER_TWO.lose = false;
};

updatedPlayerPosition = function(player) {
	let pos = player.space_position.clone().addScaledVector(DELTA_X, player.position[0]);
	return pos.clone().addScaledVector(DELTA_Z, player.position[1]);
}

// returns the position to which a player should move in 3d space
// it automatically changes the position on the board but does not
// change the position in 3d space
gameBoard.movePlayer = function(player_id, direction) {
	// Check if player is valid
	if (player_id != this.PLAYER_ONE.id && player_id != this.PLAYER_TWO.id) {
		console.log("The player", player_id, "is not a valid player!");
	}
	// Check if direction is valid
	if (direction != NORTH && direction != SOUTH && direction != WEST && direction != EAST) {
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

	let updated_pos = undefined;
	// check if you hit a wall
	// if he does then he loses
	if (direction == NORTH && player.position[0] == 0) {
		player.lose = true;
		return updated_pos;
	}
	else if (direction == SOUTH && player.position[0] == this.width - 1) {
		player.lose = true;
		return updated_pos;
	}
	else if (direction == EAST && player.position[1] == 0) {
		player.lose = true;
		return updated_pos;
	}
	else if (direction == WEST && player.position[1] == this.length - 1) {
		player.lose = true;
		return updated_pos;
	}

	player.direction = direction;
	// otherwise turn the player
	if (direction == NORTH) {
		player.position[0] -= 1;
	}
	else if (direction == SOUTH) {
		player.position[0] += 1;
	} 
	else if (direction == EAST) {
		player.position[1] -= 1;
	}
	else if (direction == WEST) {
		player.position[1] += 1;
	}
	// if the current position has been covered by the opponent, trigger the end game
	let square_id = this.board[player.position[0]][player.position[1]]
	if (square_id == opposite_player.id || square_id == player.id) {
		player.lose = true;
	}
	else {
		this.board[player.position[0]][player.position[1]] = this.player.id;
	}

	let updated_pos = updatedPlayerPosition(player);
	return updated_pos;
};

// Temporary does nothing other than logs. Other than that
// If game is over return true. otherwise return false
gameBoard.checkWinner = function() {

	// This is a tie
	if (this.PLAYER_ONE.lose && this.PLAYER_TWO.lose) {
		console.log("It's a tie!");
		return true;
	}
	// player 2 wins
	else if (this.PLAYER_ONE.lose) {
		console.log("Player 2 wins!");
		return true;
	}
	// player 1 wins 
	else if (this.PLAYER_TWO.lose) {
		console.log("Player 1 wins!");
		return true;
	}
	// No one has won yet
	else {
		return false;
	}
};