const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth2').Strategy;
const LocalStrategy = require('passport-local').Strategy;
const keys = require('./keys');
const db = require('../server/database');

passport.serializeUser((user, done) => {
	done(null, user);
});
passport.deserializeUser((user, done) => {
	done(null, user);
});

// Google strategy
passport.use(new GoogleStrategy(
	{
		clientID: keys.google.clientID,
		clientSecret: keys.google.secret,
		callbackURL: '/auth/google/callback',
		passReqToCallback: true,
	}, ((request, accessToken, refreshToken, profile, done) => {
		const con = db.connectDB();

		con.query(`SELECT * FROM User WHERE email='${profile.email}'`, (err1, result) => {
			if (err1) {
				console.log(err1);
			}
			if (result.length === 0) {
				con.query(`INSERT INTO User (username, email) VALUES ('${profile.displayName}', '${profile.email}')`, (err2) => {
					if (err2) {
						console.log(err2);
					}
					const newUser = { username: profile.displayName, email: profile.email, guest: false };
					done(null, newUser);
				});
			} else {
				const user = { username: result[0].username, email: result[0].email, guest: false };
				done(null, user);
			}
		});
	}),
));

// Local strategy for guest Login
passport.use(new LocalStrategy({
	usernameField: 'uname',
	passwordField: 'uname',
	session: true,
	passReqToCallback: false,
}, (username, password, done) => {
	const guestUser = { username, email: '', guest: true };
	done(null, guestUser);
}));

module.exports = passport;
