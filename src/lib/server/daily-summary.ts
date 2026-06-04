import type Groq from 'groq-sdk';
import { GROQ_MODELS } from './groq';

export type SummaryContext = {
  fullName: string | null;
  events: Array<{
    title: string;
    starts_at: string;
    location: string | null;
    category: string;
  }>;
  bills: Array<{
    title: string;
    amount: number | null;
    currency: string;
    due_date: string;
    paid: boolean;
  }>;
};

const SYSTEM_PROMPT = `Eres un asistente cálido y conciso que escribe el resumen del día para un usuario en español.

Recibes en JSON:
- nombre del usuario (puede ser null)
- lista de eventos próximos (próximos 7 días) con título, fecha/hora ISO, lugar, categoría
- lista de facturas próximas a vencer (próximos 14 días) con título, importe, fecha, si están pagadas

Escribes UN PÁRRAFO CORTO (máximo 3 frases) que:
- Salude por su nombre si lo tiene, o use un saludo general si no
- Mencione lo más relevante de hoy y los próximos días
- Si hay facturas urgentes, las prioriza
- Tono cálido pero claro, sin emojis innecesarios, sin frases vacías como "espero que tengas un buen día"
- NUNCA inventes citas o facturas que no estén en los datos
- Si no hay nada relevante (listas vacías), di algo breve tipo "Hoy no tienes nada agendado. Buen momento para descansar o añadir lo que tengas pendiente."

Devuelves SOLO el párrafo. Sin markdown, sin comillas, sin prefijos.`;

export function buildUserPrompt(ctx: SummaryContext, todayIso: string): string {
  return `Hoy es ${todayIso}.\n\nDatos del usuario:\n${JSON.stringify(ctx, null, 2)}`;
}

export async function generateDailySummary(
  client: Groq,
  ctx: SummaryContext,
  todayIso: string
): Promise<string> {
  const completion = await client.chat.completions.create({
    model: GROQ_MODELS.llama,
    temperature: 0.5,
    max_tokens: 300,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(ctx, todayIso) }
    ]
  });

  return (completion.choices[0]?.message?.content ?? '').trim();
}

export function fallbackSummary(ctx: SummaryContext): string {
  const greeting = ctx.fullName?.trim()
    ? `Hola, ${ctx.fullName.trim()}.`
    : 'Hola.';

  const eventCount = ctx.events.length;
  const billCount = ctx.bills.filter((b) => !b.paid).length;

  if (eventCount === 0 && billCount === 0) {
    return `${greeting} Hoy no tienes nada agendado. Buen momento para añadir lo que tengas pendiente.`;
  }

  const parts: string[] = [];
  if (eventCount > 0) parts.push(`${eventCount} cita${eventCount === 1 ? '' : 's'} próxima${eventCount === 1 ? '' : 's'}`);
  if (billCount > 0) parts.push(`${billCount} factura${billCount === 1 ? '' : 's'} por pagar`);

  return `${greeting} Tienes ${parts.join(' y ')}.`;
}
