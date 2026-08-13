import passport from 'passport';
import GoogleStrategy from 'passport-google-oauth20';
import User from '../models/User.model.js';
import generateAccessToken from '../services/generateToken.service.js';
import { logger } from '../utils/logger.js';

// Only configure Google OAuth if credentials are provided
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  // Configure Google OAuth Strategy
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          logger.info(`Google OAuth callback for user: ${profile.emails[0].value}`);
          
          const email = profile.emails[0].value;
          const googleId = profile.id;
          const fullName = profile.displayName || profile.name?.givenName + ' ' + profile.name?.familyName;
          const profilePic = profile.photos[0]?.value;

          // Check if user exists by Google ID
          let user = await User.findOne({ googleId }).select('+googleId +provider');

          if (user) {
            // User exists with Google ID - login
            logger.info(`Existing Google user found: ${email}`);
            return done(null, user);
          }

          // Check if user exists by email (might have signed up with email/password)
          user = await User.findOne({ email }).select('+googleId +provider');

          if (user) {
            // Link Google account to existing user
            logger.info(`Linking Google account to existing user: ${email}`);
            user.googleId = googleId;
            user.provider = 'google';
            user.isVerified = true; // Google accounts are verified
            user.profilePic = user.profilePic || profilePic;
            await user.save();
            return done(null, user);
          }

          // Create new user with Google
          logger.info(`Creating new Google user: ${email}`);
          user = await User.create({
            fullName: fullName || 'Google User',
            email,
            googleId,
            provider: 'google',
            isVerified: true,
            profilePic: profilePic || '',
            password: Math.random().toString(36).slice(-8), // Random password for OAuth users
          });

          return done(null, user);
        } catch (error) {
          logger.error('Error in Google OAuth strategy:', error);
          return done(error, null);
        }
      }
    )
  );

  // Serialize user for session
  passport.serializeUser((user, done) => {
    done(null, user._id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  logger.info('Google OAuth configured successfully');
} else {
  logger.warn('Google OAuth credentials not provided. Google login will be disabled.');
}

export default passport;
