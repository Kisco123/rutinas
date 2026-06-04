import type Groq from 'groq-sdk';
import { GROQ_MODELS } from './groq';

export type ParsedEvent = {
  type: 'event';
  fields: {
    title: string;
    starts_at: string;
    ends_at: string | null;
    location: string | null;
    category: 'medico' | 'familia' | 'trabajo' | 'personal' | 'otro';
    description: string | null;
  };
  confidence: number;
};

export type ParsedBill = {
  type: 'bill';
  fields: {
    title: string;
    amount: number | null;
    currency: string;
    due_date: string;
    provider: string | null;
    recurrence: 'none' | 'monthly' | 'yearly';
    notes: string | null;
  };
  confidence: number;
};

export type ParsedUnknown = {
  type: 'unknown';
  confidence: number;
  reason: string;
};

export type ParseResult = ParsedEvent | ParsedBill | ParsedUnknown;

const SYSTEM_PROMPT = `Eres un asistente que extrae estructura de frases en español sobre citas y facturas.

Recibes:
- Una frase del usuario.
- La fecha y hora actuales en su zona horaria (ISO 8601).
- La zona horaria del usuario (IANA).

Decides si la frase describe:
- Un EVENTO (cita, recordatorio con fecha, cumpleaños): type "event"
- Una FACTURA o pago (algo con importe y fecha de vencimiento): type "bill"
- Si no es claramente ni una cosa ni la otra: type "unknown"

Devuelves SOLO un JSON válido (sin texto antes ni después) con esta forma:

Para event:
{"type":"event","fields":{"title":"...","starts_at":"ISO8601 con offset","ends_at":null,"location":null,"category":"medico|familia|trabajo|personal|otro","description":null},"confidence":0.0-1.0}

Para bill:
{"type":"bill","fields":{"title":"...","amount":number|null,"currency":"EUR","due_date":"YYYY-MM-DD","provider":null,"recurrence":"none|monthly|yearly","notes":null},"confidence":0.0-1.0}

Para unknown:
{"type":"unknown","confidence":0.0-1.0,"reason":"texto breve explicando qué falta"}

Reglas:
- Si dice "martes" sin más, asume el PRÓXIMO martes a partir de la fecha actual.
- Si no hay hora explícita en un evento, usa 09:00 local.
- Si no hay año en una factura, asume el año actual o el siguiente si la fecha ya pasó.
- Las fechas deben ir con offset de la zona horaria del usuario.
- "Médico", "doctor", "dentista", "clínica" → category "medico".
- "Mamá", "papá", "hermana", "abuelo" → category "familia".
- Si dudas, confidence < 0.6.`;

export async function parseIntent(
  client: Groq,
  text: string,
  nowIso: string,
  timezone: string
): Promise<ParseResult> {
  const completion = await client.chat.completions.create({
    model: GROQ_MODELS.llama,
    temperature: 0.2,
    max_tokens: 500,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Fecha y hora actuales: ${nowIso}\nZona horaria: ${timezone}\n\nFrase del usuario: ${text}`
      }
    ]
  });

  const raw = completion.choices[0]?.message?.content ?? '';
  if (!raw) {
    return { type: 'unknown', confidence: 0, reason: 'Respuesta vacía del modelo.' };
  }

  return validateParseResult(raw);
}

export function validateParseResult(raw: string): ParseResult {
  let parsed: unknown;
  try {
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return { type: 'unknown', confidence: 0, reason: 'JSON inválido del modelo.' };
  }

  if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) {
    return { type: 'unknown', confidence: 0, reason: 'Estructura inválida.' };
  }

  const obj = parsed as Record<string, unknown>;
  const confidence = typeof obj.confidence === 'number' ? obj.confidence : 0;

  if (obj.type === 'event' && obj.fields && typeof obj.fields === 'object') {
    const f = obj.fields as Record<string, unknown>;
    if (typeof f.title !== 'string' || typeof f.starts_at !== 'string') {
      return { type: 'unknown', confidence: 0, reason: 'Campos de evento incompletos.' };
    }
    return {
      type: 'event',
      fields: {
        title: f.title,
        starts_at: f.starts_at,
        ends_at: typeof f.ends_at === 'string' ? f.ends_at : null,
        location: typeof f.location === 'string' ? f.location : null,
        category: ['medico', 'familia', 'trabajo', 'personal', 'otro'].includes(f.category as string)
          ? (f.category as ParsedEvent['fields']['category'])
          : 'otro',
        description: typeof f.description === 'string' ? f.description : null
      },
      confidence
    };
  }

  if (obj.type === 'bill' && obj.fields && typeof obj.fields === 'object') {
    const f = obj.fields as Record<string, unknown>;
    if (typeof f.title !== 'string' || typeof f.due_date !== 'string') {
      return { type: 'unknown', confidence: 0, reason: 'Campos de factura incompletos.' };
    }
    return {
      type: 'bill',
      fields: {
        title: f.title,
        amount: typeof f.amount === 'number' ? f.amount : null,
        currency: typeof f.currency === 'string' ? f.currency : 'EUR',
        due_date: f.due_date,
        provider: typeof f.provider === 'string' ? f.provider : null,
        recurrence: ['none', 'monthly', 'yearly'].includes(f.recurrence as string)
          ? (f.recurrence as ParsedBill['fields']['recurrence'])
          : 'none',
        notes: typeof f.notes === 'string' ? f.notes : null
      },
      confidence
    };
  }

  return {
    type: 'unknown',
    confidence,
    reason: typeof obj.reason === 'string' ? obj.reason : 'Tipo no reconocido.'
  };
}
