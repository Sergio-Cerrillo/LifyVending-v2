# 🔒 Checklist de Seguridad - Sistema Multi-Tenant

## ⚠️ **PRINCIPIOS FUNDAMENTALES**

### **Regla de Oro**
**El cliente NUNCA debe poder inferir o descubrir:**
1. La recaudación bruta real
2. El porcentaje de comisión aplicado
3. La diferencia entre bruto y neto

---

## ✅ **QUÉ ENVIAR AL CLIENTE**

### **Datos Permitidos**

#### ✅ Recaudación NETA calculada en backend
```typescript
// ✅ CORRECTO - Calculado en SQL server-side
amount_net = amount_gross * (1 - commission_percent / 100)
```

#### ✅ Lista de máquinas ASIGNADAS
```sql
-- ✅ CORRECTO - Solo máquinas del cliente via RLS
SELECT m.* FROM machines m
JOIN client_machine_assignments cma ON cma.machine_id = m.id
WHERE cma.client_id = auth.uid()
```

#### ✅ Fecha de última actualización
```typescript
lastUpdate: "2024-03-04T10:00:00Z"
```

#### ✅ Estado del scrape run propio
```typescript
{
  status: "completed",
  startedAt: "...",
  finishedAt: "..."
}
```

---

## ❌ **QUÉ NUNCA ENVIAR AL CLIENTE**

### **Datos Prohibidos**

#### ❌ Recaudación BRUTA
```typescript
// ❌ PROHIBIDO - Nunca exponer al cliente
amount_gross: 100.00
```

#### ❌ Porcentaje de comisión
```typescript
// ❌ PROHIBIDO - Nunca exponer al cliente
commission_hide_percent: 30
```

#### ❌ Diferencia bruto - neto
```typescript
// ❌ PROHIBIDO - Revela el porcentaje
difference: 30.00  // Cliente calcularía: 30/100 = 30%
```

#### ❌ Settings del cliente
```typescript
// ❌ PROHIBIDO - Contiene commission_hide_percent
client_settings: {
  commission_hide_percent: 30
}
```

#### ❌ Máquinas no asignadas
```sql
-- ❌ PROHIBIDO - Cliente solo debe ver las suyas
SELECT * FROM machines
-- Sin filtrar por asignaciones
```

---

## 🔐 **IMPLEMENTACIONES DE SEGURIDAD**

### **1. Row Level Security (RLS)**

#### **Policies Implementadas**

##### ✅ Profiles
```sql
-- Cliente solo ve su perfil
CREATE POLICY "Clients can view own profile" ON profiles
FOR SELECT TO authenticated
USING (id = auth.uid() AND role = 'client');
```

##### ✅ Client Settings (CRÍTICO)
```sql
-- Cliente NO puede ver sus settings
-- (evita conocer commission_hide_percent)
-- Solo admin puede verlos
CREATE POLICY "Admins can manage all client settings" ON client_settings
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  )
);
```

##### ✅ Machines
```sql
-- Cliente solo ve máquinas asignadas
CREATE POLICY "Clients can view assigned machines" ON machines
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM client_machine_assignments
    WHERE client_id = auth.uid() AND machine_id = machines.id
  )
);
```

##### ✅ Revenue Snapshots
```sql
-- Cliente puede ver snapshots de sus máquinas
-- PERO: el endpoint debe devolver amount_net calculado, NO amount_gross
CREATE POLICY "Clients can view revenue of assigned machines"
ON machine_revenue_snapshots
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM client_machine_assignments cma
    WHERE cma.client_id = auth.uid() 
      AND cma.machine_id = machine_revenue_snapshots.machine_id
  )
);
```

### **2. Funciones SQL Seguras**

#### ✅ `get_client_net_revenue()` - Cálculo server-side
```sql
-- ✅ SEGURO: Calcula neto en servidor, cliente no puede modificar
CREATE OR REPLACE FUNCTION get_client_net_revenue(
  p_client_id UUID,
  p_period revenue_period,
  p_machine_id UUID DEFAULT NULL
)
RETURNS TABLE (
  machine_id UUID,
  machine_name TEXT,
  location TEXT,
  period revenue_period,
  amount_net NUMERIC,  -- ✅ Solo devuelve NETO
  scraped_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.name,
    m.location,
    mrs.period,
    -- ✅ Cálculo en servidor, no expone bruto ni percent
    ROUND(mrs.amount_gross * (1 - COALESCE(cs.commission_hide_percent, 0) / 100.0), 2) AS amount_net,
    mrs.scraped_at
  FROM machine_revenue_snapshots mrs
  JOIN machines m ON m.id = mrs.machine_id
  JOIN client_machine_assignments cma ON cma.machine_id = m.id
  LEFT JOIN client_settings cs ON cs.client_id = cma.client_id
  WHERE cma.client_id = p_client_id
    AND mrs.period = p_period
  ORDER BY mrs.scraped_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### **3. API Endpoints - Validación de Permisos**

#### ✅ Ejemplo: `/api/client/dashboard`

```typescript
// ✅ SEGURO: Verifica autenticación y rol
const { data: { user }, error } = await supabase.auth.getUser(token);

// ✅ Verificar que es cliente
const { data: profile } = await supabase
  .from('profiles')
  .select('role')
  .eq('id', user.id)
  .single();

if (profile?.role !== 'client') {
  return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
}

// ✅ Usar función SQL que solo devuelve neto
const { data } = await supabase.rpc('get_client_net_revenue', {
  p_client_id: user.id,
  p_period: 'monthly'
});

// ✅ Respuesta solo contiene amount_net
return NextResponse.json({
  revenue: {
    monthly: {
      total: data.reduce((sum, m) => sum + m.amount_net, 0),
      machines: data.map(m => ({
        id: m.machine_id,
        name: m.machine_name,
        amountNet: m.amount_net  // ✅ Solo neto
      }))
    }
  }
});
```

#### ❌ INSEGURO - NO HACER

```typescript
// ❌ INSEGURO: Expone bruto y porcentaje
const { data } = await supabase
  .from('machine_revenue_snapshots')
  .select('amount_gross, ...')  // ❌ Cliente podría ver bruto

// ❌ INSEGURO: Calcula neto en cliente
const net = data.amount_gross * (1 - percent / 100);  // ❌ Cliente conoce percent
```

### **4. Frontend - Nunca Confiar en el Cliente**

#### ✅ Datos desde Backend
```typescript
// ✅ CORRECTO: Backend calcula y envía neto
const response = await fetch('/api/client/dashboard');
const { revenue } = await response.json();

// revenue.monthly.total ya es NETO calculado en backend
```

#### ❌ Cálculo en Frontend
```typescript
// ❌ PROHIBIDO: Nunca calcular neto en cliente
const net = bruto * (1 - percent / 100);  // ❌ Expone lógica
```

---

## 🧪 **TESTS DE SEGURIDAD**

### **Pruebas Obligatorias**

#### **Test 1: Cliente no puede ver bruto**
```sql
-- Ejecutar como cliente (no admin)
-- Debe devolver 0 filas o error
SELECT amount_gross FROM machine_revenue_snapshots;
```

#### **Test 2: Cliente no puede ver settings**
```sql
-- Ejecutar como cliente
-- Debe devolver 0 filas
SELECT * FROM client_settings;
```

#### **Test 3: Cliente solo ve sus máquinas**
```sql
-- Ejecutar como cliente
-- Debe devolver solo máquinas asignadas
SELECT COUNT(*) FROM machines;

-- Verificar
SELECT COUNT(*) FROM client_machine_assignments
WHERE client_id = auth.uid();
-- Ambos counts deben ser iguales
```

#### **Test 4: API no expone datos prohibidos**
```bash
# Hacer request a /api/client/dashboard
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/client/dashboard

# Verificar respuesta NO contiene:
# - amount_gross
# - commission_hide_percent
# - commission_percent
```

#### **Test 5: Inferir porcentaje es imposible**
```typescript
// Cliente intenta calcular porcentaje
// Si tuviera bruto y neto:
const percent = ((bruto - neto) / bruto) * 100;

// ✅ SEGURO: Cliente no tiene "bruto", no puede calcular
```

---

## 📊 **MONITORING Y AUDITORÍA**

### **Queries de Auditoría**

#### Detectar accesos sospechosos
```sql
-- Scrape runs por clientes (detectar exceso)
SELECT 
  p.email,
  COUNT(*) as scrape_count,
  MAX(sr.started_at) as last_scrape
FROM scrape_runs sr
JOIN profiles p ON p.id = sr.triggered_by_user_id
WHERE p.role = 'client'
  AND sr.started_at > NOW() - INTERVAL '1 day'
GROUP BY p.id
HAVING COUNT(*) > 10;  -- Más de 10 scrapes en 1 día
```

#### Verificar integridad de asignaciones
```sql
-- Máquinas asignadas a múltiples clientes (debería ser vacío)
SELECT machine_id, COUNT(*) as client_count
FROM client_machine_assignments
GROUP BY machine_id
HAVING COUNT(*) > 1;
```

### **Logs Críticos**

```typescript
// ✅ Loguear todos los accesos a overview admin
console.log(`[ADMIN] Overview requested for client ${clientId} by admin ${adminId}`);

// ✅ Loguear scrape runs
console.log(`[SCRAPE] Run ${id} triggered by ${userId} (${role})`);

// ✅ Loguear cambios de configuración
console.log(`[CONFIG] Commission changed for client ${clientId}: ${oldPercent}% → ${newPercent}%`);
```

---

## 🚨 **INCIDENTES Y RESPUESTA**

### **Si el Cliente Descubre el Porcentaje**

#### Causas Posibles:
1. API endpoint expuso `amount_gross`
2. Frontend calculó neto (exposición de lógica)
3. UI mostró diferencia bruto-neto
4. Settings accesibles sin RLS

#### Solución Inmediata:
1. Revisar todos los endpoints `/api/client/*`
2. Verificar que respuestas no contienen campos prohibidos
3. Comprobar RLS policies están activas
4. Auditar logs de Supabase

### **Rollback de Seguridad**

```sql
-- Desactivar acceso cliente temporal
UPDATE profiles 
SET role = 'suspended' 
WHERE id = 'cliente-comprometido-id';

-- Revisar qué datos accedió
SELECT * FROM audit_logs 
WHERE user_id = 'cliente-id'
ORDER BY created_at DESC;
```

---

## ✅ **CHECKLIST FINAL ANTES DE DEPLOY**

### **Pre-Deploy**
- [ ] Verificar todas las RLS policies están activas (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
- [ ] Test manual: login como cliente, intentar acceder a datos prohibidos
- [ ] Revisar TODOS los endpoints `/api/client/*` no exponen `amount_gross` ni `commission_percent`
- [ ] Confirmar función `get_client_net_revenue()` tiene `SECURITY DEFINER`
- [ ] Verificar que `.env.local` NO está en Git
- [ ] Service Role Key solo en servidor (no exponerla a cliente)

### **Post-Deploy**
- [ ] Probar en producción con cliente de prueba
- [ ] Monitorear logs de Supabase primeros 7 días
- [ ] Configurar alertas de scraping excesivo
- [ ] Backup inicial de DB

---

## 📚 **RECURSOS**

### **Documentación Relevante**
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
- [Next.js API Routes Security](https://nextjs.org/docs/pages/building-your-application/routing/api-routes)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

### **Contacto de Seguridad**
En caso de vulnerabilidad descubierta:
1. NO reportar públicamente
2. Contactar: [tu-email-seguridad]
3. Incluir: pasos de reproducción + impacto

---

**Última revisión: Marzo 2024**
**Versión del sistema: 1.0.0**
