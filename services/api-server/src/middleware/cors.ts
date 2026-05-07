import cors from 'cors';
import { env } from '../config/environment.js';

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'https://enghub-frontend-production.up.railway.app',
  'https://enghub.local',
];

if (env.NODE_ENV === 'development') {
  ALLOWED_ORIGINS.push('*');
}

export const corsMiddleware = cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
});
