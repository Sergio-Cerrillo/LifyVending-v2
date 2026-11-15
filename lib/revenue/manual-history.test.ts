import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeManualHistory, manualHistoryAmounts } from './manual-history';

const now = new Date('2026-11-15T12:00:00Z');
const input = { machineId: '12345678-1234-4234-8234-123456789012', year: 2026, month: 10, amountTotal: 1000, amountType: 'gross' };

test('aplica el porcentaje oculto al bruto y calcula la comisión sobre el visible', () => {
  assert.deepEqual(manualHistoryAmounts(normalizeManualHistory(input, now), 30, 15), {
    amount_total: 700, gross_amount_internal: 1000, hidden_percent_applied: 30,
    payment_percent_applied: 15, commission_amount: 105,
  });
});
test('un importe final ya ajustado no se descuenta otra vez', () => {
  const amounts = manualHistoryAmounts(normalizeManualHistory({ ...input, amountType: 'visible', amountTotal: 700 }, now), 30, 15);
  assert.equal(amounts.amount_total, 700);
  assert.equal(amounts.gross_amount_internal, null);
  assert.equal(amounts.hidden_percent_applied, null);
});
test('mantiene la interpretación visible de las llamadas anteriores sin amountType', () => {
  const { amountType, ...legacy } = input;
  assert.equal(manualHistoryAmounts(normalizeManualHistory(legacy, now), 30, 15).amount_total, 1000);
});
test('acepta meses anteriores al alta y recaudación cero', () => {
  assert.equal(normalizeManualHistory({ ...input, year: 2020, amountTotal: 0 }, now).amountTotal, 0);
});
test('rechaza importes vacíos, nulos, negativos, no finitos o fuera del límite', () => {
  for (const amountTotal of ['', null, undefined, -1, NaN, Infinity, 10000000000]) {
    assert.throws(() => normalizeManualHistory({ ...input, amountTotal }, now));
  }
});
test('rechaza periodos inválidos, actuales y futuros', () => {
  for (const period of [{ month: 0 }, { month: 13 }, { month: 11 }, { month: 12 }, { year: 2027 }, { year: 1999 }]) {
    assert.throws(() => normalizeManualHistory({ ...input, ...period }, now));
  }
});
test('el límite mensual utiliza la zona horaria de Madrid', () => {
  assert.equal(normalizeManualHistory(input, new Date('2026-10-31T23:30:00Z')).month, 10);
  assert.throws(() => normalizeManualHistory(input, new Date('2026-10-31T21:30:00Z')));
});
test('redondea céntimos y valida porcentajes antes de publicar', () => {
  const payload = normalizeManualHistory({ ...input, amountTotal: 123.45 }, now);
  assert.equal(manualHistoryAmounts(payload, 30, 15).amount_total, 86.42);
  assert.equal(manualHistoryAmounts(payload, 100, 15).amount_total, 0);
  assert.throws(() => manualHistoryAmounts(payload, 101, 15));
  assert.throws(() => manualHistoryAmounts(payload, 30, NaN));
});
