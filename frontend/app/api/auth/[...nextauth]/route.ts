import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // Fetch from the internal Docker backend network
        const res = await fetch("http://backend:8000/api/v1/auth/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            username: credentials?.username || "",
            password: credentials?.password || "",
          }),
        });

        const data = await res.json();

        // If FastAPI gives us a token, NextAuth logs the user in!
        if (res.ok && data.access_token) {
          return {
            id: credentials?.username as string,
            name: credentials?.username as string,
            accessToken: data.access_token,
          };
        }
        return null;
      }
    })
  ],
  callbacks: {
    // Store the FastAPI token inside the Next.js session
    async jwt({ token, user }) {
      if (user) {
        token.accessToken = (user as any).accessToken;
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).accessToken = token.accessToken;
      return session;
    }
  },
  pages: {
    signIn: "/login", // We will build this page in Stage 2
  },
  secret: process.env.NEXTAUTH_SECRET || "fallback-secret-for-development",
});

export { handler as GET, handler as POST };