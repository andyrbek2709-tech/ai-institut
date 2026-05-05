import pino from 'pino';
import { env } from '../config/environment.js';

const isDev = env.NODE_ENV !== 'production';

export const logger = pino({
  level: env.LOG_LEVEL,
  ...(isDev ? {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, singleLine: true },
    },
  } : {}),
});
