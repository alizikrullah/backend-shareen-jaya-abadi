import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import { env } from './env.js'
import { loginWithGoogle } from '../../features/auth/auth.service.js'

// Login Google aktif hanya kalau client ID + secret sudah diisi di .env
export const isGoogleEnabled = Boolean(env.google.clientID && env.google.clientSecret)

if (isGoogleEnabled) {
  passport.use(
    new GoogleStrategy(env.google, async (accessToken, refreshToken, profile, done) => {
      try {
        done(null, await loginWithGoogle(profile))
      } catch (err) {
        done(err)
      }
    }),
  )
}

export { passport }
