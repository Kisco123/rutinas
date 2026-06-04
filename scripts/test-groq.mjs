import { readFileSync } from 'node:fs';
import Groq from 'groq-sdk';

// Load .env manually
try {
  const envFile = readFileSync('.env', 'utf8');
  for (const line of envFile.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `Eres un asistente que extrae estructura de frases en español sobre citas y facturas. Devuelve SOLO un JSON con: {"type":"event"|"bill"|"unknown","fields":{...},"confidence":0-1}. Para event: title, starts_at (ISO con offset), ends_at, location, category (medico|familia|trabajo|personal|otro), description. Para bill: title, amount, currency (EUR), due_date (YYYY-MM-DD), provider, recurrence (none|monthly|yearly), notes. Si dice "martes" asume el próximo martes. Si no hay hora, 09:00.`;

const completion = await client.chat.completions.create({
  model: 'llama-3.3-70b-versatile',
  temperature: 0.2,
  response_format: { type: 'json_object' },
  messages: [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Fecha actual: ${new Date().toISOString()}\nZona: Europe/Madrid\n\nFrase: dentista próximo martes 11am en clínica San José` }
  ]
});

const raw = completion.choices[0].message.content;
console.log('Raw response:', raw);

// Inline minimal validation (mirrors validateParseResult behavior for smoke test)
function validateParseResult(raw) {
  let parsed;
  try {
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return { type: 'unknown', confidence: 0, reason: 'JSON inválido del modelo.' };
  }
  return parsed;
}

console.log('\nValidated:', JSON.stringify(validateParseResult(raw), null, 2));
