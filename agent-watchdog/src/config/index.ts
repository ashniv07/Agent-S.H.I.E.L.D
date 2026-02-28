import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  anthropicApiKey: z.string().min(1, 'ANTHROPIC_API_KEY is required'),
  port: z.coerce.number().default(3001),
  host: z.string().default('localhost'),
  databasePath: z.string().default('./data/watchdog.db'),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
});

const configResult = configSchema.safeParse({
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  port: process.env.PORT || undefined,
  host: process.env.HOST || undefined,
  databasePath: process.env.DATABASE_PATH || undefined,
  nodeEnv: process.env.NODE_ENV || undefined,
});

if (!configResult.success) {
  console.error('Configuration error:', configResult.error.format());
  process.exit(1);
}

export const config = configResult.data;
