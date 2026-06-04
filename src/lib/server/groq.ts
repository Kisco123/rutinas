import Groq from 'groq-sdk';
import { env } from './env';

let client: Groq | null = null;

/**
 * Cliente singleton de Groq. Usa la API OpenAI-compatible de Groq.
 * Solo desde endpoints +server.ts; nunca expuesto al navegador.
 */
export function getGroqClient(): Groq {
  if (!client) {
    client = new Groq({ apiKey: env.groqApiKey });
  }
  return client;
}

export const GROQ_MODELS = {
  /** Llama 3.3 70B — modelo principal para extracción estructurada */
  llama: 'llama-3.3-70b-versatile',
  /** Llama 3.1 8B — más rápido y barato para tareas simples */
  llamaFast: 'llama-3.1-8b-instant'
} as const;
