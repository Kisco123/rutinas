import { describe, it, expect } from 'vitest';
import { validateParseResult } from './parse-intent';

describe('validateParseResult', () => {
  it('parsea un evento válido', () => {
    const raw = JSON.stringify({
      type: 'event',
      fields: {
        title: 'Dentista',
        starts_at: '2026-06-10T10:00:00+02:00',
        ends_at: null,
        location: 'Clínica X',
        category: 'medico',
        description: null
      },
      confidence: 0.9
    });
    const result = validateParseResult(raw);
    expect(result.type).toBe('event');
    if (result.type === 'event') {
      expect(result.fields.title).toBe('Dentista');
      expect(result.fields.category).toBe('medico');
      expect(result.confidence).toBe(0.9);
    }
  });

  it('parsea una factura válida', () => {
    const raw = JSON.stringify({
      type: 'bill',
      fields: {
        title: 'Factura luz',
        amount: 80,
        currency: 'EUR',
        due_date: '2026-06-15',
        provider: 'Iberdrola',
        recurrence: 'monthly',
        notes: null
      },
      confidence: 0.85
    });
    const result = validateParseResult(raw);
    expect(result.type).toBe('bill');
    if (result.type === 'bill') {
      expect(result.fields.amount).toBe(80);
      expect(result.fields.recurrence).toBe('monthly');
    }
  });

  it('quita fences de markdown', () => {
    const raw = '```json\n{"type":"unknown","confidence":0.3,"reason":"vago"}\n```';
    const result = validateParseResult(raw);
    expect(result.type).toBe('unknown');
  });

  it('devuelve unknown ante JSON inválido', () => {
    const result = validateParseResult('no soy json');
    expect(result.type).toBe('unknown');
    expect(result.confidence).toBe(0);
  });

  it('devuelve unknown si faltan campos obligatorios del evento', () => {
    const raw = JSON.stringify({ type: 'event', fields: { title: 'X' }, confidence: 0.5 });
    const result = validateParseResult(raw);
    expect(result.type).toBe('unknown');
  });

  it('cae a categoria "otro" si la categoría es desconocida', () => {
    const raw = JSON.stringify({
      type: 'event',
      fields: {
        title: 'Evento',
        starts_at: '2026-06-10T10:00:00+02:00',
        ends_at: null,
        location: null,
        category: 'inventada',
        description: null
      },
      confidence: 0.8
    });
    const result = validateParseResult(raw);
    expect(result.type).toBe('event');
    if (result.type === 'event') {
      expect(result.fields.category).toBe('otro');
    }
  });
});
