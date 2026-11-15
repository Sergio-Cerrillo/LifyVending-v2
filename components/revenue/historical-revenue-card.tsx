import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const currency = (amount: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);

// Solo recibe importes visibles: el mismo diseño se usa en el histórico del
// cliente, en los cierres automáticos y en la vista previa de carga manual.
export function HistoricalRevenueCard({ machineName, machineLocation, amountTotal, commissionAmount, notes }: {
  machineName: string;
  machineLocation: string | null;
  amountTotal: number;
  commissionAmount: number;
  notes?: string | null;
}) {
  return (
    <Card className="border-zinc-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{machineName}</CardTitle>
        <CardDescription>{machineLocation || 'Sin ubicación'}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Recaudación</p>
          <p className="text-2xl font-bold">{currency(amountTotal)}</p>
          <p className="text-sm text-zinc-600">Comisión {currency(commissionAmount)}</p>
        </div>
        {notes && <p className="text-xs text-muted-foreground">{notes}</p>}
      </CardContent>
    </Card>
  );
}

export function HistoricalRevenueMonthSummary({ label, amountTotal, commissionAmount }: {
  label: string;
  amountTotal: number;
  commissionAmount: number;
}) {
  return (
    <Card className="border-zinc-200">
      <CardHeader>
        <CardTitle className="capitalize">Total {label}</CardTitle>
        <CardDescription>Suma de recaudaciones del mes</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-baseline gap-3">
          <div><p className="text-xs text-muted-foreground">Recaudación</p><p className="text-3xl font-bold">{currency(amountTotal)}</p></div>
          <p className="text-sm text-zinc-600">Comisión {currency(commissionAmount)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
