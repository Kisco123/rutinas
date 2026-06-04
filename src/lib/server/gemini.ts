import { GoogleGenAI } from '@google/genai';
import { env } from './env';

let client: GoogleGenAI | null = null;

/**
 * Cliente singleton de Google Gemini. Reusa la conexión entre llamadas.
 * Usado solo en endpoints +server.ts; nunca expuesto al navegador.
 */
export function getGeminiClient(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({ apiKey: env.geminiApiKey });
  }
  return client;
}

export const GEMINI_MODELS = {
  flash: 'gemini-2.0-flash',
  flashLite: 'gemini-2.0-flash-lite'
} as const;
