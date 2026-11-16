import { NextResponse } from 'next/server';
import { requireDocumentationAdmin } from '@/lib/documentation/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-helpers';
import { documentationPriceSchema } from '@/lib/documentation/pricing';

const schemaError = 'No se pudo acceder al catálogo. Comprueba que se ha aplicado la migración 20261115_create_documentation_product_prices.sql.';

export async function GET(request: Request) {
  const auth = await requireDocumentationAdmin(request);
  if ('error' in auth) return auth.error;
  const { data, error } = await supabaseAdmin.from('documentation_product_prices' as any).select('product_key, price_with_vat, sale_without_vat, purchase_without_vat, fixed_per_bottle');
  if (error) return NextResponse.json({ error: schemaError }, { status: 503 });
  const catalog = Object.fromEntries((data || []).map((r: any) => [r.product_key, { priceWithVat: Number(r.price_with_vat), saleWithoutVat: Number(r.sale_without_vat), purchaseWithoutVat: Number(r.purchase_without_vat), fixedPerBottle: r.fixed_per_bottle === null ? null : Number(r.fixed_per_bottle) }]));
  return NextResponse.json({ catalog });
}

export async function PATCH(request: Request) {
  const auth = await requireDocumentationAdmin(request);
  if ('error' in auth) return auth.error;
  let price;
  try { price = documentationPriceSchema.parse(await request.json()); }
  catch { return NextResponse.json({ error: 'Producto o precios inválidos.' }, { status: 400 }); }
  const { error } = await supabaseAdmin.from('documentation_product_prices' as any).upsert({
    product_key: price.productKey, price_with_vat: price.priceWithVat, sale_without_vat: price.saleWithoutVat,
    purchase_without_vat: price.purchaseWithoutVat, fixed_per_bottle: price.fixedPerBottle ?? null, updated_at: new Date().toISOString(), updated_by: auth.user.id,
  }, { onConflict: 'product_key' });
  if (error) return NextResponse.json({ error: schemaError }, { status: 503 });
  return NextResponse.json({ success: true });
}
