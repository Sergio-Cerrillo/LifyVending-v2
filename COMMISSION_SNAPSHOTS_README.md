# Sistema de Histórico de Comisiones

## 📋 Descripción

Sistema automatizado para registrar mensualmente las comisiones de cada cliente, eliminando la necesidad de crear documentos manualmente al final de cada mes.

## 🎯 Funcionalidad

El sistema guarda automáticamente snapshots mensuales de las comisiones de cada cliente, incluyendo:

- **Recaudación total del mes** (bruto)
- **Porcentaje de comisión** aplicado
- **Monto de comisión** calculado
- **Desglose por tipo de pago** (tarjeta/efectivo)
- **Número de máquinas** asignadas ese mes

## 🔧 Uso

### API Endpoint

**Generar snapshots para un mes específico:**

```http
POST /api/admin/commission-snapshots
Content-Type: application/json

{
  "month": 4,          // Mes (1-12)
  "year": 2026,        // Año
  "clientId": "uuid",  // Opcional: ID del cliente (si no se proporciona, genera para todos)
  "force": false       // Opcional: Sobrescribir si ya existe (default: false)
}
```

**Respuesta:**
```json
{
  "success": true,
  "summary": {
    "total": 5,
    "created": 3,
    "updated": 1,
    "skipped": 1,
    "exists": 0,
    "errors": 0
  },
  "results": [...]
}
```

**Obtener histórico de comisiones:**

```http
GET /api/admin/commission-snapshots?clientId=uuid&year=2026&month=4
```

### Proceso Recomendado

#### Al Final de Cada Mes

1. **Generar snapshots automáticamente:**
   ```bash
   # Generar para todos los clientes del mes actual
   curl -X POST https://tu-dominio.com/api/admin/commission-snapshots \
     -H "Content-Type: application/json" \
     -d '{"month": 4, "year": 2026}'
   ```

2. **Verificar resultados:**
   - Revisar el resumen de snapshots creados
   - Confirmar que todos los clientes tienen su snapshot

3. **Consultar histórico:**
   - El cliente puede ver su histórico en su dashboard
   - El admin puede ver todos los históricos en gestión de clientes

#### Configuración de Cron (Automático)

Para generar automáticamente cada mes, puedes configurar un cron job:

```typescript
// app/api/cron/generate-commission-snapshots/route.ts
export async function GET(request: NextRequest) {
  // Validar cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Obtener mes y año anteriores
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const month = lastMonth.getMonth() + 1;
  const year = lastMonth.getFullYear();

  // Generar snapshots
  const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/admin/commission-snapshots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ month, year })
  });

  return response;
}
```

**Configurar en Vercel:**
```json
{
  "crons": [
    {
      "path": "/api/cron/generate-commission-snapshots",
      "schedule": "0 0 1 * *"  // Primer día de cada mes a medianoche
    }
  ]
}
```

## 📊 Estructura de Datos

### Tabla: `commission_snapshots`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Identificador único |
| `client_id` | UUID | ID del cliente (FK a profiles) |
| `month` | INTEGER | Mes (1-12) |
| `year` | INTEGER | Año |
| `total_revenue` | DECIMAL | Recaudación total bruta |
| `commission_percent` | DECIMAL | % de comisión oculta |
| `commission_amount` | DECIMAL | Monto calculado de comisión |
| `card_revenue` | DECIMAL | Recaudación por tarjeta |
| `cash_revenue` | DECIMAL | Recaudación en efectivo |
| `machines_count` | INTEGER | Número de máquinas asignadas |
| `created_at` | TIMESTAMP | Fecha de creación |

**Constraint único:** `(client_id, month, year)` - No se pueden duplicar snapshots para el mismo cliente/mes/año

## 🔐 Seguridad (RLS)

- **Admins:** Pueden ver, crear y actualizar todos los snapshots
- **Clientes:** Solo pueden ver sus propios snapshots
- Los snapshots no se pueden eliminar (histórico permanente)

## 💡 Ventajas

### Antes (Manual):
1. ❌ Al final del mes, el administrativo creaba un documento Excel para cada cliente
2. ❌ Enviaba manualmente el documento por email
3. ❌ No había histórico digital accesible
4. ❌ Propenso a errores humanos

### Ahora (Automático):
1. ✅ Sistema genera automáticamente los snapshots
2. ✅ Cliente puede ver su histórico en cualquier momento
3. ✅ Admin tiene todo centralizado en la plataforma
4. ✅ Cálculos exactos y consistentes
5. ✅ Trazabilidad completa

## 🚀 Próximos Pasos

### Implementación en UI

**Panel de Cliente:**
- Agregar sección "Histórico de Comisiones" en el dashboard del cliente
- Mostrar tabla con snapshots mensuales
- Permitir descargar PDF de cada mes

**Panel de Admin:**
- Agregar botón "Generar Snapshot Mensual" en gestión de clientes
- Mostrar tabla de snapshots históricos por cliente
- Dashboard con resumen de comisiones totales

### Ejemplo de Implementación en Cliente Dashboard:

```typescript
// components/client/commission-history.tsx
'use client';

import { useEffect, useState } from 'react';

export function CommissionHistory({ clientId }: { clientId: string }) {
  const [snapshots, setSnapshots] = useState([]);

  useEffect(() => {
    fetch(`/api/admin/commission-snapshots?clientId=${clientId}`)
      .then(res => res.json())
      .then(data => setSnapshots(data.data));
  }, [clientId]);

  return (
    <div>
      <h2>Histórico de Comisiones</h2>
      <table>
        <thead>
          <tr>
            <th>Mes</th>
            <th>Recaudación</th>
            <th>Comisión</th>
            <th>Tu Parte</th>
          </tr>
        </thead>
        <tbody>
          {snapshots.map(snap => (
            <tr key={snap.id}>
              <td>{snap.month}/{snap.year}</td>
              <td>{snap.total_revenue.toFixed(2)} €</td>
              <td>{snap.commission_amount.toFixed(2)} € ({snap.commission_percent}%)</td>
              <td>{(snap.total_revenue - snap.commission_amount).toFixed(2)} €</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

## 📝 Notas

- Los snapshots se generan basándose en las recaudaciones guardadas en `machine_revenue_snapshots`
- Se toma el snapshot más reciente de cada máquina por día para evitar duplicados
- Solo se procesan clientes con máquinas asignadas
- El porcentaje de comisión se obtiene de `client_settings.commission_hide_percent`

## ⚠️ Importante

- **NO** borrar la tabla `commission_snapshots` - es histórico permanente
- Ejecutar el snapshot mensual **después** de que todos los scrapings del mes estén completos
- Verificar que todos los clientes tienen configurado su `commission_hide_percent`

## 🔗 Migración

Para aplicar la migración en tu base de datos Supabase:

```sql
-- Ejecutar el archivo:
-- supabase/migrations/20250428_create_commission_snapshots.sql
```

O desde Supabase Dashboard:
1. SQL Editor → New query
2. Copiar contenido del archivo de migración
3. Run

## 📞 Soporte

Para dudas o problemas:
- Revisar logs en la consola del servidor
- Verificar que las políticas RLS estén activas
- Confirmar que los clientes tienen máquinas asignadas
