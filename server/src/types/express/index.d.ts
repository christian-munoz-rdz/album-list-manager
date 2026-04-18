export {};

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    spotifyOAuthState?: string;
  }
}
