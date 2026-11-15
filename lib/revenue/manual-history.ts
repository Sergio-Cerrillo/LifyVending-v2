import { z } from 'zod';

const payloadSchema = z.object({
  machineId: z.string().uuid('Máquina inválida'),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  amountTotal: z.number().finite().min(0).max(9999999999.99),
  amountType: z.enum(['gross', 'visible']).default('visible'),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export function normalizeManualHistory(body: unknown, now = new Date()) {
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) throw new Error('Revisa la máquina, el mes y el importe (debe ser un número positivo o cero).');
  const payload = parsed.data;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: 'numeric',
  }).formatToParts(now);
  const year = Number(parts.find(p => p.type === 'year')?.value);
  const month = Number(parts.find(p => p.type === 'month')?.value);
  if (payload.year * 12 + payload.month >= year * 12 + month) {
    throw new Error('Elige un mes anterior al mes actual.');
  }
  return { ...payload, amountTotal: Math.round((payload.amountTotal + Number.EPSILON) * 100) / 100, notes: payload.notes || null };
}

// amount_total siempre contiene el importe final visible, igual que los cierres automáticos.
export function manualHistoryAmounts(payload: ReturnType<typeof normalizeManualHistory>, hiddenPercent: number, paymentPercent: number) {
  if (![hiddenPercent, paymentPercent].every(n => Number.isFinite(n) && n >= 0 && n <= 100)) {
    throw new Error('Los porcentajes guardados del cliente no son válidos.');
  }
  const gross = payload.amountType === 'gross' ? payload.amountTotal : null;
  const visible = gross === null ? payload.amountTotal : Math.round(gross * (1 - hiddenPercent / 100) * 100) / 100;
  return {
    amount_total: visible,
    gross_amount_internal: gross,
    hidden_percent_applied: gross === null ? null : hiddenPercent,
    payment_percent_applied: paymentPercent,
    commission_amount: Math.round(visible * paymentPercent) / 100,
  };
}
