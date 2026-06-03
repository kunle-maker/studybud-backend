import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import User from '../models/User.js';

async function findOrCreateOAuthUser({ providerId, providerField, email, name, profilePicture, authProvider }) {
  let user = await User.findOne({ [providerField]: providerId });
  if (user) return user;

  if (email) {
    user = await User.findOne({ email });
    if (user) {
      user[providerField] = providerId;
      if (!user.profilePicture && profilePicture) user.profilePicture = profilePicture;
      await user.save({ validateBeforeSave: false });
      return user;
    }
  }

  user = await User.create({
    [providerField]: providerId,
    email:           email || undefined,
    name,
    profilePicture,
    authProvider
  });
  return user;
}

passport.use(new GoogleStrategy(
  {
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:  `${process.env.BACKEND_URL}/api/v1/auth/google/callback`
  },
  async (_at, _rt, profile, done) => {
    try {
      const user = await findOrCreateOAuthUser({
        providerId:     profile.id,
        providerField:  'googleId',
        email:          profile.emails?.[0]?.value,
        name:           profile.displayName,
        profilePicture: profile.photos?.[0]?.value,
        authProvider:   'google'
      });
      done(null, user);
    } catch (err) { done(err); }
  }
));

passport.use(new GitHubStrategy(
  {
    clientID:     process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL:  `${process.env.BACKEND_URL}/api/v1/auth/github/callback`,
    scope:        ['user:email']
  },
  async (_at, _rt, profile, done) => {
    try {
      const user = await findOrCreateOAuthUser({
        providerId:     String(profile.id),
        providerField:  'githubId',
        email:          profile.emails?.[0]?.value,
        name:           profile.displayName || profile.username,
        profilePicture: profile.photos?.[0]?.value,
        authProvider:   'github'
      });
      done(null, user);
    } catch (err) { done(err); }
  }
));

passport.serializeUser((user, done) => done(null, user._id.toString()));
passport.deserializeUser(async (id, done) => {
  try { done(null, await User.findById(id)); }
  catch (err) { done(err); }
});

export default passport;
