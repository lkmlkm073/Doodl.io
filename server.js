// Module dependencies.
const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const logger = require('morgan');
const debug = require('debug')('demo:server');
const http = require('http');
const socketio = require('socket.io');

const passport = require('passport');
const session = require('express-session');
const db = require('./server/database');
const helpers = require('./server/helpers');

const app = express();

const con = db.connectDB();
const wordBank = [];

// fetch words from database
con.query('SELECT Word FROM DefaultWordBank', (err, result) => {
	if (err) {
		console.log('error fetching from database: database servers or proxy may not be on!');
	} else {
		for (let i = 0; i < result.length; i += 1) {
			wordBank.push(result[i].Word);
		}
		console.log(wordBank.length); // should be 345 for now
	}
});

app.use(logger('dev'));
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.engine('html', require('ejs').renderFile);

app.set('view engine', 'ejs');
app.use(session({ secret: 'MySecret', resave: false, saveUninitialized: true }));

app.use(passport.initialize());
app.use(passport.session());

app.use('/auth', require('./routes/auth'));

// Move to database
const rooms = {};
const intervalHandles = {};

// Define paths
app.get('/', (req, res) => {
	const { code } = req.cookies;
	res.clearCookie('code');

	if (code) {
		res.render('home', { user: req.user, code });
	} else {
		res.render('home', { user: req.user });
	}
	// res.render('home', { user: req.user });
});

// Save drawing
app.post('/save', (req, res) => {
	con.query(`INSERT INTO Gallery (email, title, image)
	VALUES('${req.user.email}', '${req.body.title}', '${req.body.url}')`, (err, result) => {
		if (err) {
			console.log(err);
			res.status(500).send(err.sqlMessage);
		} else {
			const msg = `Query OK, ${result.affectedRows} affected`;
			res.status(200).send(msg);
		}
	});
});

// Show drawings on gallery
app.post('/show', (req, res) => {
	if (typeof req.user !== 'undefined' && req.user) {
		con.query(`SELECT id, title, image FROM Gallery WHERE email='${req.user.email}'`, (err, result) => {
			if (err) {
				console.log(err);
				res.status(500).send(err.sqlMessage);
			} else {
				const imgArr = [];
				for (let i = 0; i < result.length; i += 1) {
					const { title } = result[i];
					const { id } = result[i];
					const img = result[i].image;
					imgArr.push({ title, id, url: img });
				}
				res.status(200).send(imgArr);
			}
		});
	} else {
		res.status(200).send();
	}
});

// Remove drawing
app.post('/remove', (req, res) => {
	con.query(`DELETE FROM Gallery WHERE id='${req.body.id}'`, (err, result) => {
		if (err) {
			console.log(err);
			res.status(500).send(err.sqlMessage);
		} else {
			res.status(200).send(result);
		}
	});
});

// Post request instead of using sockets since we don't need constant updates
app.post('/', (req, res) => {
	if (!req.user) {
		const {
			body: { code = '' },
		} = req;
		res.cookie('code', code, { httpOnly: true, sameSite: true, maxAge: 1000 * 600 });
		res.status(200).send(code);
		return;
	}

	const {
		body: { code = '' },
		user: { username },
	} = req;

	// store username in cookie
	if (username) {
		res.cookie('user', username, { httpOnly: true, sameSite: true, maxAge: 1000 * 600 });
	}

	// Room are 4 digits long
	if (code.length === 4) {
		console.log(`valid room code entered: ${code}`);
		if (code in rooms) {
			console.log('found an existing room');
			res.cookie('roomCode', code, { httpOnly: true, sameSite: true, maxAge: 1000 * 600 });
			res.render('gamescreen', { user: req.user, privilege: 'player' });
		} else {
			console.log('creating new room...');
			rooms[code] = helpers.createRoom();
			// Set cookie (expires after 10 minutes)
			res.cookie('roomCode', code, {
				httpOnly: true,
				sameSite: true,
				maxAge: 1000 * 600,
			});
			res.render('gamescreen', { user: req.user, privilege: 'admin' });
		}
	} else {
		console.log('Invalid room code');
		res.render('home', { user: req.user });
	}
});

// catch 404 and forward to error handler
app.use((req, res, next) => {
	next(createError(404));
});

// error handler
app.use((err, req, res) => {
	// set locals, only providing error in development
	res.locals.message = err.message;
	res.locals.error = req.app.get('env') === 'development' ? err : {};

	// render the error page
	res.status(err.status || 500);

	console.log('rendering error page');
	res.render('error.html');
});

// Normalize a port into a number, string, or false.
function normalizePort(val) {
	const port = parseInt(val, 10);

	// eslint-disable-next-line no-restricted-globals
	if (isNaN(port)) {
		// named pipe
		return val;
	}

	if (port >= 0) {
		// port number
		return port;
	}

	return false;
}

// Get port from environment and store in Express.
const port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

// Create HTTP server.
const server = http.createServer(app);

// Event listener for HTTP server "error" event.
function onError(error) {
	if (error.syscall !== 'listen') {
		throw error;
	}

	const bind = typeof port === 'string' ? `Pipe ${port}` : `Port ${port}`;

	// handle specific listen errors with friendly messages
	switch (error.code) {
	case 'EACCES':
		console.error(`${bind} requires elevated privileges`);
		process.exit(1);
		break;
	case 'EADDRINUSE':
		console.error(`${bind} is already in use`);
		process.exit(1);
		break;
	default:
		throw error;
	}
}

// Event listener for HTTP server "listening" event.
function onListening() {
	const addr = server.address();
	const bind = typeof addr === 'string' ? `pipe ${addr}` : `port ${addr.port}`;
	debug(`Listening on ${bind}`);
}

// Listen on provided port, on all network interfaces.
server.listen(port, () => {
	console.log(`listening on *:${port}`);
});
server.on('error', onError);
server.on('listening', onListening);

// Create socket.io instance
const io = socketio(server);

// Listen on connection event for incoming sockets
io.on('connection', (socket) => {
	console.log('a user connected');
	socket.emit('chatMessage', { msg: 'Welcome to Doodl.io!', color: 'grey' });

	const { id, handshake: { headers: { cookie = '' } = {} } = {} } = socket;

	// Parse cookie for room code
	const code = helpers.getCookie(cookie, 'roomCode');

	// Parse cookie for username
	const user = decodeURI(helpers.getCookie(cookie, 'user'));

	console.log(`socket id: ${id}, joining room with code: ${code}`);
	socket.join(code);
	helpers.addPlayerToRoom(id, user, rooms, code);
	io.to(id).emit('showTotalRounds', rooms[code].roundNumber);

	// Update joining player with current game progress
	socket.emit('drawArr', rooms[code].currentDrawingState);

	// Broadcast when a user connects, update player list
	io.to(code).emit('chatMessage', `${user} has joined the room`);
	io.to(code).emit('updatePlayer', {
		playerList: rooms[code].players,
		guessedPlayerList: rooms[code].guessedCorrectly,
		currentDrawer: rooms[code].currentlyDrawing.id,
		playerScores: rooms[code].playerScores,
	});
	io.to(code).emit('setMaxInk', rooms[code].roomGameDifficulty);

	socket.on('startGame', (options) => {
		const {
			roundTime,
			roundNumber,
			gameDifficulty,
		} = options;

		if (rooms[code].started === false) {
			rooms[code].started = true;
			rooms[code].turnTimer = roundTime || 60;
			rooms[code].roundNumber = roundNumber || 3;
			rooms[code].roomGameDifficulty = gameDifficulty || 'Easy';
			io.to(code).emit('showTotalRounds', rooms[code].roundNumber);
			helpers.startGame(rooms, code, io, wordBank);
		}
		io.to(code).emit('setMaxInk', rooms[code].roomGameDifficulty);
	});

	// listen for chatMessage
	socket.on('messageTyped', (data) => {
		const room = rooms[code];
		if (rooms[code].started === false) {
			io.to(code).emit('chatMessage', { msg: `${user}: ${data.msg}` });
		} else if (id !== room.currentlyDrawing.id
			&& !room.guessedCorrectly.includes(id) && room.turnStarted) {
			if (data.msg === room.currentWordToDraw) {
				room.guessedCorrectly.push(id);
				const idIndex = rooms[code].players.map((player) => player.id).indexOf(id);
				const currentTime = parseFloat(`${data.score}.0`);
				const totalTime = parseFloat(`${room.turnTimer}.0`);
				let newScore = (currentTime / totalTime).toFixed(3) * 1000;
				if (room.guessedCorrectly.length === 1) {
					const dIndex = room.players.map((player) => player.id).indexOf(room.currentlyDrawing.id);
					room.playerScores[dIndex] += 400;
					io.to(room.currentlyDrawing.id).emit('updateScore', room.playerScores[dIndex]);
					newScore += 200;
				}
				room.playerScores[idIndex] += newScore;
				room.numGuessedRight += 1;
				io.to(code).emit('chatMessage', { msg: `${user} guessed the word!`, color: 'green' });
				io.to(id).emit('updateScore', room.playerScores[rooms[code].players.map((player) => player.id).indexOf(id)]); // used to show each player's own score to them, might not be needed
				io.to(code).emit('updatePlayer', {
					playerList: rooms[code].players,
					guessedPlayerList: room.guessedCorrectly,
					currentDrawer: rooms[code].currentlyDrawing.id,
					playerScores: rooms[code].playerScores,
				});

				if (room.numGuessedRight === room.playerCount - 1) {
					// TODO: Write that everyone guessed the word
					io.to(code).emit('chatMessage', { msg: 'Everyone has guessed the word!', color: 'blue' });
					clearInterval(intervalHandles[code]);
					helpers.endTurn(5000, rooms, code, io, wordBank);
				}
			} else {
				io.to(code).emit('chatMessage', { msg: `${user}: ${data.msg}` });
			}
		}
	});

	socket.on('draw', (data) => {
		const {
			currentlyDrawing: {
				id: currentDrawingId,
			},
			started: isStarted,
		} = rooms[code];
		// Check if the current user can draw
		if (id === currentDrawingId && isStarted) {
			io.to(code).emit('draw', data);
			helpers.storeData(data, rooms, code);
		}
	});

	socket.on('beginNewPath', () => {
		io.to(code).emit('beginNewPath');
	});

	socket.on('clear', () => {
		io.to(code).emit('clear');
		const room = rooms[code];
		room.currentDrawingState = {};
	});

	socket.on('fill', (color) => {
		io.to(code).emit('fill', color);
		const room = rooms[code];
		room.currentDrawingState = { fill: color };
	});

	socket.on('updateInk', (percentage) => {
		io.to(code).emit('updateInk', percentage);
	});

	// Once the drawer picks a word, start the turn
	socket.on('wordPicked', (word) => {
		const {
			turnTimer,
		} = rooms[code];
		rooms[code].currentWordToDraw = word;
		io.to(code).emit('clear');
		intervalHandles[code] = helpers.startTurn(turnTimer * 1000, rooms, code, io, wordBank);
	});

	socket.on('disconnect', () => {
		console.log('user disconnected');
		io.to(code).emit('chatMessage', { msg: `${user} has left the room`, color: 'red' });
		helpers.removePlayerFromRoom(id, rooms, code, intervalHandles, io);
	});
});
