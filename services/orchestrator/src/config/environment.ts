import dotenv from 'dotenv';
import { Logger } from 'pino';

dotenv.config();

export interface Environment {
  redis: {
    url: string;
  };
  supabase: {
    url: string;
    serviceKey: string;
  };
  orchestrator: {
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    maxRetries: number;
    retryDelayMs: number;
    consumerGroupName: string;
  };
  telegram?: {
    botToken: string;
    chatId: string;
  };
}

export function loadEnvironment(logger: Logger): Environment {
  const requiredVars = [
    'REDIS_URL',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
  ];

  const missing = requiredVars.filter(v => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const env: Environment = {
    redis: {
      url: process.env.REDIS_URL!,
    },
    supabase: {
      url: process.env.SUPABASE_URL!,
      serviceKey: process.env.SUPABASE_SERVICE_KEY!,
    },
    orchestrator: {
      logLevel: (process.env.LOG_LEVEL || 'info') as any,
      maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
      retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || '1000', 10),
      consumerGroupName: process.env.CONSUMER_GROUP_NAME || 'orchestrator-group',
    },
    telegram: process.env.TELEGRAM_BOT_TOKEN
      ? {
          botToken: process.env.TELEGRAM_BOT_TOKEN,
          chatId: process.env.TELEGRAM_CHAT_ID || '',
        }
      : undefined,
  };

  logger.info('Environment loaded successfully');
  return env;
}
