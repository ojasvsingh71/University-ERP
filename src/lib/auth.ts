import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/password";
import { recordAudit } from "@/lib/audit";

const MAX_FAILED_ATTEMPTS = 5;

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "").toLowerCase().trim();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (!user) return null;

        // FR-IAM-04: lock the account after repeated failed attempts.
        if (user.status === "locked") return null;

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) {
          const attempts = user.failedLoginAttempts + 1;
          await db
            .update(users)
            .set({
              failedLoginAttempts: attempts,
              status: attempts >= MAX_FAILED_ATTEMPTS ? "locked" : user.status,
            })
            .where(eq(users.id, user.id));
          return null;
        }

        // Successful login resets the counter and records the event.
        await db.update(users).set({ failedLoginAttempts: 0 }).where(eq(users.id, user.id));
        await recordAudit({
          actorUserId: user.id,
          action: "UserLoggedIn",
          resourceType: "User",
          resourceId: user.id,
        });

        return { id: user.id, email: user.email, name: user.fullName, role: user.role };
      },
    }),
  ],
  callbacks: {
    // Embed the role into the JWT so it's available on every request without a DB round-trip.
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: string }).role;
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
});
