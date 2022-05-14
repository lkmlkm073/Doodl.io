// Parses the cookie to determine what room the user joined
function getCookie(cookies, name) {
	let roomCode;
	cookies.split('; ').some((cookie) => {
		const splitCookie = cookie.split('=');
		const [cookieName, val] = splitCookie;
		if (cookieName === name) {
			roomCode = val;
			return true;
		}
		return false;
	});
	return roomCode;
}

function logActivity(rooms, code) {
	const {
		[code]: {
			playerCount = 0,
		} = {},
	} = rooms;
	console.log('--------------------------------------------');
	console.log(`Changes happened to room id: ${code} count: ${playerCount}`);
	console.log(`Rooms: ${Object.keys(rooms).length}`);
	console.log('--------------------------------------------');
}

function changeDrawingPlayer(rooms, code, io) {
	const {
		[code]: {
			playerCount,
			currentlyDrawingIndex,
		} = {},
	} = rooms;

	const room = rooms[code];

	room.currentlyDrawingIndex += 1;
	if (currentlyDrawingIndex >= playerCount - 1) {
		room.currentlyDrawingIndex = 0;
	}

	if (room.currentlyDrawing.id !== '') {
		io.to(room.currentlyDrawing.id).emit('save', room.currentWordToDraw);
	}

	room.currentDrawingState = {};
	room.currentlyDrawing = room.players[room.currentlyDrawingIndex];
	room.drawnThisRound[room.currentlyDrawingIndex] = true;
	io.to(code).emit('gamestate', { currentDrawingPlayer: room.currentlyDrawing });
}

function generateRandomWords(wordBank) {
	// randomly generate 3 words
	const words = [];
	if (wordBank.length === 0) {
		words[0] = 'none';
		words[1] = 'none';
		words[2] = 'none';
	} else {
		while (words.length < 3) {
			const r = Math.floor(Math.random() * wordBank.length);
			if (words.indexOf(wordBank[r]) === -1) words.push(wordBank[r]);
		}
	}
	return words;
}

function initiateTurn(rooms, code, io, wordBank) {
	changeDrawingPlayer(rooms, code, io);
	// Wait for drawer to pick one of three words
	io.to(rooms[code].currentlyDrawing.id).emit('wordModal', generateRandomWords(wordBank));
	io.to(code).emit('chatMessage', { msg: `Starting a new turn! Next player to draw is ${rooms[code].currentlyDrawing.username}!`, color: 'blue' });
}

function endTurn(timeBetweenTurns, rooms, code, io, wordBank) {
	const room = rooms[code];
	room.turnStarted = false;
	io.to(code).emit('stopDrawing');
	io.to(code).emit('wordPrompt', `The word was: ${rooms[code].currentWordToDraw}`);
	io.to(code).emit('chatMessage', { msg: `Turn over! The word was '${rooms[code].currentWordToDraw}'!`, color: 'blue' });
	io.to(code).emit('turntimer', 5);
	// if everyone has drawn this round
	if (rooms[code].drawnThisRound.indexOf(false) === -1) {
		// if on last round
		if (rooms[code].currentRound === parseInt(rooms[code].roundNumber, 10)) {
			// eslint-disable-next-line prefer-spread
			const highestScore = Math.max.apply(Math, rooms[code].playerScores);
			const highestScoreIndex = rooms[code].playerScores.indexOf(highestScore);
			const winningPlayer = rooms[code].players[highestScoreIndex].username;
			setTimeout(() => {
				io.to(code).emit('gameEnd', { player: winningPlayer, score: highestScore });
			}, timeBetweenTurns);
			return;
		}

		room.currentRound += 1;
		for (let i = 0; i < rooms[code].playerCount; i += 1) {
			room.drawnThisRound[i] = false;
		}
	}

	setTimeout(() => {
		io.to(code).emit('updateRound', rooms[code].currentRound);
		initiateTurn(rooms, code, io, wordBank);
	}, timeBetweenTurns);
}

function startTurn(time, rooms, code, io, wordBank) {
	const room = rooms[code];
	room.numGuessedRight = 0;
	room.turnStarted = true;
	room.guessedCorrectly = [];
	for (let i = 0; i < rooms[code].playerCount; i += 1) {
		if (rooms[code].players[i] === rooms[code].currentlyDrawing) {
			io.to(rooms[code].players[i].id).emit('wordPrompt', `You are drawing: ${rooms[code].currentWordToDraw}`);
		} else {
			io.to(rooms[code].players[i].id).emit('wordPrompt', `Guess what's being drawn: ${rooms[code].currentWordToDraw.replace(/[a-z]/gi, '\xa0_').replace(/ /g, '\xa0\xa0').replace(/-/g, '\xa0-')}`);
		}
	}
	io.to(code).emit('turntimer', time / 1000);
	// Reset the colors of player guesses
	io.to(code).emit('updatePlayer', {
		playerList: rooms[code].players,
		guessedPlayerList: room.guessedCorrectly,
		currentDrawer: rooms[code].currentlyDrawing.id,
		playerScores: rooms[code].playerScores,
	});

	// Waits for turn to end before initializing the next turn
	return setTimeout(() => {
		endTurn(5000, rooms, code, io, wordBank);
	}, time);
}

function startGame(rooms, code, io, wordBank) {
	const room = rooms[code];
	// Execute player change immediately
	for (let i = 0; i < rooms[code].playerCount; i += 1) {
		room.drawnThisRound[i] = false;
		room.playerScores[i] = 0;
	}
	io.to(code).emit('updateRound', 1);
	initiateTurn(rooms, code, io, wordBank);
}

function createRoom() {
	const room = {
		started: false,
		players: [],
		playerCount: 0,
		roomGameDifficulty: 'Easy',
		// Contains the player object which is currently drawing
		currentlyDrawing: {},
		currentlyDrawingIndex: -1,
		currentWordToDraw: '',
		numGuessedRight: 0,
		turnStarted: false,
		guessedCorrectly: [],
		playerScores: [],
		drawnThisRound: [],
		// stores the draw history for the current round
		currentDrawingState: {},
		turnTimer: 60,
		roundNumber: 0,
		currentRound: 1,
	};
	return room;
}

function addPlayerToRoom(id, user, rooms, code) {
	if (typeof rooms[code] === 'undefined') {
		// Can't find room (most likely due to server restart)
		// eslint-disable-next-line no-param-reassign
		rooms[code] = createRoom(rooms, code);
	}

	const room = rooms[code];

	room.playerCount += 1;
	room.players.push({ id, username: user });
	room.playerScores.push(0);
	room.drawnThisRound.push(false);
	logActivity(rooms, code);
}

function removePlayerFromRoom(id, rooms, code, intervalHandles, io) {
	const room = rooms[code];
	// Delete room if no players are left
	if (rooms[code].playerCount <= 1) {
		// eslint-disable-next-line no-param-reassign
		delete rooms[code];
		// delete timer handler and removing from tracking array
		clearInterval(intervalHandles[code]);
		// eslint-disable-next-line no-param-reassign
		delete intervalHandles[code];
	} else {
		room.playerCount -= 1;
		const index = rooms[code].players.map((player) => player.id).indexOf(id);
		rooms[code].players.splice(index, 1);
		rooms[code].playerScores.splice(index, 1);
		rooms[code].drawnThisRound.splice(index, 1);
		io.to(code).emit('updatePlayer', {
			playerList: rooms[code].players,
			guessedPlayerList: room.guessedCorrectly,
			currentDrawer: rooms[code].currentlyDrawing.id,
			playerScores: rooms[code].playerScores,
			roomGameDifficulty: rooms[code].roomGameDifficulty,
		});
	}
	logActivity(rooms, code);
}

function storeData(data, rooms, code) {
	// Creates a data structure in the form of
	// rooms[code] = {
	// 		currentDrawingState: {
	//			penColor: {
	// 				penCap: {
	//					penThickness: [
	// 						{ prev: {X, Y}, curr: {X, Y}}
	// 					]
	//				},
	// 			},
	// 		},
	// }
	const {
		penColor,
		penCap,
		penThickness,
		prevX,
		prevY,
		currX,
		currY,
	} = data;

	// Initialize the array if it doesn't exist
	if (!Object.prototype.hasOwnProperty.call(rooms[code].currentDrawingState, penColor)) {
		// eslint-disable-next-line no-param-reassign
		rooms[code].currentDrawingState[penColor] = {
			[penCap]: {
				[penThickness]: [],
			},
		};
	} else if (!Object.prototype.hasOwnProperty.call(
		rooms[code].currentDrawingState[penColor], penCap,
	)) {
		// eslint-disable-next-line no-param-reassign
		rooms[code].currentDrawingState[penColor][penCap] = {
			[penThickness]: [],
		};
	} else if (!Object.prototype.hasOwnProperty.call(
		rooms[code].currentDrawingState[penColor][penCap], penThickness,
	)) {
		// eslint-disable-next-line no-param-reassign
		rooms[code].currentDrawingState[penColor][penCap][penThickness] = [];
	}

	rooms[code].currentDrawingState[penColor][penCap][penThickness]
		.push({
			prevX, prevY, currX, currY,
		});
}

module.exports = {
	getCookie,
	endTurn,
	startTurn,
	startGame,
	createRoom,
	addPlayerToRoom,
	removePlayerFromRoom,
	logActivity,
	storeData,
};
