interface StockProduct {
  productName: string;
  line?: string;
  unitsToReplenish: number;
}

export function missingProducts(products: StockProduct[]) {
  const grouped = new Map<string, { productName: string; units: number; lines: string[] }>();
  for (const product of products) {
    const parsed = Number(product.unitsToReplenish);
    if (!Number.isFinite(parsed) || parsed <= 0) continue;
    const name = product.productName?.trim() || 'Producto sin nombre';
    // Conserva tamaños, variedades y marcas; solo agrupa el mismo nombre.
    const key = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').replace(/\s+/g, ' ');
    const row = grouped.get(key) || { productName: name, units: 0, lines: [] };
    row.units += Math.ceil(parsed);
    if (product.line && !row.lines.includes(product.line)) row.lines.push(product.line);
    grouped.set(key, row);
  }
  return [...grouped.values()].sort((a, b) => b.units - a.units || a.productName.localeCompare(b.productName, 'es'));
}
