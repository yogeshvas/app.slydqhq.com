import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { env } from "./env";
import { User } from "../models/identity/user.model";
import { generateUniqueUserName } from "../services/user.service";

passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        const avatar = profile.photos?.[0]?.value ?? "";
        const displayName =
          profile.displayName || email?.split("@")[0] || "user";

        // 1. Returning Google user — match on googleId.
        const existingByGoogle = await User.findOne({ googleId: profile.id });
        if (existingByGoogle) {
          return done(null, existingByGoogle);
        }

        // 2. Account already exists for this email (created another way or a
        //    prior login) — link Google to it instead of creating a duplicate.
        if (email) {
          const existingByEmail = await User.findOne({ email });
          if (existingByEmail) {
            const user = existingByEmail as any;
            if (!user.googleId) user.googleId = profile.id;
            const hasGoogleProvider = (user.authProviders ?? []).some(
              (p: any) => p.provider === "google",
            );
            if (!hasGoogleProvider) {
              user.authProviders = [
                ...(user.authProviders ?? []),
                { provider: "google", providerId: profile.id },
              ];
            }
            await user.save();
            return done(null, user);
          }
        }

        // 3. Brand-new user — pick a collision-free userName.
        const userName = await generateUniqueUserName(displayName);
        const newUser = await User.create({
          googleId: profile.id,
          email,
          userName,
          avatar,
          authProviders: [{ provider: "google", providerId: profile.id }],
        });

        return done(null, newUser);
      } catch (error) {
        return done(error as Error);
      }
    },
  ),
);

export default passport;
