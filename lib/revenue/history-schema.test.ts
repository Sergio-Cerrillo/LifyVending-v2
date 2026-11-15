import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withHistorySchemaCompatibility } from './history-schema';

test('no reintenta errores de permisos, duplicados o columnas ajenas al esquema interno', async () => {
  for (const error of [
    { code: '42501', message: 'permission denied for commission_amount' },
    { code: '23505', message: 'duplicate key' },
    { code: 'PGRST204', message: "Could not find the 'amount_total' column in the schema cache" },
    { code: '42703', message: 'column machines.unknown does not exist' },
  ]) {
    let calls = 0;
    const result = await withHistorySchemaCompatibility({ amount_total: 700 }, async () => {
      calls++;
      return { error };
    });
    assert.equal(calls, 1);
    assert.deepEqual(result.error, error);
  }
});
