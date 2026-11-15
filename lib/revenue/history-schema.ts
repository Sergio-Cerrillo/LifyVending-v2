// Las instalaciones antiguas pueden tener la tabla base sin los campos internos
// añadidos en 20260811_add_internal_monthly_closure_fields.sql.
const internalColumns = new Set([
  'gross_amount_internal', 'hidden_percent_applied', 'payment_percent_applied',
  'commission_amount', 'source_provider', 'source_range_start', 'source_range_end',
  'status', 'generated_by', 'generated_at', 'published_at',
]);

type DatabaseResult<T> = { data?: T | null; error: { code?: string; message: string } | null };

export async function withHistorySchemaCompatibility<T = unknown>(
  row: Record<string, unknown>,
  execute: (row: Record<string, unknown>, legacy: boolean) => PromiseLike<DatabaseResult<T>>,
): Promise<DatabaseResult<T>> {
  const result = await execute(row, false);
  const error = result.error;
  if (!error || !['PGRST204', '42703'].includes(error.code || '')) return result;

  // Reintentar solo si falta una columna interna conocida. Nunca omitir errores
  // de permisos, duplicados ni columnas base necesarias para guardar el importe.
  const missingInternalColumn = [...internalColumns].some(column =>
    new RegExp(`(?:['".]|\\b)${column}(?:['"]|\\b)`).test(error.message),
  );
  if (!missingInternalColumn) return result;

  const baseRow = Object.fromEntries(Object.entries(row).filter(([key]) => !internalColumns.has(key)));
  return await execute(baseRow, true);
}
