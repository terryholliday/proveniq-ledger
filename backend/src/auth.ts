import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;

if (!admin.apps.length && FIREBASE_PROJECT_ID) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: FIREBASE_PROJECT_ID,
  });
}

const firebaseAuth = admin.apps.length ? admin.auth() : null;

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // API key fallback
  const apiKey = req.headers['x-api-key'];
  if (ADMIN_API_KEY && apiKey === ADMIN_API_KEY) {
    return next();
  }

  // Firebase ID token preferred
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization' });
  }

  const token = authHeader.slice(7);
  if (firebaseAuth) {
    try {
      await firebaseAuth.verifyIdToken(token);
      return next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  return res.status(503).json({ error: 'Auth not configured' });
}
