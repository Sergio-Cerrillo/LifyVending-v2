import assert from 'node:assert/strict';
import { test } from 'node:test';
import { previousMadridMonthRange, simpleMachineCommission, productCommission } from './calculations';
import { documentationPriceSchema } from './pricing';

test('descuenta el porcentaje oculto antes de calcular la comisión por máquina', () => {
  assert.deepEqual(simpleMachineCommission(1000, 30, 15), { gross: 1000, hidden: 300, visible: 700, commission: 105 });
  const second = simpleMachineCommission(1000, 10, 20);
  assert.equal(second.commission, 180);
  assert.equal(second.commission + simpleMachineCommission(1000, 30, 15).commission, 285);
});
test('acota porcentajes y redondea cada máquina a céntimos', () => {
  assert.equal(simpleMachineCommission(123.45, 30, 15).commission, 12.96);
  assert.equal(simpleMachineCommission(100, 100, 15).commission, 0);
  assert.equal(simpleMachineCommission(100, -10, 150).commission, 100);
});
test('el fijo por botella sustituye al margen y al porcentaje, descontando las pruebas', () => {
  assert.equal(productCommission(100, 10, 2, 1, 50).commissionAmount, 45);
  assert.equal(productCommission(100, 10, 0, 0, 50, 0.5).commissionAmount, 45);
  assert.equal(productCommission(100, 10, 10, 0, 100, 0.2).commissionAmount, 18);
  assert.equal(productCommission(100, 200, 2, 1, 50, 0.5).commissionAmount, 0);
  assert.equal(productCommission(100, 0, 2, 1, 50, 0).commissionAmount, 0);
});
test('el mes anterior contempla cambio de año y fecha local de Madrid', () => {
  const january = previousMadridMonthRange(new Date('2026-01-15T12:00:00Z'));
  assert.equal(january.startDate, '2025-12-01T00:00:00+01:00');
  assert.equal(january.endDate, '2025-12-31T23:59:59.999+01:00');
  assert.equal(previousMadridMonthRange(new Date('2026-10-31T23:30:00Z')).month, 10);
});
test('el mes anterior usa desfases distintos a cada extremo en cambios de hora', () => {
  const october = previousMadridMonthRange(new Date('2026-11-15T12:00:00Z'));
  assert.equal(october.startDate, '2026-10-01T00:00:00+02:00');
  assert.equal(october.endDate, '2026-10-31T23:59:59.999+01:00');
  const march = previousMadridMonthRange(new Date('2026-04-15T12:00:00Z'));
  assert.equal(march.startDate, '2026-03-01T00:00:00+01:00');
  assert.equal(march.endDate, '2026-03-31T23:59:59.999+02:00');
});
test('catálogo rechaza precios inválidos y conserva el fijo por botella', () => {
  const price = { productKey: 'agua', priceWithVat: 2, saleWithoutVat: 1.65, purchaseWithoutVat: 0, fixedPerBottle: 0.5 };
  assert.equal(documentationPriceSchema.parse(price).fixedPerBottle, 0.5);
  assert.throws(() => documentationPriceSchema.parse({ ...price, purchaseWithoutVat: -1 }));
  assert.throws(() => documentationPriceSchema.parse({ ...price, fixedPerBottle: Infinity }));
});
