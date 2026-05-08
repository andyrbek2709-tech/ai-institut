import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.resolve(__dirname, '../../.env.local') });

export interface IngestionEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  OPENAI_API_KEY: string;
  REDIS_URL: string;
  NODE_ENV: 'development' | 'production' | 'test';
  LOG_LEVEL: string;
  INGESTION_CONCURRENCY: number;
  EMBEDDING_BATCH_SIZE: number;
  MINERU_URL?: string;         // optional Python MinerU microservice
  STORAGE_BUCKET: string;
}

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

export const env: IngestionEnv = {
  SUPABASE_URL:          requireEnv('SUPABASE_URL'),
  SUPABASE_SERVICE_KEY:  requireEnv('SUPABASE_SERVICE_KEY'),
  OPENAI_API_KEY:        requireEnv('OPENAI_API_KEY'),
  REDIS_URL:             requireEnv('REDIS_URL'),
  NODE_ENV:              (process.env.NODE_ENV as any) ?? 'development',
  LOG_LEVEL:             process.env.LOG_LEVEL ?? 'info',
  INGESTION_CONCURRENCY: parseInt(process.env.INGESTION_CONCURRENCY ?? '3', 10),
  EMBEDDING_BATCH_SIZE:  parseInt(process.env.EMBEDDING_BATCH_SIZE ?? '100', 10),
  MINERU_URL:            process.env.MINERU_URL,
  STORAGE_BUCKET:        process.env.STORAGE_BUCKET ?? 'agsk-standards',
};
