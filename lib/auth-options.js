import GoogleProvider from 'next-auth/providers/google';
import { getPool } from './db';

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      const pool = getPool();
      try {
        // Check if user exists
        const userResult = await pool.query(
          'SELECT id, role FROM users WHERE email = $1',
          [profile.email]
        );
        
        if (userResult.rows.length === 0) {
          // New user - create with default role
          await pool.query(
            'INSERT INTO users (name, email, image, role, email_verified) VALUES ($1, $2, $3, $4, $5)',
            [profile.name, profile.email, profile.picture, 'sales', new Date()]
          );
        }
        
        // Create or update account
        await pool.query(
          `INSERT INTO accounts (user_id, type, provider, provider_account_id, access_token, expires_at, token_type, scope, id_token)
           SELECT u.id, $1, $2, $3, $4, $5, $6, $7, $8
           FROM users u WHERE u.email = $9
           ON CONFLICT (provider, provider_account_id) DO UPDATE SET access_token = $4, expires_at = $5, id_token = $8`,
          [
            account.type,
            account.provider,
            account.providerAccountId,
            account.access_token,
            account.expires_at,
            account.token_type,
            account.scope,
            account.id_token,
            profile.email
          ]
        );
        
        return true;
      } catch (error) {
        console.error('Sign in error:', error);
        return false;
      }
    },
    async session({ session, token }) {
      const pool = getPool();
      try {
        const result = await pool.query(
          'SELECT id, name, email, image, role, active FROM users WHERE email = $1',
          [token.email]
        );
        
        if (result.rows.length > 0) {
          const user = result.rows[0];
          session.user.id = user.id;
          session.user.role = user.role;
          session.user.active = user.active;
        }
      } catch (error) {
        console.error('Session error:', error);
      }
      return session;
    },
    async jwt({ token, user, account }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
};
