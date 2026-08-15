'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Calculator,
  CheckSquare,
  FileText,
  Loader2,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Square,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase-helpers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface MachineRevenue {
  id: string;
  name: string;
  location: string | null;
  source: 'frekuent' | 'televend';
  daily: { total: number; card?: number; cash?: number; updatedAt: string | null };
  monthly: { total: number; card?: number; cash?: number; updatedAt: string | null };
}

interface RevenueData {
  machines: MachineRevenue[];
  totals: { daily: number; monthly: number };
  count: number;
  lastUpdate: string | null;
}

type Period = 'daily' | 'monthly';
type SimpleDocumentMode = 'default' | 'custom';
type InvoiceType = 'A' | 'B';

interface CustomCommissionRow {
  id: string;
  description: string;
  sales: string;
  commission: string;
  amount: string;
}

type CustomPresetKey = 'monster' | 'coffee' | 'water';
type ProductSalesMatchMode = 'product_name' | 'completed';

interface ProductSalesImportResponse {
  success?: boolean;
  range?: { startDate: string; endDate: string };
  groups?: { keyword: string; matchMode?: string; units: number; amount: number; products?: string[] }[];
  matchedMachineIds?: number[];
  debug?: {
    selectedMachines?: unknown[];
    revenueMachineCandidates?: unknown[];
    salesAttempt?: string;
    salesCount?: number;
    sampleSales?: unknown[];
    rawActivityResponses?: unknown[];
    uniqueProductNames?: string[];
  };
  error?: string;
}

interface ProductSalesDebugSnapshot extends ProductSalesImportResponse {
  preset: string;
  keyword: string;
  requestedMachineId: string;
  requestedAt: string;
}

const company = {
  name: 'LIFY VENDING, S.L.',
  cif: 'B-44646214',
  address: 'C/ Rosa, 50-Bjos.',
  city: '07141-Marratxí',
  province: 'Baleares',
  footer: 'LIFY VENDING, S.L. - Inscrita en el R.M. de Palma de Mallorca, Tomo 2990, Folio 157, Hoja 96053',
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(value || 0);
}

function formatDateInput(date: string) {
  if (!date) return '';
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(new Date(`${date}T00:00:00`));
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function createLocalId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function providerLabel(source: MachineRevenue['source']) {
  return source === 'televend' ? 'Televend' : 'Frekuent';
}

function providerClass(source: MachineRevenue['source']) {
  return source === 'televend'
    ? 'border-red-100 bg-red-50 text-red-700'
    : 'border-violet-100 bg-violet-50 text-violet-700';
}

function printTargetDocument(target: 'simple' | 'complete') {
  document.body.dataset.printDocument = target;
  window.setTimeout(() => window.print(), 0);
}

interface ProductSalesRow {
  id: string;
  productName: string;
  soldUnits: number;
  failedUnits: number;
  priceWithVat: number;
  saleWithoutVatFixed: number;
  purchaseWithoutVat: number;
  catalogMatched: boolean;
  highlighted: boolean;
  manualDocumentedUnits?: number;
}

interface MachineCsvInput {
  id: string;
  name: string;
  csvText: string;
  importedRows: ProductSalesRow[];
}

interface AggregatedProductSalesRow extends ProductSalesRow {
  machineUnits: Record<string, number>;
}

interface CompleteAggregatedProductRow extends AggregatedProductSalesRow {
  testUnits: number;
  payableUnits: number;
  difference: number;
  commissionAmount: number;
}

const productPriceCatalog: Record<string, { priceWithVat: number; saleWithoutVat: number; purchaseWithoutVat: number }> = {
  'almendras tostadas': { priceWithVat: 3, saleWithoutVat: 2.48, purchaseWithoutVat: 0.74 },
  agua: { priceWithVat: 2.5, saleWithoutVat: 2.07, purchaseWithoutVat: 0.27 },
  'agua gas': { priceWithVat: 2.3, saleWithoutVat: 1.9, purchaseWithoutVat: 0.44 },
  aquarius: { priceWithVat: 3.75, saleWithoutVat: 3.1, purchaseWithoutVat: 1.01 },
  'bil frutas': { priceWithVat: 3.4, saleWithoutVat: 2.81, purchaseWithoutVat: 0.71 },
  bounty: { priceWithVat: 2.8, saleWithoutVat: 2.31, purchaseWithoutVat: 0.85 },
  caprisun: { priceWithVat: 2.95, saleWithoutVat: 2.44, purchaseWithoutVat: 1.16 },
  'chips ahoy': { priceWithVat: 2.4, saleWithoutVat: 1.98, purchaseWithoutVat: 0.7 },
  chocobom: { priceWithVat: 2.8, saleWithoutVat: 2.31, purchaseWithoutVat: 0.79 },
  'chuches fini': { priceWithVat: 2.4, saleWithoutVat: 1.98, purchaseWithoutVat: 0.59 },
  'cocacola 00': { priceWithVat: 3.75, saleWithoutVat: 3.1, purchaseWithoutVat: 0.68 },
  cocacola: { priceWithVat: 3.75, saleWithoutVat: 3.1, purchaseWithoutVat: 0.92 },
  'cocacola 0': { priceWithVat: 3.75, saleWithoutVat: 3.1, purchaseWithoutVat: 0.92 },
  cocteleo: { priceWithVat: 2.3, saleWithoutVat: 1.9, purchaseWithoutVat: 0.61 },
  'conos 3d': { priceWithVat: 2, saleWithoutVat: 1.65, purchaseWithoutVat: 0.72 },
  crema: { priceWithVat: 7, saleWithoutVat: 5.79, purchaseWithoutVat: 4.92 },
  donetes: { priceWithVat: 3.2, saleWithoutVat: 2.64, purchaseWithoutVat: 1.1 },
  doritos: { priceWithVat: 2, saleWithoutVat: 1.65, purchaseWithoutVat: 0.72 },
  'fanta naranja': { priceWithVat: 3.75, saleWithoutVat: 3.1, purchaseWithoutVat: 0.92 },
  'fanta limon': { priceWithVat: 3.75, saleWithoutVat: 3.1, purchaseWithoutVat: 0.92 },
  'fruit shot': { priceWithVat: 2.9, saleWithoutVat: 2.4, purchaseWithoutVat: 0.72 },
  gofre: { priceWithVat: 2.9, saleWithoutVat: 2.4, purchaseWithoutVat: 1.01 },
  'kinder bueno': { priceWithVat: 2.8, saleWithoutVat: 2.31, purchaseWithoutVat: 0.86 },
  'kinder bueno white': { priceWithVat: 2.8, saleWithoutVat: 2.31, purchaseWithoutVat: 0.86 },
  kitkat: { priceWithVat: 2.4, saleWithoutVat: 1.98, purchaseWithoutVat: 0.58 },
  'kitkat blanco': { priceWithVat: 2.4, saleWithoutVat: 1.98, purchaseWithoutVat: 0.68 },
  cafelatte: { priceWithVat: 3.75, saleWithoutVat: 3.1, purchaseWithoutVat: 0.77 },
  'lays gourmet': { priceWithVat: 2, saleWithoutVat: 1.65, purchaseWithoutVat: 0.72 },
  lyon: { priceWithVat: 2.4, saleWithoutVat: 1.98, purchaseWithoutVat: 0.69 },
  'm&m': { priceWithVat: 2.4, saleWithoutVat: 1.98, purchaseWithoutVat: 0.97 },
  mars: { priceWithVat: 2.7, saleWithoutVat: 2.23, purchaseWithoutVat: 0.81 },
  maiz: { priceWithVat: 2.4, saleWithoutVat: 1.98, purchaseWithoutVat: 0.53 },
  mentos: { priceWithVat: 2.5, saleWithoutVat: 2.07, purchaseWithoutVat: 0.5 },
  monster: { priceWithVat: 3.75, saleWithoutVat: 3.1, purchaseWithoutVat: 0.82 },
  'fresh mojito': { priceWithVat: 3.75, saleWithoutVat: 3.1, purchaseWithoutVat: 0.98 },
  'fuze tea': { priceWithVat: 3.9, saleWithoutVat: 3.22, purchaseWithoutVat: 1.01 },
  'nutella biscuit': { priceWithVat: 2.8, saleWithoutVat: 2.31, purchaseWithoutVat: 0.87 },
  oreo: { priceWithVat: 2.4, saleWithoutVat: 1.98, purchaseWithoutVat: 0.77 },
  'palmeras choco': { priceWithVat: 2.8, saleWithoutVat: 2.31, purchaseWithoutVat: 0.72 },
  'pipas velarte': { priceWithVat: 2.3, saleWithoutVat: 1.9, purchaseWithoutVat: 0.42 },
  pringles: { priceWithVat: 2.9, saleWithoutVat: 2.4, purchaseWithoutVat: 0.84 },
  'pulseras mosquitos': { priceWithVat: 2.2, saleWithoutVat: 1.82, purchaseWithoutVat: 1.89 },
  quelybon: { priceWithVat: 2.7, saleWithoutVat: 2.23, purchaseWithoutVat: 0.89 },
  quelymerienda: { priceWithVat: 2.7, saleWithoutVat: 2.23, purchaseWithoutVat: 0.97 },
  ruffles: { priceWithVat: 2, saleWithoutVat: 1.65, purchaseWithoutVat: 0.72 },
  snickers: { priceWithVat: 2.5, saleWithoutVat: 2.07, purchaseWithoutVat: 0.82 },
  sprite: { priceWithVat: 3.75, saleWithoutVat: 3.1, purchaseWithoutVat: 0.92 },
  'snats lentejas': { priceWithVat: 2, saleWithoutVat: 1.65, purchaseWithoutVat: 0.84 },
  'snats tortitas': { priceWithVat: 2, saleWithoutVat: 1.65, purchaseWithoutVat: 0.93 },
  'tapones oido': { priceWithVat: 2, saleWithoutVat: 1.82, purchaseWithoutVat: 0.7 },
  toblerone: { priceWithVat: 2.8, saleWithoutVat: 2.31, purchaseWithoutVat: 1.21 },
  toke: { priceWithVat: 2.4, saleWithoutVat: 1.98, purchaseWithoutVat: 0.58 },
  twix: { priceWithVat: 2.5, saleWithoutVat: 2.07, purchaseWithoutVat: 0.83 },
};

function normalizeCatalogProduct(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(lata|pet|botella|blanco|negro|jamon)\b/g, ' ')
    .replace(/coca\s*cola/g, 'cocacola')
    .replace(/zero/g, '0')
    .replace(/limon/g, 'limon')
    .replace(/[^a-z0-9&]+/g, ' ')
    .trim();
}

function getProductPricing(productName: string, catalog = productPriceCatalog) {
  const normalized = normalizeCatalogProduct(productName);
  const exact = catalog[normalized];
  if (exact) return { ...exact, matched: true };

  const catalogEntry = Object.entries(catalog)
    .find(([key]) => normalized.includes(key) || key.includes(normalized));

  if (catalogEntry) return { ...catalogEntry[1], matched: true };
  return { priceWithVat: 0, saleWithoutVat: 0, purchaseWithoutVat: 0, matched: false };
}

function parseNumberValue(value: string | undefined) {
  if (!value) return 0;
  const clean = value
    .replace(/\s/g, '')
    .replace(/€/g, '');
  const normalized = clean.includes(',')
    ? clean.replace(/\./g, '').replace(',', '.')
    : clean;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if ((char === ',' || char === ';' || char === '\t') && !quoted) {
      result.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function parseProductSalesCsv(raw: string, catalog = productPriceCatalog): ProductSalesRow[] {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0]).map((item) => item.toLowerCase());
  const findIndex = (patterns: string[]) => header.findIndex((column) => patterns.some((pattern) => column.includes(pattern)));
  const productIndex = findIndex(['producto', 'product', 'caption']);
  const unitsIndex = findIndex(['ventas', 'un. vendidas', 'un vendidas', 'unidades', 'vends', 'quantity']);
  const failedIndex = findIndex(['fallidas', 'error', 'pruebas', 'failed']);

  if (productIndex < 0) return [];

  return lines.slice(1).map((line, index) => {
    const columns = parseCsvLine(line);
    const productName = columns[productIndex] || `Producto ${index + 1}`;
    const soldUnits = parseNumberValue(columns[unitsIndex >= 0 ? unitsIndex : -1]);
    const failedUnits = parseNumberValue(columns[failedIndex >= 0 ? failedIndex : -1]);
    const pricing = getProductPricing(productName, catalog);

    return {
      id: `${productName}-${index}`,
      productName,
      soldUnits,
      failedUnits,
      priceWithVat: pricing.priceWithVat,
      saleWithoutVatFixed: pricing.saleWithoutVat,
      purchaseWithoutVat: pricing.purchaseWithoutVat,
      catalogMatched: pricing.matched,
      highlighted: false,
    };
  }).filter((row) => row.productName && row.productName.toLowerCase() !== 'total');
}

function aggregateMachineCsvs(machineInputs: MachineCsvInput[]): AggregatedProductSalesRow[] {
  const map = new Map<string, AggregatedProductSalesRow>();

  for (const machine of machineInputs) {
    for (const row of machine.importedRows) {
      const key = normalizeCatalogProduct(row.productName);
      const existing = map.get(key);

      if (existing) {
        existing.soldUnits += row.soldUnits;
        existing.failedUnits += row.failedUnits;
        existing.machineUnits[machine.id] = (existing.machineUnits[machine.id] || 0) + row.soldUnits;
        existing.catalogMatched = existing.catalogMatched || row.catalogMatched;
        continue;
      }

      map.set(key, {
        ...row,
        id: key,
        machineUnits: { [machine.id]: row.soldUnits },
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.productName.localeCompare(b.productName, 'es'));
}

export default function RevenueDocumentationPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [machines, setMachines] = useState<MachineRevenue[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState<Period>('monthly');
  const [documentDate, setDocumentDate] = useState(todayInputValue());
  const [clientName, setClientName] = useState('');
  const [clientFiscalDataEnabled, setClientFiscalDataEnabled] = useState(false);
  const [clientFiscalData, setClientFiscalData] = useState('');
  const [concept, setConcept] = useState('Comisión Vending');
  const [commissionPercent, setCommissionPercent] = useState('10');
  const [customBaseEnabled, setCustomBaseEnabled] = useState(false);
  const [manualBaseAmount, setManualBaseAmount] = useState('');
  const [ivaPercent, setIvaPercent] = useState('21');
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [simpleDocumentMode, setSimpleDocumentMode] = useState<SimpleDocumentMode>('default');
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('A');
  const [productExpense, setProductExpense] = useState('');
  const [customRows, setCustomRows] = useState<CustomCommissionRow[]>([
    { id: createLocalId(), description: 'Comisión vending exterior', sales: '', commission: '', amount: '' },
  ]);
  const [loadingProductRows, setLoadingProductRows] = useState(false);
  const [presetMachineIds, setPresetMachineIds] = useState<Record<CustomPresetKey, string>>({
    monster: '',
    coffee: '',
    water: '',
  });
  const [presetUnitCommissions, setPresetUnitCommissions] = useState<Record<CustomPresetKey, string>>({
    monster: '0.50',
    coffee: '0.50',
    water: '0.50',
  });
  const [bottleSalePrice, setBottleSalePrice] = useState('1.20');
  const [lastProductSalesDebug, setLastProductSalesDebug] = useState<ProductSalesDebugSnapshot | null>(null);

  async function loadRevenue(showToast = false) {
    try {
      if (showToast) setRefreshing(true);
      else setLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('Sesión expirada');

      const response = await fetch('/api/admin/revenue', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });
      const payload = await response.json() as RevenueData & { error?: string };

      if (!response.ok) throw new Error(payload.error || 'No se pudieron cargar recaudaciones');

      setMachines(payload.machines || []);
      setLastUpdate(payload.lastUpdate);
      if (showToast) toast.success('Recaudaciones actualizadas');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error cargando recaudaciones';
      toast.error('No se pudo cargar documentación', { description: message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadRevenue();
  }, []);

  const sortedMachines = useMemo(() => (
    [...machines].sort((a, b) => {
      const aTotal = a[period].total || 0;
      const bTotal = b[period].total || 0;
      if (bTotal !== aTotal) return bTotal - aTotal;
      return a.name.localeCompare(b.name, 'es');
    })
  ), [machines, period]);

  const filteredMachines = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return sortedMachines;

    return sortedMachines.filter((machine) => (
      machine.name.toLowerCase().includes(normalizedQuery)
      || machine.location?.toLowerCase().includes(normalizedQuery)
      || providerLabel(machine.source).toLowerCase().includes(normalizedQuery)
    ));
  }, [query, sortedMachines]);

  const selectedMachines = useMemo(
    () => machines.filter((machine) => selectedIds.has(machine.id)),
    [machines, selectedIds],
  );

  const realRevenue = selectedMachines.reduce((sum, machine) => sum + (machine[period].total || 0), 0);
  const selectedMonthlyRevenue = selectedMachines.reduce((sum, machine) => sum + (machine.monthly.total || 0), 0);
  const parsedCommissionPercent = Number(commissionPercent) || 0;
  const parsedManualBase = manualBaseAmount.trim() === '' ? null : Number(manualBaseAmount);
  const parsedIva = Number(ivaPercent) || 0;
  const calculatedCommission = round2(realRevenue * (parsedCommissionPercent / 100));
  const baseAmount = round2(customBaseEnabled && parsedManualBase !== null && Number.isFinite(parsedManualBase) ? parsedManualBase : calculatedCommission);
  const ivaAmount = round2(baseAmount * (parsedIva / 100));
  const totalAmount = round2(baseAmount + ivaAmount);
  const customRowsSubtotal = round2(customRows.reduce((sum, row) => sum + parseNumberValue(row.amount), 0));
  const customIvaAmount = invoiceType === 'A' ? round2(customRowsSubtotal * (parsedIva / 100)) : 0;
  const customTotalAmount = round2(customRowsSubtotal + customIvaAmount);
  const productExpenseAmount = parseNumberValue(productExpense);
  const customBenefit = round2(realRevenue - productExpenseAmount);
  const customBenefitCommission = round2(customBenefit * (parsedCommissionPercent / 100));

  function toggleMachine(machineId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(machineId)) next.delete(machineId);
      else next.add(machineId);
      return next;
    });
  }

  function selectVisible() {
    setSelectedIds(new Set(filteredMachines.map((machine) => machine.id)));
  }

  function printDocument() {
    if (!clientName.trim()) {
      toast.error('Falta el cliente', { description: 'Rellena el nombre del cliente antes de generar el PDF.' });
      return;
    }
    if (simpleDocumentMode === 'custom') {
      if (customRows.length === 0 || customRowsSubtotal <= 0) {
        toast.error('Documento sin importe', { description: 'Añade al menos una fila con importe antes de generar el PDF.' });
        return;
      }
      printTargetDocument('simple');
      return;
    }
    if (baseAmount <= 0) {
      toast.error('Importe no válido', { description: 'Selecciona máquinas o introduce una base imponible manual.' });
      return;
    }
    printTargetDocument('simple');
  }

  function addCustomRow(row?: Partial<CustomCommissionRow>) {
    setCustomRows((current) => [
      ...current,
      {
        id: createLocalId(),
        description: row?.description || '',
        sales: row?.sales || '',
        commission: row?.commission || '',
        amount: row?.amount || '',
      },
    ]);
  }

  function updateCustomRow(rowId: string, patch: Partial<CustomCommissionRow>) {
    setCustomRows((current) => current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }

  function removeCustomRow(rowId: string) {
    setCustomRows((current) => current.filter((row) => row.id !== rowId));
  }

  function applyBenefitRows() {
    const rows: CustomCommissionRow[] = [
      { id: createLocalId(), description: 'RECAUDACIÓN', sales: '', commission: '', amount: String(round2(realRevenue)) },
      { id: createLocalId(), description: 'GASTO EN PRODUCTO', sales: '', commission: '', amount: String(round2(productExpenseAmount)) },
      { id: createLocalId(), description: 'BENEFICIO', sales: '', commission: '', amount: String(customBenefit) },
      { id: createLocalId(), description: 'COMISIÓN', sales: '', commission: `${parsedCommissionPercent}%`, amount: String(customBenefitCommission) },
    ];
    setCustomRows(rows);
    toast.success('Filas de beneficio preparadas');
  }

  async function addPresetCustomRow(preset: CustomPresetKey) {
    const config = {
      monster: { label: 'Comisión Monster', keyword: 'MONSTER', matchMode: 'product_name' as ProductSalesMatchMode },
      coffee: { label: 'Comisión Cafetera', keyword: 'CAFE', matchMode: 'completed' as ProductSalesMatchMode },
      water: { label: 'Botellas de agua', keyword: 'LANJARON', matchMode: 'product_name' as ProductSalesMatchMode },
    }[preset];
    const machineId = presetMachineIds[preset];
    const selectedPresetMachine = machines.find((machine) => machine.id === machineId);
    const unitCommission = parseNumberValue(presetUnitCommissions[preset]);

    if (!machineId) {
      toast.error('Elige una máquina', { description: `Selecciona la máquina para ${config.label}.` });
      return;
    }
    if (unitCommission <= 0) {
      toast.error('Revisa la comisión', { description: 'La comisión por unidad debe ser mayor que cero.' });
      return;
    }

    try {
      setLoadingProductRows(true);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('Sesión expirada');

      const response = await fetch('/api/admin/frekuent-product-sales', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          machineIds: [machineId],
          machineNames: selectedPresetMachine?.name ? [selectedPresetMachine.name] : [],
          keywords: [config.keyword],
          matchModes: [config.matchMode],
        }),
      });
      const payload = await response.json() as ProductSalesImportResponse;
      setLastProductSalesDebug({
        ...payload,
        preset: config.label,
        keyword: config.keyword,
        requestedMachineId: machineId,
        requestedAt: new Date().toISOString(),
      });
      if (!response.ok) throw new Error(payload.error || 'No se pudieron importar ventas por producto');

      const group = payload.groups?.[0];
      const units = group?.units || 0;
      addCustomRow({
        description: config.label,
        sales: String(units),
        commission: formatCurrency(unitCommission),
        amount: String(round2(units * unitCommission)),
      });
      const salesCount = payload.debug?.salesCount ?? 0;
      if (units === 0 && salesCount > 0) {
        toast.warning('Sin coincidencias exactas', {
          description: config.matchMode === 'completed'
            ? `Se leyeron ${salesCount} ventas completadas, pero el resultado fue 0. Revisa el diagnóstico.`
            : `Se leyeron ${salesCount} ventas, pero ninguna contiene ${config.keyword}. Revisa el diagnóstico.`,
        });
      } else {
        toast.success('Fila importada', {
          description: `${units} coincidencias para ${config.keyword}. Ventas leídas: ${salesCount}.`,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudieron importar ventas';
      setLastProductSalesDebug((current) => ({
        ...(current || {
          preset: config.label,
          keyword: config.keyword,
          requestedMachineId: machineId,
          requestedAt: new Date().toISOString(),
        }),
        error: message,
      }));
      toast.error('Error importando productos', { description: message });
    } finally {
      setLoadingProductRows(false);
    }
  }

  function addWaterRevenueRow() {
    if (selectedMachines.length === 0 || selectedMonthlyRevenue <= 0) {
      toast.error('Selecciona máquinas', { description: 'Para calcular botellas necesito máquinas con recaudación mensual seleccionadas.' });
      return;
    }

    const price = parseNumberValue(bottleSalePrice);
    const unitCommission = parseNumberValue(presetUnitCommissions.water);
    if (price <= 0 || unitCommission <= 0) {
      toast.error('Revisa los importes', { description: 'El precio por botella y la comisión por unidad deben ser mayores que cero.' });
      return;
    }

    const units = Math.round(selectedMonthlyRevenue / price);
    addCustomRow({
      description: [
        'Comisión Vending',
        `Recaudación: ${round2(selectedMonthlyRevenue)} Precio Venta: ${formatCurrency(price)}`,
        '----------------',
        `Botellas Vendidas: ${round2(selectedMonthlyRevenue)}/${formatCurrency(price)} = ${units} botellas`,
      ].join('\n'),
      sales: String(units),
      commission: formatCurrency(unitCommission),
      amount: String(round2(units * unitCommission)),
    });
    toast.success('Fila de botellas añadida');
  }

  return (
    <div className="space-y-6 px-3 py-4 print:p-0 sm:px-0 sm:py-0">
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #commission-document,
          #commission-document *,
          #complete-document,
          #complete-document * {
            visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #commission-document,
          #complete-document {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 210mm !important;
            min-height: 297mm !important;
            box-shadow: none !important;
            border: 0 !important;
            overflow: hidden !important;
          }
          body[data-print-document="simple"] #complete-document {
            display: none !important;
          }
          body[data-print-document="complete"] #commission-document {
            display: none !important;
          }
          @page {
            size: A4;
            margin: 0;
          }
        }
      `}</style>

      <section className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/30 to-blue-50/30 p-4 shadow-sm print:hidden sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-emerald-600 p-3 text-white shadow-lg">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-zinc-900 sm:text-3xl">Documentación Recaudaciones</h1>
              <p className="mt-1 max-w-2xl text-sm font-semibold text-zinc-600">
                Generador administrativo para calcular comisiones desde facturación real y preparar el PDF.
              </p>
              {lastUpdate && (
                <p className="mt-2 text-xs font-bold text-emerald-700">
                  Datos actualizados: {new Intl.DateTimeFormat('es-ES', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(new Date(lastUpdate))}
                </p>
              )}
            </div>
          </div>
          <Button
            type="button"
            onClick={() => loadRevenue(true)}
            disabled={refreshing || loading}
            className="h-12 rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-700"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar datos
          </Button>
        </div>
      </section>

      <Tabs defaultValue="simple" className="print:block">
        <TabsList className="grid h-14 w-full grid-cols-2 rounded-2xl bg-zinc-100 p-1 print:hidden">
          <TabsTrigger value="simple" className="rounded-xl text-sm font-black data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm sm:text-base">
            Recaudación simple
          </TabsTrigger>
          <TabsTrigger value="complete" className="rounded-xl text-sm font-black data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm sm:text-base">
            Recaudación completa
          </TabsTrigger>
        </TabsList>

        <TabsContent value="simple" className="mt-5">
      <section className="grid gap-5 print:block xl:grid-cols-[minmax(0,1fr)_29rem]">
        <div className="space-y-5 print:hidden">
          <Card className="border-zinc-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-black text-zinc-900">
                <Calculator className="h-5 w-5 text-emerald-600" />
                Simulación de comisión
              </CardTitle>
              <CardDescription>
                Selecciona máquinas y ajusta el cálculo antes de generar el documento.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <SummaryTile label="Facturación real" value={formatCurrency(realRevenue)} tone="dark" />
                <SummaryTile label={simpleDocumentMode === 'custom' ? 'Documento' : 'Comisión calculada'} value={simpleDocumentMode === 'custom' ? formatCurrency(customRowsSubtotal) : formatCurrency(calculatedCommission)} tone="green" />
                <SummaryTile label={simpleDocumentMode === 'custom' ? 'Total final' : 'Total con IVA'} value={simpleDocumentMode === 'custom' ? formatCurrency(customTotalAmount) : formatCurrency(totalAmount)} tone="dark" />
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                <Label className="mb-2 block text-xs font-black uppercase text-zinc-500">Tipo de documento</Label>
                <ToggleGroup
                  type="single"
                  value={simpleDocumentMode}
                  onValueChange={(value) => value && setSimpleDocumentMode(value as SimpleDocumentMode)}
                  className="grid h-12 grid-cols-2 rounded-xl bg-white p-1"
                >
                  <ToggleGroupItem value="default" className="rounded-lg font-black data-[state=on]:bg-emerald-600 data-[state=on]:text-white">
                    Predeterminado
                  </ToggleGroupItem>
                  <ToggleGroupItem value="custom" className="rounded-lg font-black data-[state=on]:bg-emerald-600 data-[state=on]:text-white">
                    Personalizar documento
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="clientName">Cliente</Label>
                  <Input
                    id="clientName"
                    value={clientName}
                    onChange={(event) => setClientName(event.target.value)}
                    placeholder="Ej. Bendix"
                    className="h-12 rounded-xl font-semibold"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="documentDate">Fecha documento</Label>
                  <Input
                    id="documentDate"
                    type="date"
                    value={documentDate}
                    onChange={(event) => setDocumentDate(event.target.value)}
                    className="h-12 rounded-xl font-semibold"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="concept">Concepto</Label>
                  <Input
                    id="concept"
                    value={concept}
                    onChange={(event) => setConcept(event.target.value)}
                    className="h-12 rounded-xl font-semibold"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Periodo de facturación</Label>
                  <ToggleGroup
                    type="single"
                    value={period}
                    onValueChange={(value) => value && setPeriod(value as Period)}
                    className="grid h-12 grid-cols-2 rounded-xl bg-zinc-100 p-1"
                  >
                    <ToggleGroupItem value="daily" className="rounded-lg font-black data-[state=on]:bg-white data-[state=on]:text-emerald-700">
                      Hoy
                    </ToggleGroupItem>
                    <ToggleGroupItem value="monthly" className="rounded-lg font-black data-[state=on]:bg-white data-[state=on]:text-emerald-700">
                      Este mes
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commissionPercent">% comisión sobre facturación real</Label>
                  <Input
                    id="commissionPercent"
                    type="number"
                    min="0"
                    step="0.01"
                    value={commissionPercent}
                    onChange={(event) => setCommissionPercent(event.target.value)}
                    className="h-12 rounded-xl font-semibold"
                  />
                </div>
                <div className="space-y-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 md:col-span-2">
                  <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div>
                      <Label htmlFor="manualBaseAmount">Base imponible real</Label>
                      <p className="mt-2 text-2xl font-black text-zinc-900">{formatCurrency(calculatedCommission)}</p>
                    </div>
                    <div className={`flex items-center justify-between gap-4 rounded-2xl border bg-white px-4 py-3 transition ${customBaseEnabled ? 'border-emerald-300 shadow-sm shadow-emerald-900/10' : 'border-zinc-200'}`}>
                      <Label htmlFor="customBaseSwitch" className="max-w-40 text-sm font-black leading-tight text-zinc-900">
                        Base Imponible personalizada
                      </Label>
                      <Switch
                        id="customBaseSwitch"
                        checked={customBaseEnabled}
                        onCheckedChange={setCustomBaseEnabled}
                        className="h-7 w-12 border-2 border-zinc-300 data-[state=checked]:border-emerald-600 data-[state=checked]:bg-emerald-600 data-[state=unchecked]:bg-zinc-200"
                      />
                    </div>
                  </div>
                  {customBaseEnabled && (
                    <div className="space-y-2">
                      <Label htmlFor="manualBaseAmount">Cantidad personalizada</Label>
                      <Input
                        id="manualBaseAmount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={manualBaseAmount}
                        onChange={(event) => setManualBaseAmount(event.target.value)}
                        placeholder={String(calculatedCommission)}
                        className="h-12 rounded-xl bg-white text-lg font-black"
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ivaPercent">IVA %</Label>
                  <Input
                    id="ivaPercent"
                    type="number"
                    min="0"
                    step="0.01"
                    value={ivaPercent}
                    onChange={(event) => setIvaPercent(event.target.value)}
                    className="h-12 rounded-xl font-semibold"
                  />
                </div>
                <div className="space-y-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 md:col-span-2">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <Label htmlFor="clientFiscalData">Datos del cliente</Label>
                      <p className="mt-1 text-xs font-semibold text-zinc-500">Razón social, CIF, dirección u otra información adicional.</p>
                    </div>
                    <div className={`flex items-center justify-between gap-4 rounded-2xl border bg-white px-4 py-3 transition sm:min-w-72 ${clientFiscalDataEnabled ? 'border-emerald-300 shadow-sm shadow-emerald-900/10' : 'border-zinc-200'}`}>
                      <Label htmlFor="clientFiscalDataSwitch" className="text-sm font-black leading-tight text-zinc-900">
                        Añadir datos del cliente
                      </Label>
                      <Switch
                        id="clientFiscalDataSwitch"
                        checked={clientFiscalDataEnabled}
                        onCheckedChange={setClientFiscalDataEnabled}
                        className="h-7 w-12 border-2 border-zinc-300 data-[state=checked]:border-emerald-600 data-[state=checked]:bg-emerald-600 data-[state=unchecked]:bg-zinc-200"
                      />
                    </div>
                  </div>
                  {clientFiscalDataEnabled && (
                    <Textarea
                      id="clientFiscalData"
                      value={clientFiscalData}
                      onChange={(event) => setClientFiscalData(event.target.value)}
                      placeholder="Razón social, CIF, dirección..."
                      className="min-h-24 rounded-xl bg-white font-semibold"
                    />
                  )}
                </div>
              </div>

              {simpleDocumentMode === 'custom' && (
                <div className="space-y-4 rounded-3xl border border-emerald-100 bg-emerald-50/40 p-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                    <div>
                      <h3 className="text-lg font-black text-zinc-900">Documento personalizado</h3>
                      <p className="mt-1 text-sm font-semibold text-zinc-600">
                        Añade, quita y edita filas. Los importes del PDF saldrán exactamente de esta tabla.
                      </p>
                    </div>
                    <ToggleGroup
                      type="single"
                      value={invoiceType}
                      onValueChange={(value) => value && setInvoiceType(value as InvoiceType)}
                      className="grid h-11 min-w-52 grid-cols-2 rounded-xl bg-white p-1"
                    >
                      <ToggleGroupItem value="A" className="rounded-lg font-black data-[state=on]:bg-zinc-950 data-[state=on]:text-white">
                        Factura A
                      </ToggleGroupItem>
                      <ToggleGroupItem value="B" className="rounded-lg font-black data-[state=on]:bg-zinc-950 data-[state=on]:text-white">
                        Factura B
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Gasto en producto</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={productExpense}
                        onChange={(event) => setProductExpense(event.target.value)}
                        placeholder="0"
                        className="h-12 rounded-xl bg-white font-black"
                      />
                    </div>
                    <SummaryTile label="Beneficio" value={formatCurrency(customBenefit)} tone="dark" />
                    <SummaryTile label={`Comisión ${parsedCommissionPercent}%`} value={formatCurrency(customBenefitCommission)} tone="green" />
                  </div>

                  <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-3">
                    <Label className="text-xs font-black uppercase text-zinc-500">Items añadibles</Label>
                    <div className="grid gap-3 xl:grid-cols-3">
                      <PresetProductCard
                        title="Monster"
                        helper="Busca productos que contengan MONSTER"
                        machineId={presetMachineIds.monster}
                        commission={presetUnitCommissions.monster}
                        machines={machines.filter((machine) => machine.source === 'frekuent')}
                        loading={loadingProductRows}
                        onMachineChange={(value) => setPresetMachineIds((current) => ({ ...current, monster: value }))}
                        onCommissionChange={(value) => setPresetUnitCommissions((current) => ({ ...current, monster: value }))}
                        onAdd={() => addPresetCustomRow('monster')}
                      />
                      <PresetProductCard
                        title="Café"
                        helper="Busca productos que contengan CAFE"
                        machineId={presetMachineIds.coffee}
                        commission={presetUnitCommissions.coffee}
                        machines={machines.filter((machine) => machine.source === 'frekuent')}
                        loading={loadingProductRows}
                        onMachineChange={(value) => setPresetMachineIds((current) => ({ ...current, coffee: value }))}
                        onCommissionChange={(value) => setPresetUnitCommissions((current) => ({ ...current, coffee: value }))}
                        onAdd={() => addPresetCustomRow('coffee')}
                      />
                      <PresetProductCard
                        title="Botellas de agua"
                        helper="Busca productos que contengan LANJARON"
                        machineId={presetMachineIds.water}
                        commission={presetUnitCommissions.water}
                        machines={machines.filter((machine) => machine.source === 'frekuent')}
                        loading={loadingProductRows}
                        onMachineChange={(value) => setPresetMachineIds((current) => ({ ...current, water: value }))}
                        onCommissionChange={(value) => setPresetUnitCommissions((current) => ({ ...current, water: value }))}
                        onAdd={() => addPresetCustomRow('water')}
                      />
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                      <div className="grid gap-2 md:grid-cols-3">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-black uppercase text-zinc-500">Recaudación mensual seleccionada</Label>
                          <div className="flex h-11 items-center rounded-xl border border-zinc-200 bg-white px-3 text-sm font-black text-zinc-900">
                            {formatCurrency(selectedMonthlyRevenue)}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-black uppercase text-zinc-500">Precio botella</Label>
                          <Input type="number" step="0.01" value={bottleSalePrice} onChange={(event) => setBottleSalePrice(event.target.value)} className="h-11 rounded-xl bg-white font-black" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-black uppercase text-zinc-500">Comisión unidad</Label>
                          <Input type="number" step="0.01" value={presetUnitCommissions.water} onChange={(event) => setPresetUnitCommissions((current) => ({ ...current, water: event.target.value }))} className="h-11 rounded-xl bg-white font-black" />
                        </div>
                      </div>
                      <Button type="button" variant="outline" onClick={addWaterRevenueRow} className="mt-3 h-11 w-full rounded-xl bg-white font-black">
                        <Plus className="mr-2 h-4 w-4" />
                        Añadir botellas por recaudación
                      </Button>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button type="button" variant="outline" onClick={() => addCustomRow()} className="h-11 rounded-xl bg-white font-black">
                        <Plus className="mr-2 h-4 w-4" />
                        Añadir fila manual
                      </Button>
                      <Button type="button" variant="outline" onClick={applyBenefitRows} className="h-11 rounded-xl bg-white font-black">
                        Aplicar beneficio
                      </Button>
                    </div>

                    {lastProductSalesDebug && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-left">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-black uppercase text-amber-700">Diagnóstico última búsqueda</p>
                            <p className="mt-1 text-sm font-bold text-zinc-900">
                              {lastProductSalesDebug.preset} · palabra buscada: {lastProductSalesDebug.keyword}
                            </p>
                          </div>
                          <Badge className="rounded-full bg-white text-zinc-800">
                            {lastProductSalesDebug.debug?.salesCount ?? 0} ventas leídas
                          </Badge>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs font-bold text-zinc-700 sm:grid-cols-3">
                          <div className="rounded-xl bg-white p-2">
                            <span className="block text-[10px] uppercase text-zinc-500">IDs emparejados</span>
                            {(lastProductSalesDebug.matchedMachineIds || []).join(', ') || 'Ninguno'}
                          </div>
                          <div className="rounded-xl bg-white p-2">
                            <span className="block text-[10px] uppercase text-zinc-500">Modo de fecha</span>
                            {lastProductSalesDebug.debug?.salesAttempt || 'Sin datos'}
                          </div>
                          <div className="rounded-xl bg-white p-2">
                            <span className="block text-[10px] uppercase text-zinc-500">Coincidencias</span>
                            {(lastProductSalesDebug.groups || []).map((group) => `${group.keyword}: ${group.units}`).join(' · ') || '0'}
                          </div>
                        </div>
                        <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-zinc-950 p-3 text-[11px] leading-relaxed text-zinc-100">
                          {JSON.stringify(lastProductSalesDebug, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    {customRows.map((row) => (
                      <div key={row.id} className="grid gap-2 rounded-2xl border border-zinc-200 bg-white p-3 lg:grid-cols-[1fr_7rem_7rem_8rem_auto] lg:items-end">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-black uppercase text-zinc-500">Descripción</Label>
                          <Input
                            value={row.description}
                            onChange={(event) => updateCustomRow(row.id, { description: event.target.value })}
                            placeholder="Concepto"
                            className="h-11 rounded-xl font-semibold"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-black uppercase text-zinc-500">Ventas</Label>
                          <Input
                            value={row.sales}
                            onChange={(event) => updateCustomRow(row.id, { sales: event.target.value })}
                            placeholder="-"
                            className="h-11 rounded-xl font-semibold"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-black uppercase text-zinc-500">Comisión</Label>
                          <Input
                            value={row.commission}
                            onChange={(event) => updateCustomRow(row.id, { commission: event.target.value })}
                            placeholder="-"
                            className="h-11 rounded-xl font-semibold"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-black uppercase text-zinc-500">Importe</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={row.amount}
                            onChange={(event) => updateCustomRow(row.id, { amount: event.target.value })}
                            placeholder="0"
                            className="h-11 rounded-xl font-black"
                          />
                        </div>
                        <Button type="button" variant="outline" size="icon" onClick={() => removeCustomRow(row.id)} className="h-11 w-11 rounded-xl border-red-100 text-red-600 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-zinc-200 bg-white shadow-sm">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-xl font-black text-zinc-900">Máquinas</CardTitle>
                  <CardDescription>Selecciona las máquinas que componen esta documentación.</CardDescription>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <Button type="button" variant="outline" className="h-11 rounded-xl font-black" onClick={selectVisible}>
                    Seleccionar vista
                  </Button>
                  <Button type="button" variant="outline" className="h-11 rounded-xl font-black" onClick={() => setSelectedIds(new Set())}>
                    Limpiar
                  </Button>
                </div>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar máquina, ubicación o fuente..."
                  className="h-12 rounded-xl border-emerald-100 pl-10 font-semibold focus-visible:ring-emerald-400"
                />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-24 rounded-2xl" />)}
                </div>
              ) : filteredMachines.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center font-semibold text-zinc-500">
                  No hay máquinas para este filtro.
                </div>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {filteredMachines.map((machine) => {
                    const selected = selectedIds.has(machine.id);
                    const amount = machine[period].total || 0;

                    return (
                      <button
                        key={machine.id}
                        type="button"
                        onClick={() => toggleMachine(machine.id)}
                        className={`w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition ${selected ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-zinc-200 hover:border-emerald-200'}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-1 shrink-0 text-emerald-600">
                            {selected ? <CheckSquare className="h-6 w-6" /> : <Square className="h-6 w-6" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className={providerClass(machine.source)}>
                                {providerLabel(machine.source)}
                              </Badge>
                              <Badge variant="outline">{period === 'monthly' ? 'Este mes' : 'Hoy'}</Badge>
                            </div>
                            <h3 className="break-words text-base font-black leading-tight text-zinc-900">{machine.name}</h3>
                            <p className="mt-1 break-words text-sm font-semibold text-zinc-500">{machine.location || 'Sin ubicación'}</p>
                            <p className="mt-3 text-2xl font-black text-emerald-700">{formatCurrency(amount)}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:h-fit">
          <Card className="border-zinc-200 bg-white shadow-sm print:hidden">
            <CardHeader>
              <CardTitle className="text-xl font-black text-zinc-900">Resumen previo</CardTitle>
              <CardDescription>Comprueba importes antes de generar el PDF.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <SummaryLine label="Modo" value={simpleDocumentMode === 'custom' ? 'Personalizado' : 'Predeterminado'} />
              <SummaryLine label="Máquinas seleccionadas" value={String(selectedMachines.length)} />
              <SummaryLine label="Facturación real" value={formatCurrency(realRevenue)} />
              {simpleDocumentMode === 'custom' ? (
                <>
                  <SummaryLine label="Subtotal filas" value={formatCurrency(customRowsSubtotal)} strong />
                  <SummaryLine label={invoiceType === 'A' ? `IVA ${parsedIva}%` : 'IVA'} value={invoiceType === 'A' ? formatCurrency(customIvaAmount) : 'No aplica'} />
                </>
              ) : (
                <>
                  <SummaryLine label={`Comisión ${parsedCommissionPercent}%`} value={formatCurrency(calculatedCommission)} />
                  <SummaryLine label="Base imponible PDF" value={formatCurrency(baseAmount)} strong />
                  <SummaryLine label={`IVA ${parsedIva}%`} value={formatCurrency(ivaAmount)} />
                </>
              )}
              <div className="rounded-2xl bg-zinc-950 p-4 text-white">
                <p className="text-xs font-black uppercase text-zinc-300">Total documento</p>
                <p className="mt-1 text-3xl font-black">{formatCurrency(simpleDocumentMode === 'custom' ? customTotalAmount : totalAmount)}</p>
              </div>
              <Button type="button" onClick={printDocument} className="h-12 w-full rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-700">
                <Printer className="mr-2 h-4 w-4" />
                Generar PDF
              </Button>
            </CardContent>
          </Card>

          {simpleDocumentMode === 'custom' ? (
            <CustomCommissionDocument
              clientName={clientName}
              documentDate={documentDate}
              rows={customRows}
              invoiceType={invoiceType}
              ivaPercent={parsedIva}
              ivaAmount={customIvaAmount}
              totalAmount={customTotalAmount}
            />
          ) : (
            <CommissionDocument
              clientName={clientName}
              clientFiscalData={clientFiscalData}
              concept={concept}
              documentDate={documentDate}
              showClientFiscalData={clientFiscalDataEnabled}
              baseAmount={baseAmount}
              ivaPercent={parsedIva}
              ivaAmount={ivaAmount}
              totalAmount={totalAmount}
              selectedMachines={selectedMachines}
              realRevenue={realRevenue}
              period={period}
            />
          )}
        </aside>
      </section>
        </TabsContent>

        <TabsContent value="complete" className="mt-5">
          <CompleteRevenueDocumentation
            machines={machines.filter((machine) => machine.source === 'televend')}
            loading={loading}
            defaultDate={documentDate}
          />
        </TabsContent>
      </Tabs>

      {refreshing && (
        <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-zinc-950 px-4 py-3 text-sm font-bold text-white shadow-xl print:hidden">
          <Loader2 className="h-4 w-4 animate-spin" />
          Actualizando datos
        </div>
      )}
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: string; tone: 'dark' | 'green' }) {
  return (
    <div className={`rounded-2xl border p-4 ${tone === 'green' ? 'border-emerald-100 bg-emerald-50' : 'border-zinc-200 bg-zinc-50'}`}>
      <p className={`text-xs font-black uppercase ${tone === 'green' ? 'text-emerald-700' : 'text-zinc-500'}`}>{label}</p>
      <p className={`mt-2 text-2xl font-black ${tone === 'green' ? 'text-emerald-700' : 'text-zinc-900'}`}>{value}</p>
    </div>
  );
}

function SummaryLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-zinc-50 px-3 py-2">
      <span className="text-sm font-bold text-zinc-600">{label}</span>
      <span className={`text-right font-black ${strong ? 'text-emerald-700' : 'text-zinc-900'}`}>{value}</span>
    </div>
  );
}

function PresetProductCard({
  title,
  helper,
  machineId,
  commission,
  machines,
  loading,
  onMachineChange,
  onCommissionChange,
  onAdd,
}: {
  title: string;
  helper: string;
  machineId: string;
  commission: string;
  machines: MachineRevenue[];
  loading: boolean;
  onMachineChange: (value: string) => void;
  onCommissionChange: (value: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
      <div>
        <p className="text-base font-black text-zinc-900">{title}</p>
        <p className="mt-1 text-xs font-bold text-zinc-500">{helper}</p>
      </div>
      <div className="space-y-1">
        <Label className="text-[10px] font-black uppercase text-zinc-500">Máquina</Label>
        <select
          value={machineId}
          onChange={(event) => onMachineChange(event.target.value)}
          className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-bold outline-none focus:border-emerald-400"
        >
          <option value="">Elegir máquina</option>
          {machines.map((machine) => (
            <option key={machine.id} value={machine.id}>{machine.name}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label className="text-[10px] font-black uppercase text-zinc-500">Comisión unidad</Label>
        <Input
          type="number"
          step="0.01"
          value={commission}
          onChange={(event) => onCommissionChange(event.target.value)}
          className="h-11 rounded-xl bg-white font-black"
        />
      </div>
      <Button type="button" variant="outline" onClick={onAdd} disabled={loading} className="h-11 w-full rounded-xl bg-white font-black">
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
        Añadir {title}
      </Button>
    </div>
  );
}

function PriceEditorInput({
  value,
  onValueChange,
}: {
  value: number;
  onValueChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(Number.isFinite(value) ? String(value) : '0');

  useEffect(() => {
    setDraft(Number.isFinite(value) ? String(value) : '0');
  }, [value]);

  function handleChange(nextValue: string) {
    setDraft(nextValue);
    if (nextValue.trim() === '') return;

    const parsed = parseNumberValue(nextValue);
    if (Number.isFinite(parsed)) {
      onValueChange(nextValue);
    }
  }

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={draft}
      onChange={(event) => handleChange(event.target.value)}
      className="h-10 rounded-xl font-black"
    />
  );
}

function CommissionDocument({
  clientName,
  clientFiscalData,
  concept,
  documentDate,
  showClientFiscalData,
  baseAmount,
  ivaPercent,
  ivaAmount,
  totalAmount,
  selectedMachines,
  realRevenue,
  period,
}: {
  clientName: string;
  clientFiscalData: string;
  concept: string;
  documentDate: string;
  showClientFiscalData: boolean;
  baseAmount: number;
  ivaPercent: number;
  ivaAmount: number;
  totalAmount: number;
  selectedMachines: MachineRevenue[];
  realRevenue: number;
  period: Period;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
      <div className="border-b border-zinc-100 p-4 print:hidden">
        <p className="text-sm font-black uppercase text-zinc-500">Vista previa PDF</p>
      </div>

      <article id="commission-document" className="relative mx-auto min-h-[720px] w-full max-w-[794px] overflow-hidden bg-white px-8 py-12 text-zinc-950 print:min-h-[297mm] print:w-[210mm] print:max-w-none print:px-[19mm] print:py-[22mm] sm:px-14">
        <div className="absolute left-0 right-0 top-0 h-2 bg-emerald-500" />
        <header className="grid grid-cols-1 gap-8 sm:grid-cols-[1fr_1.2fr]">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5 text-sm font-semibold leading-7">
            <p className="font-black tracking-wide">{company.name}</p>
            <p className="font-black">CIF: {company.cif}</p>
            <p className="mt-4 text-zinc-600">{company.address}</p>
            <p>{company.city}</p>
            <p>{company.province}</p>
          </div>

          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-600">Documento</p>
            <h2 className="mt-2 text-6xl font-black tracking-tight text-zinc-900 print:text-6xl">Comisión</h2>
            <div className="mt-6 flex justify-center">
              <Image src="/logo.png" alt="Lify Vending" width={210} height={120} className="h-auto w-44 object-contain" />
            </div>
            <div className="mx-auto mt-8 inline-flex items-center gap-8 rounded-full border border-zinc-200 bg-white px-5 py-3 text-sm shadow-sm">
              <span className="font-black">FECHA:</span>
              <span className="font-semibold">{formatDateInput(documentDate) || '-'}</span>
            </div>
          </div>
        </header>

        <section className="mx-auto mt-14 max-w-xl rounded-2xl border border-emerald-100 bg-emerald-50/60 px-6 py-5 text-center">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-700">Cliente</p>
          <p className="mt-2 text-xl font-black text-zinc-900">{clientName || 'Nombre del cliente'}</p>
          {showClientFiscalData && clientFiscalData.trim() && (
            <div className="mx-auto mt-3 max-w-md whitespace-pre-line text-sm font-semibold leading-6 text-zinc-600">
              {clientFiscalData}
            </div>
          )}
        </section>

        <section className="mt-12">
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-lg shadow-zinc-950/5">
            <div className="grid grid-cols-[1fr_9rem] text-sm">
              <div className="bg-zinc-950 px-5 py-4 text-center font-black uppercase tracking-wide text-white">
                Descripción
              </div>
              <div className="bg-zinc-950 px-5 py-4 text-center font-black uppercase tracking-wide text-white">
                Importe
              </div>

              <div className="border-b border-zinc-200 bg-white px-5 py-5 font-semibold text-zinc-800">
                {concept || 'Comisión Vending'}
              </div>
              <div className="border-b border-zinc-200 bg-white px-5 py-5 text-right font-black text-zinc-900">
                {formatCurrency(baseAmount)}
              </div>

              <div className="border-b border-zinc-100 bg-zinc-50 px-5 py-3 text-right text-xs font-black uppercase tracking-wide text-zinc-600">
                Base imponible
              </div>
              <div className="border-b border-zinc-100 bg-zinc-50 px-5 py-3 text-right font-black text-zinc-900">
                {formatCurrency(baseAmount)}
              </div>

              <div className="border-b border-zinc-100 bg-zinc-50 px-5 py-3 text-right text-xs font-black uppercase tracking-wide text-zinc-600">
                IVA {ivaPercent}%
              </div>
              <div className="border-b border-zinc-100 bg-zinc-50 px-5 py-3 text-right font-black text-zinc-900">
                {formatCurrency(ivaAmount)}
              </div>

              <div className="bg-emerald-700 px-5 py-4 text-right text-sm font-black uppercase tracking-wide text-white">
                Total
              </div>
              <div className="bg-emerald-700 px-5 py-4 text-right text-lg font-black text-white">
                {formatCurrency(totalAmount)}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-200 p-4 print:hidden">
          <div className="flex items-center gap-2 text-sm font-black text-zinc-900">
            <Building2 className="h-4 w-4 text-emerald-600" />
            Simulación interna
          </div>
          <div className="mt-3 grid gap-2 text-sm font-semibold text-zinc-600">
            <div className="flex justify-between gap-3">
              <span>Facturación real seleccionada</span>
              <span className="font-black text-zinc-900">{formatCurrency(realRevenue)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Máquinas</span>
              <span className="font-black text-zinc-900">{selectedMachines.length}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Periodo</span>
              <span className="font-black text-zinc-900">{period === 'monthly' ? 'Este mes' : 'Hoy'}</span>
            </div>
          </div>
        </section>

        <footer className="absolute bottom-14 left-8 right-8 text-center text-sm font-black print:bottom-[26mm] print:left-[20mm] print:right-[20mm]">
          {company.footer}
        </footer>
      </article>
    </div>
  );
}

function CustomCommissionDocument({
  clientName,
  documentDate,
  rows,
  invoiceType,
  ivaPercent,
  ivaAmount,
  totalAmount,
}: {
  clientName: string;
  documentDate: string;
  rows: CustomCommissionRow[];
  invoiceType: InvoiceType;
  ivaPercent: number;
  ivaAmount: number;
  totalAmount: number;
}) {
  const subtotal = round2(rows.reduce((sum, row) => sum + parseNumberValue(row.amount), 0));

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
      <div className="border-b border-zinc-100 p-4 print:hidden">
        <p className="text-sm font-black uppercase text-zinc-500">Vista previa PDF personalizado</p>
      </div>

      <article id="commission-document" className="relative mx-auto min-h-[720px] w-full max-w-[794px] overflow-hidden bg-white px-6 py-10 text-zinc-950 print:min-h-[297mm] print:w-[210mm] print:max-w-none print:px-[16mm] print:py-[18mm] sm:px-12">
        <header className="grid grid-cols-[1fr_auto] items-start gap-6">
          <div className="text-sm font-semibold leading-6">
            <p className="font-black">{company.name}</p>
            <p className="font-black">CIF: {company.cif}</p>
            <p className="mt-3 text-zinc-600">{company.address}</p>
            <p>{company.city}</p>
            <p>{company.province}</p>
          </div>
          <div className="text-right">
            <Image src="/logo.png" alt="Lify Vending" width={190} height={110} className="ml-auto h-auto w-40 object-contain" />
            <div className="mt-8 flex items-center justify-end gap-6 text-sm">
              <span className="font-black">FECHA:</span>
              <span className="font-semibold">{formatDateInput(documentDate) || '-'}</span>
            </div>
            <Badge variant="outline" className="mt-4 border-zinc-300 bg-white font-black text-zinc-700">
              Factura {invoiceType}
            </Badge>
          </div>
        </header>

        <section className="mt-16 text-center">
          <p className="text-lg font-black">Cliente: {clientName || 'Nombre del cliente'}</p>
        </section>

        <section className="mt-12 overflow-hidden border border-zinc-200">
          <div className="grid grid-cols-[1fr_7rem_7rem_8rem] border-b-4 border-white text-sm font-black uppercase">
            <div className="bg-cyan-100 px-4 py-4 text-center">Descripción</div>
            <div className="bg-zinc-900 px-3 py-4 text-center text-white">Ventas</div>
            <div className="bg-zinc-900 px-3 py-4 text-center text-white">Comisión</div>
            <div className="bg-zinc-900 px-3 py-4 text-center text-white">Importe</div>
          </div>

          <div className="grid grid-cols-[1fr_7rem_7rem_8rem] bg-zinc-100 text-sm">
            {rows.map((row) => (
              <div key={row.id} className="contents">
                <div className="border-b border-white px-4 py-4 text-base font-semibold">
                  {row.description || '-'}
                </div>
                <div className="border-b border-white bg-zinc-400 px-3 py-4 text-center text-base font-semibold text-white">
                  {row.sales || '-'}
                </div>
                <div className="border-b border-white bg-zinc-400 px-3 py-4 text-center text-base font-semibold text-white">
                  {row.commission || '-'}
                </div>
                <div className="border-b border-white bg-zinc-400 px-3 py-4 text-right text-base font-semibold text-white">
                  {formatCurrency(parseNumberValue(row.amount))}
                </div>
              </div>
            ))}

            {invoiceType === 'A' && (
              <>
                <div className="border-b border-white bg-zinc-200 px-4 py-3 text-right text-sm font-black uppercase">Base imponible</div>
                <div className="border-b border-white bg-zinc-300 px-3 py-3" />
                <div className="border-b border-white bg-zinc-300 px-3 py-3" />
                <div className="border-b border-white bg-zinc-300 px-3 py-3 text-right font-black">{formatCurrency(subtotal)}</div>
                <div className="border-b border-white bg-zinc-200 px-4 py-3 text-right text-sm font-black uppercase">IVA {ivaPercent}%</div>
                <div className="border-b border-white bg-zinc-300 px-3 py-3" />
                <div className="border-b border-white bg-zinc-300 px-3 py-3" />
                <div className="border-b border-white bg-zinc-300 px-3 py-3 text-right font-black">{formatCurrency(ivaAmount)}</div>
              </>
            )}

            <div className="bg-[#9bbb59] px-4 py-4 text-right text-lg font-black uppercase">Total</div>
            <div className="bg-zinc-100 px-3 py-4" />
            <div className="bg-zinc-100 px-3 py-4" />
            <div className="bg-zinc-100 px-3 py-4 text-right text-lg font-black">{formatCurrency(totalAmount)}</div>
          </div>
        </section>

        <footer className="absolute bottom-14 left-8 right-8 text-center text-sm font-black print:bottom-[22mm] print:left-[16mm] print:right-[16mm]">
          {company.footer}
        </footer>
      </article>
    </div>
  );
}

function CompleteRevenueDocumentation({
  machines,
  loading,
  defaultDate,
}: {
  machines: MachineRevenue[];
  loading: boolean;
  defaultDate: string;
}) {
  const [clientName, setClientName] = useState('');
  const [documentDate, setDocumentDate] = useState(defaultDate);
  const [commissionPercent, setCommissionPercent] = useState('50');
  const [ivaPercent, setIvaPercent] = useState('21');
  const [machineInputs, setMachineInputs] = useState<MachineCsvInput[]>([
    { id: createLocalId(), name: '', csvText: '', importedRows: [] },
  ]);
  const [testUnitsByProduct, setTestUnitsByProduct] = useState<Record<string, number | undefined>>({});
  const [highlightedProducts, setHighlightedProducts] = useState<Set<string>>(new Set());
  const [hiddenProducts, setHiddenProducts] = useState<Set<string>>(new Set());
  const [priceEditorOpen, setPriceEditorOpen] = useState(false);
  const [priceSearch, setPriceSearch] = useState('');
  const [editableCatalog, setEditableCatalog] = useState(productPriceCatalog);

  const parsedCommission = Number(commissionPercent) || 0;
  const parsedIva = Number(ivaPercent) || 0;
  const rows = useMemo(() => aggregateMachineCsvs(machineInputs), [machineInputs]);

  const calculatedRows = useMemo<CompleteAggregatedProductRow[]>(() => rows.map((row) => {
    const testUnits = Math.min(row.soldUnits, Math.max(0, testUnitsByProduct[row.id] ?? row.failedUnits ?? 0));
    const payableUnits = Math.max(0, row.soldUnits - testUnits);
    const difference = round2(row.saleWithoutVatFixed - row.purchaseWithoutVat);
    const commissionAmount = round2(Math.max(0, difference) * payableUnits * (parsedCommission / 100));

    return {
      ...row,
      highlighted: highlightedProducts.has(row.id),
      testUnits,
      payableUnits,
      difference,
      commissionAmount,
    };
  }), [rows, testUnitsByProduct, highlightedProducts, parsedCommission]);

  const visibleRows = useMemo(() => calculatedRows.filter((row) => !hiddenProducts.has(row.id)), [calculatedRows, hiddenProducts]);
  const totals = visibleRows.reduce((acc, row) => ({
    soldUnits: acc.soldUnits + row.soldUnits,
    testUnits: acc.testUnits + row.testUnits,
    payableUnits: acc.payableUnits + row.payableUnits,
    commission: acc.commission + row.commissionAmount,
  }), { soldUnits: 0, testUnits: 0, payableUnits: 0, commission: 0 });
  const completeBaseAmount = round2(totals.commission / (1 + (parsedIva / 100)));
  const ivaAmount = round2(totals.commission - completeBaseAmount);
  const totalWithIva = round2(totals.commission);
  const missingPriceRows = visibleRows.filter((row) => !row.catalogMatched || row.priceWithVat <= 0 || row.saleWithoutVatFixed <= 0 || row.purchaseWithoutVat <= 0);
  const filteredCatalogEntries = useMemo(() => {
    const q = normalizeCatalogProduct(priceSearch);
    return Object.entries(editableCatalog)
      .filter(([key]) => !q || key.includes(q))
      .sort(([a], [b]) => a.localeCompare(b, 'es'));
  }, [editableCatalog, priceSearch]);

  function addMachineInput() {
    setMachineInputs((current) => [
      ...current,
      { id: createLocalId(), name: '', csvText: '', importedRows: [] },
    ]);
  }

  function updateMachineInput(machineId: string, patch: Partial<MachineCsvInput>) {
    setMachineInputs((current) => current.map((machine) => (
      machine.id === machineId ? { ...machine, ...patch } : machine
    )));
  }

  function removeMachineInput(machineId: string) {
    setMachineInputs((current) => current.filter((machine) => machine.id !== machineId));
  }

  function importMachineCsv(machineId: string) {
    const machine = machineInputs.find((item) => item.id === machineId);
    if (!machine) return;
    const parsed = parseProductSalesCsv(machine.csvText, editableCatalog);
    if (parsed.length === 0) {
      toast.error('CSV no reconocido', { description: 'Pásame un CSV con columnas de producto y unidades vendidas.' });
      return;
    }
    updateMachineInput(machineId, { importedRows: parsed });
    toast.success('CSV importado', { description: `${parsed.length} productos cargados para ${machine.name || 'la máquina'}.` });
  }

  async function loadCsvFile(machineId: string, file: File | null) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Archivo no válido', { description: 'Selecciona un archivo CSV.' });
      return;
    }

    try {
      const text = await file.text();
      const parsed = parseProductSalesCsv(text, editableCatalog);
      if (parsed.length === 0) {
        toast.error('CSV no reconocido', { description: 'No he encontrado columnas de producto y ventas.' });
        updateMachineInput(machineId, { csvText: text, importedRows: [] });
        return;
      }

      updateMachineInput(machineId, { csvText: text, importedRows: parsed });
      const machine = machineInputs.find((item) => item.id === machineId);
      toast.success('CSV cargado', { description: `${parsed.length} productos importados para ${machine?.name || 'la máquina'}.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo leer el archivo';
      toast.error('Error leyendo CSV', { description: message });
    }
  }

  function updateTestUnits(rowId: string, value: string) {
    const parsed = value.trim() === '' ? undefined : Math.max(0, Number(value) || 0);
    setTestUnitsByProduct((current) => ({ ...current, [rowId]: parsed }));
  }

  function updateCompleteProductPrice(
    rowId: string,
    field: 'priceWithVat' | 'saleWithoutVatFixed' | 'purchaseWithoutVat',
    value: string,
  ) {
    const parsed = parseNumberValue(value);
    const currentRow = calculatedRows.find((row) => row.id === rowId);

    setEditableCatalog((current) => ({
      ...current,
      [rowId]: {
        priceWithVat: field === 'priceWithVat' ? parsed : current[rowId]?.priceWithVat ?? currentRow?.priceWithVat ?? 0,
        saleWithoutVat: field === 'saleWithoutVatFixed' ? parsed : current[rowId]?.saleWithoutVat ?? currentRow?.saleWithoutVatFixed ?? 0,
        purchaseWithoutVat: field === 'purchaseWithoutVat' ? parsed : current[rowId]?.purchaseWithoutVat ?? currentRow?.purchaseWithoutVat ?? 0,
      },
    }));

    setMachineInputs((current) => current.map((machine) => ({
      ...machine,
      importedRows: machine.importedRows.map((item) => {
        if (normalizeCatalogProduct(item.productName) !== rowId) return item;

        return {
          ...item,
          priceWithVat: field === 'priceWithVat' ? parsed : item.priceWithVat,
          saleWithoutVatFixed: field === 'saleWithoutVatFixed' ? parsed : item.saleWithoutVatFixed,
          purchaseWithoutVat: field === 'purchaseWithoutVat' ? parsed : item.purchaseWithoutVat,
          catalogMatched: true,
        };
      }),
    })));
  }

  function toggleHighlight(rowId: string) {
    setHighlightedProducts((current) => {
      const next = new Set(current);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }

  function toggleHiddenProduct(rowId: string) {
    setHiddenProducts((current) => {
      const next = new Set(current);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }

  function printCompleteDocument() {
    if (!clientName.trim()) {
      toast.error('Falta el cliente', { description: 'Rellena el nombre del cliente antes de generar el PDF.' });
      return;
    }
    if (visibleRows.length === 0) {
      toast.error('Faltan productos', { description: 'Importa el CSV de Televend antes de generar el PDF.' });
      return;
    }
    if (missingPriceRows.length > 0) {
      toast.error('Hay productos sin precio', {
        description: `Revisa el editor de precios: ${missingPriceRows.slice(0, 3).map((row) => row.productName).join(', ')}`,
      });
      setPriceEditorOpen(true);
      return;
    }
    printTargetDocument('complete');
  }

  function updateCatalogPrice(productKey: string, field: 'priceWithVat' | 'saleWithoutVat' | 'purchaseWithoutVat', value: string) {
    const parsed = parseNumberValue(value);
    setEditableCatalog((current) => ({
      ...current,
      [productKey]: {
        ...current[productKey],
        [field]: parsed,
      },
    }));
  }

  function addMissingProduct(row: CompleteAggregatedProductRow) {
    const key = normalizeCatalogProduct(row.productName);
    setEditableCatalog((current) => ({
      ...current,
      [key]: {
        priceWithVat: row.priceWithVat || 0,
        saleWithoutVat: row.saleWithoutVatFixed || 0,
        purchaseWithoutVat: row.purchaseWithoutVat || 0,
      },
    }));
    setMachineInputs((current) => current.map((machine) => ({
      ...machine,
      importedRows: machine.importedRows.map((item) => {
        const pricing = getProductPricing(item.productName, {
          ...editableCatalog,
          [key]: {
            priceWithVat: row.priceWithVat || 0,
            saleWithoutVat: row.saleWithoutVatFixed || 0,
            purchaseWithoutVat: row.purchaseWithoutVat || 0,
          },
        });
        return {
          ...item,
          priceWithVat: pricing.priceWithVat,
          saleWithoutVatFixed: pricing.saleWithoutVat,
          purchaseWithoutVat: pricing.purchaseWithoutVat,
          catalogMatched: pricing.matched,
        };
      }),
    })));
  }

  function applyCatalogToImportedRows() {
    setMachineInputs((current) => current.map((machine) => ({
      ...machine,
      importedRows: machine.importedRows.map((row) => {
        const pricing = getProductPricing(row.productName, editableCatalog);
        return {
          ...row,
          priceWithVat: pricing.priceWithVat,
          saleWithoutVatFixed: pricing.saleWithoutVat,
          purchaseWithoutVat: pricing.purchaseWithoutVat,
          catalogMatched: pricing.matched,
        };
      }),
    })));
    toast.success('Precios aplicados', { description: 'Se ha recalculado la recaudación completa.' });
  }

  return (
    <section className="grid gap-5 print:block xl:grid-cols-[minmax(0,1fr)_32rem]">
      <div className="space-y-5 print:hidden">
        <Card className="border-zinc-200 bg-white shadow-sm">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-xl font-black text-zinc-900">Recaudación completa</CardTitle>
                <CardDescription>
                  Documento por unidades vendidas. Pensado solo para máquinas Televend.
                </CardDescription>
              </div>
              <Button type="button" variant="outline" onClick={() => setPriceEditorOpen(true)} className="h-11 rounded-xl font-black">
                Editar precios
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {missingPriceRows.length > 0 && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
                Hay {missingPriceRows.length} producto(s) sin precio. No se podrá generar el PDF hasta completar el catálogo.
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <SummaryTile label="Productos" value={`${visibleRows.length}/${calculatedRows.length}`} tone="dark" />
              <SummaryTile label="Unidades reales" value={String(totals.soldUnits)} tone="dark" />
              <SummaryTile label="Pruebas" value={String(totals.testUnits)} tone="dark" />
              <SummaryTile label="Unidades aplicables" value={String(totals.payableUnits)} tone="green" />
              <SummaryTile label="Total a pagar" value={formatCurrency(totalWithIva)} tone="dark" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="completeClientName">Cliente</Label>
                <Input
                  id="completeClientName"
                  value={clientName}
                  onChange={(event) => setClientName(event.target.value)}
                  placeholder="Ej. Hidropark"
                  className="h-12 rounded-xl font-semibold"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="completeDate">Fecha documento</Label>
                <Input
                  id="completeDate"
                  type="date"
                  value={documentDate}
                  onChange={(event) => setDocumentDate(event.target.value)}
                  className="h-12 rounded-xl font-semibold"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="completeCommission">% comisión</Label>
                <Input
                  id="completeCommission"
                  type="number"
                  min="0"
                  step="0.01"
                  value={commissionPercent}
                  onChange={(event) => setCommissionPercent(event.target.value)}
                  className="h-12 rounded-xl font-semibold"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="completeIva">IVA %</Label>
                <Input
                  id="completeIva"
                  type="number"
                  min="0"
                  step="0.01"
                  value={ivaPercent}
                  onChange={(event) => setIvaPercent(event.target.value)}
                  className="h-12 rounded-xl font-semibold"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
              El CSV aporta unidades vendidas por máquina. En cada producto puedes indicar cuántas unidades fueron pruebas; el cálculo usa ventas reales - pruebas.
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 bg-white shadow-sm">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-xl font-black text-zinc-900">Máquinas y CSV</CardTitle>
                <CardDescription>Añade una máquina, pega su CSV y repite el proceso para las demás.</CardDescription>
              </div>
              <Button type="button" onClick={addMachineInput} className="h-11 rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-700">
                <Plus className="mr-2 h-4 w-4" />
                Añadir máquina
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {machineInputs.map((machine, index) => (
              <div key={machine.id} className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Label htmlFor={`machine-name-${machine.id}`}>Nombre de máquina {index + 1}</Label>
                    <Input
                      id={`machine-name-${machine.id}`}
                      value={machine.name}
                      onChange={(event) => updateMachineInput(machine.id, { name: event.target.value })}
                      placeholder="Ej. MAQ. 5143"
                      className="h-12 rounded-xl bg-white font-semibold"
                    />
                  </div>
                  {machineInputs.length > 1 && (
                    <Button type="button" variant="outline" size="icon" onClick={() => removeMachineInput(machine.id)} className="mt-7 h-12 w-12 rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`machine-csv-${machine.id}`}>CSV de ventas</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={(event) => loadCsvFile(machine.id, event.target.files?.[0] || null)}
                      className="h-12 rounded-xl bg-white font-semibold file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:font-black file:text-emerald-700"
                    />
                  </div>
                  <Textarea
                    id={`machine-csv-${machine.id}`}
                    value={machine.csvText}
                    onChange={(event) => updateMachineInput(machine.id, { csvText: event.target.value })}
                    placeholder={`Productos,Ventas\nAGUA FUENMAYOR,227\nCOCA COLA ZERO PET,56`}
                    className="min-h-36 rounded-xl bg-white font-mono text-sm"
                  />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-bold text-zinc-500">
                    {machine.importedRows.length > 0 ? `${machine.importedRows.length} productos importados` : 'Pendiente de importar'}
                  </p>
                  <Button type="button" onClick={() => importMachineCsv(machine.id)} className="h-11 rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-700">
                    Importar CSV
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {calculatedRows.length > 0 && (
          <Card className="border-zinc-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl font-black text-zinc-900">Ajuste por producto</CardTitle>
              <CardDescription>Añade pruebas por producto, destaca líneas o excluye productos del documento.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {calculatedRows.map((row) => {
                  const isHidden = hiddenProducts.has(row.id);
                  return (
                    <div key={row.id} className={`space-y-3 rounded-2xl border p-3 ${isHidden ? 'border-zinc-200 bg-zinc-100 opacity-60' : 'border-zinc-200 bg-white'}`}>
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <p className="break-words font-black text-zinc-900">{row.productName}</p>
                          <p className="mt-1 text-xs font-semibold text-zinc-500">
                            Real: {row.soldUnits} · Pruebas: {row.testUnits} · Aplicables: {row.payableUnits}
                            {(!row.catalogMatched || row.priceWithVat <= 0 || row.saleWithoutVatFixed <= 0 || row.purchaseWithoutVat <= 0) && <span className="ml-2 font-black text-red-600">Precio incompleto</span>}
                            {isHidden && <span className="ml-2 font-black text-zinc-700">Excluido</span>}
                          </p>
                        </div>
                        <div className="rounded-xl bg-emerald-50 px-3 py-2 text-right">
                          <p className="text-[10px] font-black uppercase text-emerald-700">Comisión línea</p>
                          <p className="font-black text-emerald-700">{formatCurrency(row.commissionAmount)}</p>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[7rem_7rem_7rem_7rem_1fr] lg:items-end">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-black uppercase text-zinc-500">€ venta</Label>
                          <PriceEditorInput
                            value={row.priceWithVat || 0}
                            onValueChange={(value) => updateCompleteProductPrice(row.id, 'priceWithVat', value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-black uppercase text-zinc-500">€ sin IVA</Label>
                          <PriceEditorInput
                            value={row.saleWithoutVatFixed || 0}
                            onValueChange={(value) => updateCompleteProductPrice(row.id, 'saleWithoutVatFixed', value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-black uppercase text-zinc-500">€ compra</Label>
                          <PriceEditorInput
                            value={row.purchaseWithoutVat || 0}
                            onValueChange={(value) => updateCompleteProductPrice(row.id, 'purchaseWithoutVat', value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-black uppercase text-zinc-500">Pruebas</Label>
                          <Input
                            type="number"
                            min="0"
                            value={testUnitsByProduct[row.id] ?? ''}
                            onChange={(event) => updateTestUnits(row.id, event.target.value)}
                            placeholder={String(row.testUnits)}
                            className="h-10 rounded-xl font-black"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2 lg:flex lg:justify-end">
                          <Button type="button" variant={row.highlighted ? 'default' : 'outline'} onClick={() => toggleHighlight(row.id)} className="h-10 rounded-xl font-black">
                            Destacar
                          </Button>
                          <Button type="button" variant={isHidden ? 'default' : 'outline'} onClick={() => toggleHiddenProduct(row.id)} className={`h-10 rounded-xl font-black ${isHidden ? 'bg-zinc-900 text-white hover:bg-zinc-800' : ''}`}>
                            {isHidden ? 'Mostrar' : 'Excluir'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <aside className="space-y-4 xl:sticky xl:top-24 xl:h-fit">
        <Card className="border-zinc-200 bg-white shadow-sm print:hidden">
          <CardHeader>
            <CardTitle className="text-xl font-black text-zinc-900">Resumen completo</CardTitle>
            <CardDescription>Documento por productos vendidos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <SummaryLine label="Máquinas" value={String(machineInputs.filter((machine) => machine.importedRows.length > 0).length)} />
            <SummaryLine label="Productos excluidos" value={String(hiddenProducts.size)} />
            <SummaryLine label="Unidades reales" value={String(totals.soldUnits)} />
            <SummaryLine label="Pruebas" value={String(totals.testUnits)} />
            <SummaryLine label="Unidades aplicables" value={String(totals.payableUnits)} strong />
            <SummaryLine label="Base imponible" value={formatCurrency(completeBaseAmount)} />
            <SummaryLine label={`IVA incluido ${parsedIva}%`} value={formatCurrency(ivaAmount)} />
            <div className="rounded-2xl bg-zinc-950 p-4 text-white">
              <p className="text-xs font-black uppercase text-zinc-300">Total documento</p>
              <p className="mt-1 text-3xl font-black">{formatCurrency(totalWithIva)}</p>
            </div>
            <Button type="button" onClick={printCompleteDocument} className="h-12 w-full rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-700">
              <Printer className="mr-2 h-4 w-4" />
              Generar PDF completo
            </Button>
          </CardContent>
        </Card>

        <CompleteDocumentPreview
          clientName={clientName}
          documentDate={documentDate}
          machineInputs={machineInputs}
          rows={visibleRows}
          totals={totals}
          ivaPercent={parsedIva}
          ivaAmount={ivaAmount}
          totalWithIva={totalWithIva}
          commissionPercent={parsedCommission}
        />
      </aside>

      <Dialog open={priceEditorOpen} onOpenChange={setPriceEditorOpen}>
        <DialogContent className="!flex h-[92dvh] max-h-[92dvh] max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-6xl lg:left-auto lg:right-4 lg:top-4 lg:h-[calc(100dvh-2rem)] lg:max-h-none lg:w-[56rem] lg:translate-x-0 lg:translate-y-0">
          <DialogHeader className="shrink-0 border-b border-zinc-100 p-5 pr-12">
            <DialogTitle className="text-2xl font-black text-zinc-900">Editor de precios</DialogTitle>
            <DialogDescription>
              Edita el catálogo interno usado para calcular la recaudación completa.
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 border-b border-zinc-100 bg-white p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Input
                  value={priceSearch}
                  onChange={(event) => setPriceSearch(event.target.value)}
                  placeholder="Buscar producto..."
                  className="h-12 rounded-xl font-semibold"
                />
                <Button type="button" onClick={applyCatalogToImportedRows} className="h-12 rounded-xl bg-emerald-600 px-5 font-black text-white hover:bg-emerald-700">
                  Aplicar precios
                </Button>
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-5">
            {missingPriceRows.length > 0 && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="font-black text-red-800">Productos sin precio detectados</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {missingPriceRows.map((row) => (
                    <Button key={row.id} type="button" variant="outline" onClick={() => addMissingProduct(row)} className="h-9 rounded-xl border-red-200 bg-white text-xs font-black text-red-700 hover:bg-red-50">
                      Añadir {row.productName}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              {filteredCatalogEntries.map(([key, price]) => (
                <div key={key} className="grid gap-2 rounded-2xl border border-zinc-200 bg-white p-3 sm:grid-cols-[1fr_8rem_8rem_8rem] sm:items-end">
                  <div>
                    <p className="font-black capitalize text-zinc-900">{key}</p>
                    <p className="text-xs font-semibold text-zinc-500">Clave interna del catálogo</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-zinc-500">€ venta</Label>
                    <PriceEditorInput
                      value={price.priceWithVat}
                      onValueChange={(value) => updateCatalogPrice(key, 'priceWithVat', value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-zinc-500">€ sin IVA</Label>
                    <PriceEditorInput
                      value={price.saleWithoutVat}
                      onValueChange={(value) => updateCatalogPrice(key, 'saleWithoutVat', value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-zinc-500">€ compra</Label>
                    <PriceEditorInput
                      value={price.purchaseWithoutVat}
                      onValueChange={(value) => updateCatalogPrice(key, 'purchaseWithoutVat', value)}
                    />
                  </div>
                </div>
              ))}
            </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function CompleteDocumentPreview({
  clientName,
  documentDate,
  machineInputs,
  rows,
  totals,
  ivaPercent,
  ivaAmount,
  totalWithIva,
  commissionPercent,
}: {
  clientName: string;
  documentDate: string;
  machineInputs: MachineCsvInput[];
  rows: CompleteAggregatedProductRow[];
  totals: { soldUnits: number; testUnits: number; payableUnits: number; commission: number };
  ivaPercent: number;
  ivaAmount: number;
  totalWithIva: number;
  commissionPercent: number;
}) {
  const baseAmount = round2(totals.commission / (1 + (ivaPercent / 100)));

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
      <div className="border-b border-zinc-100 p-4 print:hidden">
        <p className="text-sm font-black uppercase text-zinc-500">Vista previa PDF completo</p>
      </div>
      <article id="complete-document" className="mx-auto min-h-[720px] w-full max-w-[1120px] bg-white p-5 text-zinc-950 print:min-h-[297mm] print:w-[210mm] print:max-w-none print:p-[6mm]">
        <header className="mb-2 flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-black print:text-sm">Recaudación completa</p>
            <p className="mt-0.5 text-xs font-bold">Cliente: {clientName || 'Nombre del cliente'} · Fecha: {formatDateInput(documentDate) || '-'}</p>
            <p className="max-w-[160mm] truncate text-[10px] font-semibold text-zinc-600">
              Máquinas: {machineInputs.filter((machine) => machine.importedRows.length > 0).map((machine) => machine.name || 'Máquina').join(', ') || '-'}
            </p>
          </div>
          <Image src="/logo.png" alt="Lify Vending" width={90} height={52} className="h-auto w-16 object-contain" />
        </header>

        <div className="mb-2 grid grid-cols-3 gap-1.5 text-[10px] font-black print:text-[7px]">
          <div className="rounded bg-zinc-100 px-2 py-1">Comisión: {commissionPercent}%</div>
          <div className="rounded bg-zinc-100 px-2 py-1">Pruebas: {totals.testUnits}</div>
          <div className="rounded bg-zinc-100 px-2 py-1">Aplicables: {totals.payableUnits}</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11px] print:text-[6.3px]">
            <thead>
              <tr>
                <th className="border border-zinc-300 px-1 py-1 text-left" style={{ backgroundColor: '#ffff00' }}>Productos</th>
                {machineInputs.filter((machine) => machine.importedRows.length > 0).map((machine) => (
                  <th key={machine.id} className="border border-zinc-300 px-1 py-1 text-right" style={{ backgroundColor: '#ff9900' }}>
                    {machine.name || 'MAQ.'}
                  </th>
                ))}
                <th className="border border-zinc-300 px-1 py-1 text-right" style={{ backgroundColor: '#dddddd' }}>Un. Vendidas</th>
                <th className="border border-zinc-300 px-1 py-1 text-right" style={{ backgroundColor: '#00ff66' }}>Pruebas</th>
                <th className="border border-zinc-300 px-1 py-1 text-right" style={{ backgroundColor: '#ff9900' }}>TOTAL U.Vendidas</th>
                <th className="border border-zinc-300 px-1 py-1 text-right" style={{ backgroundColor: '#00e5ef' }}>€ venta</th>
                <th className="border border-zinc-300 px-1 py-1 text-right" style={{ backgroundColor: '#00e5ef' }}>€ sin IVA</th>
                <th className="border border-zinc-300 px-1 py-1 text-right" style={{ backgroundColor: '#00e5ef' }}>€ compra</th>
                <th className="border border-zinc-300 px-1 py-1 text-right">Dif.</th>
                <th className="border border-zinc-300 px-1 py-1 text-right">% {clientName || 'Cliente'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} style={{ backgroundColor: row.highlighted ? '#ffff00' : '#ffffff' }}>
                  <td className="border border-zinc-300 px-1 py-0.5 font-semibold">{row.productName}</td>
                  {machineInputs.filter((machine) => machine.importedRows.length > 0).map((machine) => (
                    <td key={machine.id} className="border border-zinc-300 px-1 py-0.5 text-right">
                      {row.machineUnits[machine.id] || 0}
                    </td>
                  ))}
                  <td className="border border-zinc-300 px-1 py-0.5 text-right">{row.soldUnits}</td>
                  <td className="border border-zinc-300 px-1 py-0.5 text-right">{row.testUnits}</td>
                  <td className="border border-zinc-300 px-1 py-0.5 text-right font-black">{row.payableUnits}</td>
                  <td className="border border-zinc-300 px-1 py-0.5 text-right">{formatCurrency(row.priceWithVat)}</td>
                  <td className="border border-zinc-300 px-1 py-0.5 text-right">{formatCurrency(row.saleWithoutVatFixed)}</td>
                  <td className="border border-zinc-300 px-1 py-0.5 text-right">{formatCurrency(row.purchaseWithoutVat)}</td>
                  <td className="border border-zinc-300 px-1 py-0.5 text-right">{formatCurrency(row.difference)}</td>
                  <td className="border border-zinc-300 px-1 py-0.5 text-right font-black">{formatCurrency(row.commissionAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 ml-auto w-56 border-2 border-zinc-950 text-sm print:w-40 print:text-[8px]">
          <div className="grid grid-cols-2 border-b-2 border-zinc-950">
            <div className="border-r-2 border-zinc-950 px-2 py-1 font-black">Base imponible:</div>
            <div className="px-2 py-1 text-right">{formatCurrency(baseAmount)}</div>
          </div>
          <div className="grid grid-cols-2 border-b-2 border-zinc-950">
            <div className="border-r-2 border-zinc-950 px-2 py-1 font-black">IVA incluido {ivaPercent}%:</div>
            <div className="px-2 py-1 text-right">{formatCurrency(ivaAmount)}</div>
          </div>
          <div className="grid grid-cols-2">
            <div className="border-r-2 border-zinc-950 px-2 py-1 font-black">Total a pagar:</div>
            <div className="px-2 py-1 text-right font-black">{formatCurrency(totalWithIva)}</div>
          </div>
        </div>
      </article>
    </div>
  );
}
