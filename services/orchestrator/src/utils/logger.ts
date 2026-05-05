import pino, { Logger as PinoLogger } from 'pino';

export function createLogger(level: string = 'info'): PinoLogger {
  return pino({
    level,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        singleLine: false,
        translateTime: 'SYS:standard',
      },
    },
  });
}

export type Logger = PinoLogger;
