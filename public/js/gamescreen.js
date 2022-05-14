const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const penCap = 'round';
let penThickness = 5;
let penColor = 'black';
const brushColors = document.querySelectorAll('.brush-colors');
const brushSizes = document.querySelectorAll('.brush-sizes-imgs');
const clear = document.getElementById('clear-canvas');
const eraser = document.getElementById('eraser');
const fill = document.getElementById('fill');
const brushIndicator = document.getElementById('brush-indicator');
const brush = document.getElementById('brush');
const saveBtn = document.getElementById('saveBtn');		// for gallery
let saveTimer;
let title;

const chatAutoScroll = document.querySelector('.chat-messages');
const gameOptionsForm = document.getElementById('gameOptionsForm');
const roundTime = document.getElementById('roundTime');
const roundNumber = document.getElementById('numberOfRounds');
const gameDifficulty = document.getElementById('gameDifficulty');
canvas.width = 540;
canvas.height = 540;

const inkBar = document.getElementById('ink-bar');
let totalInk = 3000;
let currentInk = 0;

let timeInterval; // id for turn timer
let pickTimer; // id for timer for picking a word

let drawingBool = false;
let drawingDotBool = false;
let prevX = 0;
let prevY = 0;
let currX = 0;
let currY = 0;

let canDraw = false;
let hasInk = true;
let eraserBool = false;

const pencilImg = document.createElement('img');
pencilImg.src = 'img/pencil.png';
pencilImg.width = 20;
pencilImg.height = 20;

// eslint-disable-next-line no-undef
const socket = io();

$('#startGame').click((e) => {
	const roundTimeVal = roundTime.value;
	const roundNumberVal = roundNumber.value;
	const gameDifficultyVal = gameDifficulty.value;

	if (gameOptionsForm.checkValidity() === true) {
		socket.emit('startGame', { roundTime: roundTimeVal, roundNumber: roundNumberVal, gameDifficulty: gameDifficultyVal });
		e.preventDefault();
		e.stopPropagation();
		$('#gameOptionsModal').modal('hide');
		// Disable game options button once game starts successfully
		$('#gameOptions').prop('disabled', true);
	}
});

$('#gameOptions').click(() => {
	$('#gameOptionsModal').modal('toggle');
});

// Drawing functions
function drawTemp(color, cap, thickness, data) {
	ctx.strokeStyle = color;
	ctx.lineWidth = thickness;
	ctx.lineCap = cap;
	ctx.moveTo(data.prevX, data.prevY);
	ctx.lineTo(data.currX, data.currY);
	ctx.stroke();
}

function changeBrushColor(color) {
	if (canDraw) {
		if (color === '#d8dee9') {
			eraserBool = true;
		} else {
			eraserBool = false;
		}

		penColor = color;

		if (!eraserBool) {
			brushIndicator.style.backgroundColor = color;
		}
	}
}

function changeBrushSize(thickness) {
	if (canDraw) {
		if (thickness === 'smallest') {
			penThickness = 5;
		} if (thickness === 'small') {
			penThickness = 15;
		} if (thickness === 'large') {
			penThickness = 25;
		} if (thickness === 'largest') {
			penThickness = 35;
		}
	}
}

function updateInkProgress() {
	let percentage = 100 - Math.round((currentInk / totalInk) * 100);

	if (percentage <= 0) {
		percentage = 0;
		hasInk = false;
		drawingBool = false;
	}
	socket.emit('updateInk', percentage);
}

function GetPos(type, event) {
	if (canDraw && hasInk) {
		if (type === 'down') {
			prevX = currX;
			prevY = currY;
			currX = event.pageX - canvas.offsetLeft;
			currY = event.pageY - canvas.offsetTop;

			drawingBool = true;
			drawingDotBool = true;

			if (drawingDotBool) {
				drawingDotBool = false;

				const data = {
					penColor,
					penThickness,
					penCap,
					prevX: currX,
					prevY: currY,
					currX,
					currY,
				};

				socket.emit('draw', data);

				if (eraserBool === false) {
					currentInk += (totalInk / 100);
					updateInkProgress();
				}
			}
		}
		if (type === 'up' || type === 'out') {
			drawingBool = false;
		}
		if (type === 'move') {
			if (drawingBool) {
				prevX = currX;
				prevY = currY;
				currX = event.pageX - canvas.offsetLeft;
				currY = event.pageY - canvas.offsetTop;

				if (eraserBool === false) {
					currentInk = currentInk + Math.abs(currX - prevX) + Math.abs(currY - prevY);
					updateInkProgress();
				}
				const data = {
					penColor,
					penThickness,
					penCap,
					prevX,
					prevY,
					currX,
					currY,
				};
				socket.emit('draw', data);
			}
		}
	}
}

function clearBoard() {
	if (canDraw) {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		socket.emit('clear');
	}
}

function fillBoard() {
	if (canDraw) {
		ctx.fillStyle = brushIndicator.style.backgroundColor;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		socket.emit('fill', brushIndicator.style.backgroundColor);
	}
}

canvas.addEventListener('mousemove', (event) => {
	GetPos('move', event);
});
canvas.addEventListener('mousedown', (event) => {
	GetPos('down', event);
});
canvas.addEventListener('mouseup', (event) => {
	GetPos('up', event);
});
canvas.addEventListener('mouseout', (event) => {
	GetPos('out', event);
});
brushColors.forEach((el) => el.addEventListener('click', (event) => {
	changeBrushColor(event.target.id);
}));
brushSizes.forEach((el) => el.addEventListener('click', (event) => {
	changeBrushSize(event.target.id);
}));
clear.addEventListener('click', () => {
	clearBoard();
});
eraser.addEventListener('click', () => {
	changeBrushColor('#d8dee9');
});
fill.addEventListener('click', () => {
	fillBoard();
});
brush.addEventListener('click', () => {
	changeBrushColor(brushIndicator.style.backgroundColor);
});

// for gallery
socket.on('save', (word) => {
	title = word;
	if ($('#saveToGallery').length) {
		let timeLeft = 10;
		document.getElementById('saveImgTimer').innerHTML = timeLeft;
		$('#saveToGallery').modal({ backdrop: 'static', keyboard: false });
		saveTimer = window.setInterval(() => {
			timeLeft -= 1;
			document.getElementById('saveImgTimer').innerHTML = timeLeft;
			if (timeLeft <= 0) {
				window.clearInterval(saveTimer);
				$('#saveToGallery').modal('hide');
			}
		}, 1000);
	}
});

if (saveBtn !== null) {
	saveBtn.addEventListener('click', () => {
		$('#saveToGallery').modal('hide');
		const image = canvas.toDataURL('image/png');
		$.ajax({
			type: 'POST',
			url: '/save',
			data: JSON.stringify({ url: image, title }),
			contentType: 'application/json',
			processData: false,
		});
	});

	document.getElementById('closeBtn').addEventListener('click', () => {
		$('#saveToGallery').modal('hide');
	});
}

socket.on('draw', (data) => {
	ctx.strokeStyle = data.penColor;
	ctx.lineWidth = data.penThickness;
	ctx.lineCap = data.penCap;
	ctx.moveTo(data.prevX, data.prevY);
	ctx.lineTo(data.currX, data.currY);
	ctx.stroke();
	ctx.beginPath();
});

socket.on('beginNewPath', () => {
	ctx.beginPath();
});

socket.on('drawArr', (dataObj) => {
	Object.keys(dataObj).forEach((Colorkey) => {
		// Set background color
		if (Colorkey === 'fill') {
			ctx.fillStyle = dataObj[Colorkey];
			ctx.fillRect(0, 0, canvas.width, canvas.height);
		} else {
			Object.keys(dataObj[Colorkey]).forEach((Pencapkey) => {
				Object.keys(dataObj[Colorkey][Pencapkey]).forEach((PenThicknesskey) => {
					const {
						[Colorkey]: {
							[Pencapkey]: {
								[PenThicknesskey]: dataArr,
							},
						},
					} = dataObj;

					dataArr.forEach((data) => {
						drawTemp(Colorkey, Pencapkey, PenThicknesskey, data);
					});
				});
			});
		}
	});
});

socket.on('clear', () => {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
});

socket.on('fill', (color) => {
	ctx.fillStyle = color;
	ctx.fillRect(0, 0, canvas.width, canvas.height);
});

socket.on('updateInk', (percentage) => {
	inkBar.innerHTML = `${percentage}%`;
	inkBar.style.width = `${percentage}%`;
	inkBar.ariaValuenow = percentage;
});

socket.on('setMaxInk', (value) => {
	if (value === 'Easy') {
		totalInk = 6000;
	} else if (value === 'Normal') {
		totalInk = 3000;
	} else {
		totalInk = 1500;
	}
});

socket.on('gamestate', (data) => {
	const {
		currentDrawingPlayer: {
			id,
			username,
		},
	} = data;
	canDraw = (socket.id === id);
	$('#currentDrawingPlayer').text(username);
});

socket.on('updateRound', (roundNum) => {
	document.getElementById('currentRound').innerHTML = roundNum;
});

socket.on('showTotalRounds', (totRounds) => {
	document.getElementById('totalRounds').innerHTML = totRounds;
});

socket.on('gameEnd', (data) => {
	document.getElementById('gameWinner').innerHTML = data.player;
	document.getElementById('winnerScore').innerHTML = data.score;
	$('#endgameModal').modal({ backdrop: 'static', keyboard: false });
});

socket.on('wordPrompt', (word) => {
	$('#word').text(word);
});

socket.on('stopDrawing', () => {
	canDraw = false;
});

socket.on('turntimer', (time) => {
	if (timeInterval != null) {
		window.clearInterval(timeInterval);
	}

	document.getElementById('gameTimer').innerHTML = time;
	timeInterval = window.setInterval(() => {
		let timeLeft = parseInt(document.getElementById('gameTimer').innerHTML, 10);
		timeLeft -= 1;
		document.getElementById('gameTimer').innerHTML = timeLeft;
		if (timeLeft <= 0) window.clearInterval(timeInterval);
	}, 1000);
});

// eslint-disable-next-line no-unused-vars
function pickWord(n) {
	if (pickTimer != null) {
		window.clearInterval(pickTimer);
	}
	const chosenWord = document.getElementById(`word${n}`).innerHTML;
	$('#wordModal').modal('hide');
	socket.emit('updateInk', 100);
	currentInk = 0;
	hasInk = true;
	socket.emit('wordPicked', chosenWord);
	socket.emit('beginNewPath');
}

socket.on('wordModal', (words) => {
	for (let i = 0; i < words.length; i += 1) {
		document.getElementById(`word${i}`).innerHTML = words[i];
	}
	document.getElementById('pickWordTimer').innerHTML = 10;
	$('#wordModal').modal({ backdrop: 'static', keyboard: false });
	pickTimer = window.setInterval(() => {
		let timeLeft = parseInt(document.getElementById('pickWordTimer').innerHTML, 10);
		timeLeft -= 1;
		document.getElementById('pickWordTimer').innerHTML = timeLeft;
		if (timeLeft <= 0) {
			pickWord(Math.floor(Math.random() * 3));
		}
	}, 1000);
});

// Chat functions
$('#chat-form').submit((e) => {
	if ($('#chat-input').val().trim() === '') {
		return false;
	}
	// Prevent page from reloading
	e.preventDefault();
	let playerScore = document.getElementById('gameTimer').innerHTML;
	if (playerScore == null) playerScore = 0;
	// Emit message to server
	socket.emit('messageTyped', { msg: $('#chat-input').val(), score: playerScore });
	// Reset input field
	$('#chat-form')[0].reset();
	return false;
});

socket.on('updateScore', (score) => {
	document.getElementById('playerScore').innerHTML = score;
});

// Update Chat DOM
socket.on('chatMessage', (msgObj) => {
	const {
		msg = '',
		color = 'black',
	} = msgObj;

	$('#messages').append($('<li>').text(`${msg}`).css('color', color));
	chatAutoScroll.scrollTop = chatAutoScroll.scrollHeight;
});

// Update Player List DOM of individual room
socket.on('updatePlayer', (data) => {
	const {
		playerList,
		playerScores,
		guessedPlayerList,
		currentDrawer,
	} = data;

	$('#playerList').text('');
	let i = 0;
	playerList.forEach((player) => {
		const listElement = $(`<li ${guessedPlayerList.includes(player.id) ? 'style="background-color: #86eb34;"' : ''}>`).text(`${player.username}: ${playerScores[i]}`);
		if (currentDrawer === player.id) {
			listElement.append(pencilImg);
		}
		$('#playerList').append(listElement);
		i += 1;
	});
});
