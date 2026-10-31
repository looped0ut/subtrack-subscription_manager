import { env } from './config/env.js';
import express from 'express';
import cors from 'cors';
import prisma from './config/prisma.js';
import authRoutes from './routes/auth.routes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors({ origin: env.frontendUrl }));
app.use(express.json());

// Health check: confirms the server is up AND the database is reachable
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected', time: new Date().toISOString() });
  } catch (error) {
    console.error('Health check failed:', error.message);
    res.status(500).json({ status: 'error', database: 'unreachable' });
  }
});

app.use('/api/auth', authRoutes);

app.use(notFound);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`SubTrack API running on http://localhost:${env.port}`);
});