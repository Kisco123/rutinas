import Anthropic from '@anthropic-ai/sdk';
import { env } from './env';

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: env.anthropicApiKey });
  }
  return client;
}

export const MODELS = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-6'
} as const;
