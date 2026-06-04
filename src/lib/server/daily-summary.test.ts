import { describe, it, expect } from 'vitest';
import { buildUserPrompt, fallbackSummary } from './daily-summary';

describe('buildUserPrompt', () => {
  it('incluye la fecha de hoy y los datos en JSON', () => {
    const prompt = buildUserPrompt(
      { fullName: 'Pablo', events: [], bills: [] },
      '2026-06-04'
    );
    expect(prompt).toContain('2026-06-04');
    expect(prompt).toContain('"fullName": "Pablo"');
  });
});

describe('fallbackSummary', () => {
  it('saluda por nombre si existe', () => {
    const result = fallbackSummary({ fullName: 'Pablo', events: [], bills: [] });
    expect(result).toMatch(/^Hola, Pablo\./);
  });

  it('usa saludo genérico sin nombre', () => {
    const result = fallbackSummary({ fullName: null, events: [], bills: [] });
    expect(result).toMatch(/^Hola\./);
  });

  it('dice que no hay nada cuando listas están vacías', () => {
    const result = fallbackSummary({ fullName: null, events: [], bills: [] });
    expect(result).toContain('nada agendado');
  });

  it('cuenta citas y facturas pendientes', () => {
    const result = fallbackSummary({
      fullName: 'Ana',
      events: [
        { title: 'A', starts_at: '2026-06-05T10:00:00Z', location: null, category: 'otro' },
        { title: 'B', starts_at: '2026-06-06T10:00:00Z', location: null, category: 'otro' }
      ],
      bills: [
        { title: 'Luz', amount: 50, currency: 'EUR', due_date: '2026-06-10', paid: false },
        { title: 'Agua', amount: 20, currency: 'EUR', due_date: '2026-06-15', paid: true }
      ]
    });
    expect(result).toContain('2 citas próximas');
    expect(result).toContain('1 factura por pagar');
  });

  it('omite facturas pagadas del conteo', () => {
    const result = fallbackSummary({
      fullName: null,
      events: [],
      bills: [
        { title: 'X', amount: 10, currency: 'EUR', due_date: '2026-06-10', paid: true }
      ]
    });
    expect(result).toContain('nada agendado');
  });
});
