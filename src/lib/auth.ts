import { betterAuth } from "better-auth";
import { admin, username } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@/db";
import { sendVerificationEmail, sendResetPasswordEmail } from "@/lib/email";
import { ensureUserProfile } from "@/lib/user-profile";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET || "mock-secret-for-build-time-purposes-only-12345",
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    sendResetPassword: async ({ user, url }) => {
      await sendResetPasswordEmail(user.email, url);
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(user.email, url);
    },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          try {
            await ensureUserProfile({
              id: user.id,
              name: user.name,
              email: user.email,
              username: typeof user.username === "string" ? user.username : null,
              displayUsername:
                typeof user.displayUsername === "string" ? user.displayUsername : null,
            });
          } catch (error) {
            // Registration must not become unrecoverable after Better Auth has
            // already committed the user. requireActiveUser retries lazily.
            console.error("Profile initialization failed after registration:", error);
          }
        },
      },
    },
  },
  plugins: [
    username(),
    admin(),
    nextCookies(),
  ],
});
