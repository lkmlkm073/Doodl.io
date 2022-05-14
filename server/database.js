const mysql = require('mysql');

const config = {
	user: process.env.SQL_USER,
	database: process.env.SQL_DATABASE,
	password: process.env.SQL_PASSWORD,
};

if (process.env.INSTANCE_CONNECTION_NAME && process.env.NODE_ENV === 'production') {
	config.socketPath = `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`;
}

function connectDB() {
	let con;
	if (process.env.INSTANCE_CONNECTION_NAME && process.env.NODE_ENV === 'production') {
		config.socketPath = `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`;
		con = mysql.createConnection(config);
	} else {
		con = mysql.createConnection({
			host: 'localhost',
			user: 'root',
			password: 'root',
			database: 'doodlioDatabase',
		});
	}

	con.connect((err) => {
		if (err) {
			console.log('error connecting to database: database servers or proxy may not be on!');
		}
		console.log('Connected to db!!');
	});

	return con;
}

module.exports = {
	connectDB,
};
