import type { MachineStock, StockSummary, StockProduct } from '@/lib/types';

/**
 * Normaliza el nombre de un producto para evitar duplicados
 */
function normalizeProductName(name: string): string {
  return name.trim().toUpperCase();
}

/**
 * Agrega stock de múltiples máquinas y calcula totales por producto
 */
export function aggregateStock(machineStocks: MachineStock[], selectedMachineIds?: string[]): StockSummary[] {
  const productMap = new Map<string, StockSummary>();

  // Filtrar máquinas si se especificaron IDs
  const stocksToProcess = selectedMachineIds
    ? machineStocks.filter((stock) => selectedMachineIds.includes(stock.machineId))
    : machineStocks;

  // Iterar por cada máquina
  for (const machineStock of stocksToProcess) {
    for (const product of machineStock.products) {
      const normalizedName = normalizeProductName(product.name);

      if (productMap.has(normalizedName)) {
        const existing = productMap.get(normalizedName)!;
        existing.totalUnitsToReplenish += product.unitsToReplenish;
        existing.machineCount += 1;
        if (product.unitsToReplenish > 0 && !existing.machineNames.includes(machineStock.machineName)) {
          existing.machineNames.push(machineStock.machineName);
        }
      } else {
        productMap.set(normalizedName, {
          productName: product.name, // Mantener formato original
          category: product.category,
          totalUnitsToReplenish: product.unitsToReplenish,
          machineCount: 1,
          machineNames: product.unitsToReplenish > 0 ? [machineStock.machineName] : [],
        });
      }
    }
  }

  // Convertir a array y ordenar por cantidad descendente
  return Array.from(productMap.values())
    .sort((a, b) => b.totalUnitsToReplenish - a.totalUnitsToReplenish);
}

/**
 * Agrupa productos por categoría
 */
export function aggregateByCategory(summaries: StockSummary[]): Record<string, StockSummary[]> {
  const categoryMap: Record<string, StockSummary[]> = {};

  for (const summary of summaries) {
    const category = summary.category || 'Sin categoría';
    if (!categoryMap[category]) {
      categoryMap[category] = [];
    }
    categoryMap[category].push(summary);
  }

  return categoryMap;
}

/**
 * Obtiene estadísticas generales del stock
 */
export function getStockStats(machineStocks: MachineStock[], selectedMachineIds?: string[]) {
  const stocksToProcess = selectedMachineIds
    ? machineStocks.filter((stock) => selectedMachineIds.includes(stock.machineId))
    : machineStocks;

  const totalProducts = stocksToProcess.reduce(
    (sum, stock) => sum + stock.products.length,
    0
  );

  const totalUnitsToReplenish = stocksToProcess.reduce(
    (sum, stock) =>
      sum + stock.products.reduce((s, p) => s + p.unitsToReplenish, 0),
    0
  );

  const totalCapacity = stocksToProcess.reduce(
    (sum, stock) =>
      sum + stock.products.reduce((s, p) => s + p.totalCapacity, 0),
    0
  );

  const totalAvailable = stocksToProcess.reduce(
    (sum, stock) =>
      sum + stock.products.reduce((s, p) => s + p.availableUnits, 0),
    0
  );

  return {
    machineCount: stocksToProcess.length,
    totalProducts,
    totalUnitsToReplenish,
    totalCapacity,
    totalAvailable,
    fillRate: totalCapacity > 0 ? ((totalAvailable / totalCapacity) * 100).toFixed(1) : '0',
  };
}
