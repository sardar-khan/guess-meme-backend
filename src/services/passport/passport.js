const passport = require("passport");

const TwitterStrategy = require("passport-twitter").Strategy;
require("dotenv").config();

console.log("ENV", process.env.BACKEND_LINK, process.env.CONSUMER_KEYS, process.env.CONSUMER_SECRET)
// Configure Twitter OAuth Strategy
passport.use(
  new TwitterStrategy(
    {
      consumerKey: process.env.CONSUMER_KEYS,
      consumerSecret: process.env.CONSUMER_SECRET,
      callbackURL: `${process.env.BACKEND_LINK}/user/twitter/callback`,
    },
    (token, tokenSecret, profile, done) => {
      return done(null, profile);
    }
  )
);

// Serialize user
passport.serializeUser((user, done) => {
  done(null, user);
});

// Deserialize user
passport.deserializeUser((obj, done) => {
  done(null, obj);
});

module.exports = passport;
