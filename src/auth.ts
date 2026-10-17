import NextAuth, { type DefaultSession } from "next-auth";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations/auth";

declare module "next-auth" {
  interface Session {
    user: { id: string; username: string } & DefaultSession["user"];
  }
  interface User {
    username?: string;
  }
}

export const isGoogleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

// Pick a free username derived from the e-mail address (used for Google sign-ups)
async function generateUsername(email: string) {
  const base =
    email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 16) || "kullanici";
  let candidate = base.length >= 3 ? base : `${base}_tv`;
  while (await prisma.user.findUnique({ where: { username: candidate } })) {
    candidate = `${base}_${Math.floor(1000 + Math.random() * 9000)}`;
  }
  return candidate;
}

// The schema requires a unique username, which OAuth profiles do not provide
const baseAdapter = PrismaAdapter(prisma as never);
const adapter: Adapter = {
  ...baseAdapter,
  async createUser({ email, name, image, emailVerified }: AdapterUser) {
    const user = await prisma.user.create({
      data: { email, name, image, emailVerified, username: await generateUsername(email) },
    });
    return user as AdapterUser;
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter,
  // Credentials sign-in only works with JWT sessions
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        identifier: { label: "E-posta veya kullanıcı adı" },
        password: { label: "Şifre", type: "password" },
      },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;

        const identifier = parsed.data.identifier.toLowerCase();
        const user = await prisma.user.findFirst({
          where: { OR: [{ email: identifier }, { username: identifier }] },
        });
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, image: user.image, username: user.username };
      },
    }),
    ...(isGoogleEnabled ? [Google] : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        token.username =
          user.username ??
          (await prisma.user.findUnique({ where: { id: user.id }, select: { username: true } }))?.username;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      if (token.username) session.user.username = token.username as string;
      return session;
    },
  },
});
