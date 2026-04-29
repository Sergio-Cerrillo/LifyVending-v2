# Sistema Multi-Tenant de Vending - Documentación Completa

## 📋 Índice

1. [Resumen del Sistema](#resumen-del-sistema)
2. [Arquitectura](#arquitectura)
3. [Estructura del Proyecto](#estructura-del-proyecto)
4. [Instalación y Configuración](#instalación-y-configuración)
5. [Base de Datos](#base-de-datos)
6. [API Endpoints](#api-endpoints)
7. [Scraping](#scraping)
8. [Seguridad](#seguridad)
9. [Testing](#testing)
10. [Deployment](#deployment)

---

## 🎯 Resumen del Sistema

Sistema web multi-tenant para empresa de vending que permite:

### **ROL ADMIN (Empresa)**
- Crear y gestionar clientes
- Asignar máquinas a cada cliente
- Definir porcentaje de comisión oculta por cliente
- Ver recaudación bruta vs neta simultáneamente
- Resetear contraseñas

### **ROL CLIENTE**
- Ver solo sus máquinas asignadas
- Ver recaudación NETA (con comisión ya aplicada)
- Visualizar daily/weekly/monthly
- Botón "Actualizar datos" que lanza scraping
- NO ve bruto ni porcentaje de comisión

### **Fórmula de Cálculo**
```
Recaudación Neta = Recaudación Bruta × (1 - Porcentaje / 100)

Ejemplo:
- Bruto: 100€
- Comisión: 30%
- Neto (cliente ve): 100€ × (1 - 30/100) = 70€
- Diferencia (comisión oculta): 30€
```

---

## 🏗️ Arquitectura

### **Stack Tecnológico**

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Next.js Route Handlers (API Routes)
- **Base de Datos**: Supabase (PostgreSQL) con Row Level Security (RLS)
- **Autenticación**: Supabase Auth
- **Scraping**: Puppeteer + función mock
- **UI Components**: shadcn/ui

### **Flujo de Datos**

```
┌─────────────────────────────────────────────────────────────┐
│                       CLIENTE                               │
│  Dashboard → API /client/dashboard → Supabase RLS filtering│
│  Botón Refresh → API /client/refresh → Scraper → DB        │
└─────────────────────────────────────────────────────────────┘
                              ↓
                       Recaudación NETA
                     (bruto × (1 - %/100))

┌─────────────────────────────────────────────────────────────┐
│                        ADMIN                                │
│  Gestión clientes → API /admin/users                       │
│  Asignar máquinas → API /admin/assignments                 │
│  Overview cliente → API /admin/clients/[id]/overview       │
└─────────────────────────────────────────────────────────────┘
                              ↓
                   Bruto + Neto + Diferencia
```

---

## 📁 Estructura del Proyecto

```
NewLifyVending/
├── app/
│   ├── api/
│   │   ├── admin/
│   │   │   ├── users/
│   │   │   │   ├── route.ts                    # POST: crear cliente
│   │   │   │   └── [id]/
│   │   │   │       └── reset-password/route.ts # POST: resetear password
│   │   │   ├── clients/
│   │   │   │   ├── route.ts                    # GET: listar clientes
│   │   │   │   └── [clientId]/
│   │   │   │       └── overview/route.ts       # GET: overview bruto vs neto
│   │   │   ├── assignments/route.ts            # POST: asignar máquinas
│   │   │   ├── client-settings/
│   │   │   │   └── [clientId]/route.ts         # PUT: actualizar comisión
│   │   │   └── machines/route.ts               # GET: listar máquinas
│   │   └── client/
│   │       ├── dashboard/route.ts              # GET: dashboard cliente (neto)
│   │       └── refresh/route.ts                # POST: ejecutar scraping
│   ├── admin/
│   │   ├── clients-management/page.tsx         # Gestión de clientes
│   │   └── clients/
│   │       └── [id]/page.tsx                   # Detalle cliente
│   └── client/
│       └── dashboard/page.tsx                  # Dashboard cliente
├── lib/
│   ├── database.types.ts                       # Tipos TypeScript de Supabase
│   ├── supabase-helpers.ts                     # Helpers para operaciones DB
│   └── utils.ts
├── scraper/
│   └── machine-revenue-scraper.ts              # Scraper de recaudación por máquinas
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql              # Schema completo + RLS
│       └── 002_seed_data.sql                   # Datos de prueba
└── components/
    └── ui/                                     # Componentes shadcn/ui
```

---

## 🚀 Instalación y Configuración

### **1. Requisitos Previos**

- Node.js 18+ y pnpm
- Cuenta de Supabase (gratuita)

### **2. Clonar y Instalar Dependencias**

```bash
cd NewLifyVending
pnpm install
```

### **3. Configurar Variables de Entorno**

Crear `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key

# Scraper (opcional)
ORAIN_USERNAME=tu_usuario_orain
ORAIN_PASSWORD=tu_password_orain
USE_MOCK_SCRAPER=true  # true para usar mock, false para scraping real

# Next.js
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### **4. Configurar Base de Datos en Supabase**

#### **Opción A: Mediante CLI de Supabase (recomendado)**

```bash
# Instalar CLI
npm install -g supabase

# Inicializar proyecto
supabase init

# Ejecutar migraciones
supabase db push
```

#### **Opción B: SQL Editor en Dashboard**

1. Ir a https://app.supabase.com
2. Abrir SQL Editor
3. Copiar y ejecutar `supabase/migrations/001_initial_schema.sql`
4. Copiar y ejecutar `supabase/migrations/002_seed_data.sql`

### **5. Crear Usuario Admin Inicial**

Ejecutar en SQL Editor:

```sql
-- Primero crear el usuario en Auth (desde Dashboard > Authentication)
-- O usar Supabase Auth Admin API

-- Luego crear su perfil
INSERT INTO profiles (id, role, email, display_name)
VALUES (
  'tu-user-id-desde-auth',  -- Obtener desde Authentication > Users
  'admin',
  'admin@lifyvending.com',
  'Administrador'
);
```

### **6. Ejecutar en Desarrollo**

```bash
pnpm dev
```

Abrir http://localhost:3000

---

## 🗄️ Base de Datos

### **Tablas Principales**

#### **profiles**
```sql
- id: UUID (FK a auth.users)
- role: enum('admin', 'client')
- email: string
- display_name: string | null
- company_name: string | null
```

#### **client_settings**
```sql
- id: UUID
- client_id: UUID (FK profiles)
- commission_hide_percent: numeric (0-100)
```

#### **machines**
```sql
- id: UUID
- orain_machine_id: string | null
- name: string
- location: string | null
- last_scraped_at: timestamp
```

#### **client_machine_assignments**
```sql
- id: UUID
- client_id: UUID (FK profiles)
- machine_id: UUID (FK machines)
- UNIQUE(client_id, machine_id)
```

#### **machine_revenue_snapshots**
```sql
- id: UUID
- machine_id: UUID (FK machines)
- scraped_at: timestamp
- period: enum('daily', 'weekly', 'monthly')
- amount_gross: numeric         # Recaudación BRUTA
- anonymous_total: numeric      # Desglose
- anonymous_card: numeric
- anonymous_cash: numeric
```

#### **scrape_runs**
```sql
- id: UUID
- triggered_by_user_id: UUID (FK profiles)
- triggered_role: enum
- status: enum('pending', 'running', 'completed', 'error')
- started_at: timestamp
- finished_at: timestamp | null
- machines_scraped: integer
```

### **Funciones SQL Importantes**

#### **get_client_net_revenue()**
Calcula recaudación NETA aplicando comisión:

```sql
SELECT * FROM get_client_net_revenue(
  'client-id-uuid',
  'monthly',
  NULL  -- NULL para todas las máquinas
);
```

#### **get_admin_client_overview()**
Resumen bruto vs neto por periodo:

```sql
SELECT * FROM get_admin_client_overview('client-id-uuid');
```

---

## 🔌 API Endpoints

### **Admin Endpoints**

#### `POST /api/admin/users`
Crear nuevo cliente

**Request:**
```json
{
  "email": "cliente@ejemplo.com",
  "password": "password123",
  "displayName": "Juan Pérez",
  "companyName": "Hotel Del Mar S.L.",
  "commissionPercent": 30
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "cliente@ejemplo.com"
  }
}
```

#### `POST /api/admin/users/[id]/reset-password`
Resetear contraseña de cliente

**Request:**
```json
{
  "newPassword": "nuevapassword123"
}
```

#### `POST /api/admin/assignments`
Asignar máquinas a cliente

**Request:**
```json
{
  "clientId": "uuid",
  "machineIds": ["uuid1", "uuid2", "uuid3"]
}
```

#### `PUT /api/admin/client-settings/[clientId]`
Actualizar porcentaje de comisión

**Request:**
```json
{
  "commissionPercent": 35.5
}
```

#### `GET /api/admin/clients`
Listar todos los clientes

**Response:**
```json
{
  "clients": [
    {
      "id": "uuid",
      "email": "cliente@ejemplo.com",
      "display_name": "Juan Pérez",
      "company_name": "Hotel Del Mar",
      "machineCount": 5,
      "commissionPercent": 30,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### `GET /api/admin/clients/[clientId]/overview`
Overview bruto vs neto de un cliente

**Response:**
```json
{
  "client": {
    "id": "uuid",
    "email": "cliente@ejemplo.com",
    "displayName": "Juan Pérez",
    "commissionPercent": 30
  },
  "machines": [...],
  "revenue": {
    "daily": {
      "total_gross": 255.10,
      "total_net": 178.57,
      "commission_percent": 30,
      "machine_count": 3,
      "last_update": "2024-03-04T10:00:00Z"
    },
    "weekly": {...},
    "monthly": {...}
  }
}
```

### **Cliente Endpoints**

#### `GET /api/client/dashboard`
Dashboard del cliente (solo datos NETOS)

**Response:**
```json
{
  "success": true,
  "profile": {
    "displayName": "Juan Pérez",
    "companyName": "Hotel Del Mar"
  },
  "machines": [...],
  "revenue": {
    "daily": {
      "total": 178.57,  // NETO (no bruto)
      "machines": [
        {
          "id": "uuid",
          "name": "Máquina A",
          "location": "Recepción",
          "amountNet": 89.20
        }
      ],
      "lastUpdate": "2024-03-04T10:00:00Z"
    },
    "weekly": {...},
    "monthly": {...}
  },
  "lastScrape": {
    "id": "uuid",
    "status": "completed",
    "startedAt": "2024-03-04T10:00:00Z",
    "finishedAt": "2024-03-04T10:01:30Z"
  }
}
```

#### `POST /api/client/refresh`
Ejecutar scraping (actualizar datos)

**Response:**
```json
{
  "success": true,
  "scrapeRunId": "uuid",
  "machinesScraped": 10,
  "snapshotsCreated": 30,
  "scrapedAt": "2024-03-04T10:00:00Z"
}
```

---

## 🤖 Scraping

### **Proceso del Scraper**

El nuevo scraper (`machine-revenue-scraper.ts`) realiza:

1. Login en Orain
2. Navegar a **Datos > Máquinas**
3. Configurar mostrar **100 entradas** (evitar paginación)
4. **Por cada periodo** (daily, weekly, monthly):
   - Cambiar filtro de fecha:
     - Daily: "Hoy"
     - Weekly: "Últimos 7 días"
     - Monthly: "Este mes"
   - Extraer datos de tabla "Información Máquinas":
     - Nombre de la máquina
     - Ubicación
     - Compras anónimas (total)
     - Anónimas tarjeta
     - Anónimas efectivo
5. Guardar snapshots en DB

### **Uso del Scraper**

#### **Mock (para desarrollo)**
```typescript
import { runOrainMachineScrape } from '@/scraper/machine-revenue-scraper';

const result = await runOrainMachineScrape(true); // true = usar mock
```

#### **Real (con credenciales)**
```typescript
const result = await runOrainMachineScrape(false); // false = scraping real
```

### **Datos Scrapeados**

```typescript
interface MachineRevenueData {
  machineName: string;        // "ADELTE 5110"
  location: string;           // "ADELTE"
  anonymousTotal: number;     // 115.90
  anonymousCard: number;      // 76.00
  anonymousCash: number;      // 39.90
  period: 'daily' | 'weekly' | 'monthly';
  scrapedAt: Date;
}
```

---

## 🔒 Seguridad

### **✅ Checklist de Seguridad Implementado**

#### **1. Row Level Security (RLS)**

✅ **Profiles**: Cliente solo ve su perfil, admin ve todo  
✅ **Client Settings**: Cliente NO puede ver sus settings (evita conocer %)  
✅ **Machines**: Cliente solo ve máquinas asignadas  
✅ **Assignments**: Cliente solo ve sus asignaciones  
✅ **Revenue Snapshots**: Cliente solo ve snapshots de sus máquinas  

#### **2. Separación de Datos**

✅ **Cliente NUNCA recibe**:
- `amount_gross` (recaudación bruta)
- `commission_hide_percent` (porcentaje de comisión)

✅ **Cliente SOLO recibe**:
- `amount_net` (calculado en backend)
- Datos de sus máquinas asignadas

#### **3. Cálculo Backend**

✅ **Función SQL `get_client_net_revenue()`**:
```sql
-- Cálculo servidor-side, cliente no puede modificar
ROUND(amount_gross * (1 - commission_hide_percent / 100.0), 2) AS amount_net
```

#### **4. Validación de Permisos**

✅ Todos los endpoints verifican:
1. Autenticación (token JWT válido)
2. Rol del usuario (admin vs client)
3. RLS policies en Supabase

#### **5. Service Role vs Anon Key**

✅ **Service Role** (server-side only):
- Operaciones admin
- Bypass RLS cuando necesario

✅ **Anon Key** (client-side):
- Respeta RLS policies
- Cliente no puede elevar privilegios

### **⚠️ Puntos Críticos**

#### **QUÉ NUNCA DEBE VER EL CLIENTE**

❌ `amount_gross` en snapshots  
❌ `commission_hide_percent` en settings  
❌ Diferencia entre bruto y neto  
❌ Máquinas no asignadas  

#### **QUÉ SÍ PUEDE VER EL CLIENTE**

✅ `amount_net` (recaudación con comisión aplicada)  
✅ Sus máquinas asignadas  
✅ Histórico de scrape runs propios  
✅ Última actualización  

---

## 🧪 Testing

### **Datos de Prueba (Seed)**

Después de ejecutar `002_seed_data.sql`:

#### **Admin**
- Email: `admin@lifyvending.com`
- ID: `00000000-0000-0000-0000-000000000001`

#### **Clientes**

**Hotel Del Mar**
- Email: `hotel.delmar@example.com`
- ID: `00000000-0000-0000-0000-000000000002`
- Comisión: 30%
- Máquinas: 3 (CLUB DE MAR 5172, 5173, HOTEL LIS 5159)

**Gimnasio Atom**
- Email: `gimnasio.atom@example.com`
- ID: `00000000-0000-0000-0000-000000000003`
- Comisión: 25%
- Máquinas: 4 (ANYTIME 5187, ATOM SPORT 5165, etc.)

### **Pruebas Manuales**

#### **Como Cliente**
1. Login con `hotel.delmar@example.com`
2. Ver dashboard → debe mostrar solo 3 máquinas
3. Verificar importes son NETOS (70% del bruto)
4. Click "Actualizar datos" → debe ejecutar scraping mock
5. Recargar → ver nuevos datos

#### **Como Admin**
1. Login con `admin@lifyvending.com`
2. Ir a "Gestión de Clientes"
3. Crear nuevo cliente
4. Asignar máquinas
5. Cambiar porcentaje → verificar que cambia neto
6. Ver overview → verificar bruto vs neto

### **Verificar Seguridad**

```sql
-- Como cliente, intentar ver bruto (debe fallar o devolver vacío)
SELECT amount_gross FROM machine_revenue_snapshots LIMIT 1;

-- Como cliente, intentar ver settings de otro cliente (debe fallar)
SELECT * FROM client_settings WHERE client_id != auth.uid();

-- Como cliente, intentar ver máquinas no asignadas (debe devolver vacío)
SELECT * FROM machines WHERE id NOT IN (
  SELECT machine_id FROM client_machine_assignments WHERE client_id = auth.uid()
);
```

---

## 🚀 Deployment

### **Vercel + Supabase (Recomendado)**

#### **1. Desplegar Supabase**
- Ya está en cloud si usas Supabase.com
- Ejecutar migraciones en producción

#### **2. Desplegar en Vercel**

```bash
# Instalar Vercel CLI
npm i -g vercel

# Desplegar
vercel

# Configurar variables de entorno en Vercel Dashboard
```

Variables de entorno necesarias en Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `USE_MOCK_SCRAPER=false` (para scraping real)
- `ORAIN_USERNAME` (opcional)
- `ORAIN_PASSWORD` (opcional)

#### **3. Configurar Dominio**
- Añadir dominio custom en Vercel
- Configurar SSL automático

---

## 📊 Monitoreo

### **Logs Importantes**

```typescript
// Server logs (Ver en Vercel Logs)
console.log('🚀 Scrape run iniciado:', scrapeRunId);
console.log('✅ Scrape run completado:', machinesScraped);
console.log('❌ Error en scraping:', error);
```

### **Queries Útiles**

```sql
-- Últimos scrape runs
SELECT * FROM scrape_runs 
ORDER BY started_at DESC 
LIMIT 10;

-- Clientes con más recaudación (este mes)
SELECT 
  p.company_name,
  SUM(mrs.amount_gross) as total_bruto
FROM profiles p
JOIN client_machine_assignments cma ON cma.client_id = p.id
JOIN machine_revenue_snapshots mrs ON mrs.machine_id = cma.machine_id
WHERE mrs.period = 'monthly'
GROUP BY p.id
ORDER BY total_bruto DESC;

-- Máquinas sin asignar
SELECT * FROM machines 
WHERE id NOT IN (SELECT machine_id FROM client_machine_assignments);
```

---

## 🆘 Troubleshooting

### **Error: "No autorizado"**
- Verificar que el token JWT es válido
- Comprobar que el usuario existe en `profiles`

### **Error: RLS policy violation**
- Verificar que el usuario tiene el rol correcto
- Comprobar que las policies están habilitadas

### **El scraping no funciona**
- Verificar credenciales `ORAIN_USERNAME` y `ORAIN_PASSWORD`
- Usar `USE_MOCK_SCRAPER=true` temporalmente
- Revisar logs del navegador Puppeteer

### **Cliente ve bruto en lugar de neto**
- ⚠️ **CRÍTICO**: Revisar que endpoint usa `get_client_net_revenue()`
- Verificar que frontend no expone `amount_gross`

---

## 📝 Notas Finales

### **Mejoras Futuras**

- [ ] Notificaciones por email de scraping completado
- [ ] Exportar reportes PDF/Excel
- [ ] Dashboard con gráficos (Chart.js)
- [ ] Logs de auditoría detallados
- [ ] App móvil (React Native)
- [ ] Multi-idioma (i18n)

### **Mantenimiento**

- Backup diario de Supabase (automático en plan Pro)
- Revisar scrape_runs con errores semanalmente
- Actualizar dependencias mensualmente

---

## 📞 Soporte

Para dudas o problemas:
1. Revisar logs en Vercel/Supabase
2. Comprobar políticas RLS
3. Verificar variables de entorno

---

**Desarrollado con ❤️ para Lify Vending**
