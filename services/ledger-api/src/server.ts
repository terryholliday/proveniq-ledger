/**
 * Proveniq Ledger API Server
 * 
 * REST endpoints per INTER_APP_CONTRACT.md Section 5.5
 * - POST /v1/ledger/events - Append new event
 * - GET /v1/ledger/items/:itemId/events - Get item history
 * - GET /v1/ledger/events/:eventId - Get specific event
 * - GET /v1/ledger/wallets/:walletId/history - Get wallet history
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { eventsRouter } from './routes/events.js';
import { itemsRouter } from './routes/items.js';
import { walletsRouter } from './routes/wallets.js';
import { healthRouter } from './routes/health.js';
import { claimsRouter } from './routes/claims.js';
import { authRouter } from './routes/auth.js';
import { badgeRouter } from './routes/badge.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { optionalAuth, rateLimit } from './middleware/auth.js';

const app = express();
const PORT = process.env.PORT || 3002;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Optional auth and rate limiting for all routes
app.use(optionalAuth);
app.use(rateLimit);

// Auth Routes (public)
app.use('/auth', authRouter);

// API Routes
app.use('/v1/ledger/events', eventsRouter);
app.use('/v1/ledger/items', itemsRouter);
app.use('/v1/ledger/wallets', walletsRouter);
app.use('/v1/ledger/claims', claimsRouter);
app.use('/badge', badgeRouter);
app.use('/health', healthRouter);

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    PROVENIQ LEDGER API                        ║
║                   Truth Infrastructure v1.0                   ║
╠═══════════════════════════════════════════════════════════════╣
║  Server running on port ${PORT}                                  ║
║  Health check: http://localhost:${PORT}/health                   ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});

export { app };
