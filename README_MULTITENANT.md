# 🏢 Sistema Multi-Tenant de Vending - Lify Vending

Sistema web completo para gestión de clientes de vending con ocultación de comisiones y scraping automático de recaudación.

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Latest-green)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-Proprietary-red)]()

---

## 🎯 Descripción

Sistema que permite a empresas de vending gestionar múltiples clientes mostrando recaudaciones con comisión aplicada de forma transparente. Los clientes acceden a un dashboard donde ven **únicamente** su recaudación neta, sin conocer el porcentaje de comisión aplicado.

### **Características Principales**

✅ **Autenticación segura** con Supabase Auth  
✅ **Roles diferenciados**: Admin y Cliente  
✅ **Ocultación de comisiones** mediante cálculo backend  
✅ **Row Level Security (RLS)** en base de datos  
✅ **Scraping automático** de datos de Orain  
✅ **Dashboard responsive** con Tailwind CSS  
✅ **API REST** completa y documentada  

---

## 🚀 Inicio Rápido

### **Requisitos**
- Node.js 18+
- pnpm (o npm/yarn)
- Cuenta Supabase (gratuita)

### **Instalación (15 minutos)**

```bash
# 1. Instalar dependencias
pnpm install

# 2. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus claves de Supabase

# 3. Ejecutar migraciones en Supabase
# Ver QUICKSTART.md para instrucciones detalladas

# 4. Ejecutar en desarrollo
pnpm dev
```

Abrir http://localhost:3000

📖 **Guía completa**: Ver [QUICKSTART.md](./QUICKSTART.md)

---

## 📚 Documentación

| Documento | Descripción |
|-----------|-------------|
| [QUICKSTART.md](./QUICKSTART.md) | Guía rápida de instalación (15 min) |
| [MULTI_TENANT_DOCS.md](./MULTI_TENANT_DOCS.md) | Documentación técnica completa |
| [SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md) | Checklist de seguridad implementado |
| [API_EXAMPLES.md](./API_EXAMPLES.md) | Ejemplos de uso de API con curl/JS |
| [RESUMEN_EJECUTIVO.md](./RESUMEN_EJECUTIVO.md) | Resumen ejecutivo del proyecto |

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Admin UI    │  │  Cliente UI  │  │  Login/Auth  │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                 │                  │         │
│         └─────────────────┼──────────────────┘         │
│                           ↓                            │
│  ┌──────────────────────────────────────────────────┐ │
│  │           API Routes (Backend Logic)             │ │
│  │  /api/admin/*  |  /api/client/*                  │ │
│  └────────────────────┬─────────────────────────────┘ │
└───────────────────────┼───────────────────────────────┘
                        ↓
        ┌───────────────────────────────┐
        │   SUPABASE (PostgreSQL)       │
        │  ┌─────────────────────────┐  │
        │  │  Row Level Security     │  │
        │  │  - profiles             │  │
        │  │  - client_settings      │  │
        │  │  - machines             │  │
        │  │  - revenue_snapshots    │  │
        │  └─────────────────────────┘  │
        └───────────────┬───────────────┘
                        ↑
                        │
        ┌───────────────────────────────┐
        │   SCRAPER (Puppeteer)         │
        │  dashboard.orain.io           │
        │  → Datos > Máquinas           │
        │  → 3 periodos (D/W/M)         │
        └───────────────────────────────┘
```

---

## 🔐 Seguridad

### **Principio Fundamental**

El cliente **NUNCA** puede inferir:
- Recaudación bruta real
- Porcentaje de comisión aplicado
- Diferencia entre bruto y neto

### **Implementación**

✅ **Row Level Security (RLS)** en todas las tablas  
✅ **Cálculo server-side** de recaudación neta  
✅ **API validada** con JWT + verificación de roles  
✅ **Funciones SQL** con `SECURITY DEFINER`  
✅ **Cliente nunca recibe** `amount_gross` ni `commission_percent`  

**Fórmula de Neto**:
```
Neto = Bruto × (1 - Porcentaje / 100)

Ejemplo: 100€ bruto con 30% comisión
→ Cliente ve: 70€ neto
```

📖 **Detalles**: Ver [SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md)

---

## 📂 Estructura del Proyecto

```
NewLifyVending/
├── app/
│   ├── api/                    # Endpoints API
│   │   ├── admin/             # 7 endpoints admin
│   │   └── client/            # 2 endpoints cliente
│   ├── admin/                 # UI admin
│   │   ├── clients-management/
│   │   └── clients/[id]/
│   └── client/                # UI cliente
│       └── dashboard/
├── lib/
│   ├── database.types.ts      # Tipos TypeScript
│   ├── supabase-helpers.ts    # Helpers DB
│   └── utils.ts
├── scraper/
│   └── machine-revenue-scraper.ts  # Scraper completo
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql  # Schema + RLS
│       └── 002_seed_data.sql       # Datos prueba
├── components/ui/             # shadcn/ui components
├── .env.example
└── [Documentación...]
```

---

## 🔌 API Endpoints

### **Admin**
- `POST /api/admin/users` - Crear cliente
- `GET /api/admin/clients` - Listar clientes
- `GET /api/admin/clients/[id]/overview` - Overview bruto vs neto
- `POST /api/admin/assignments` - Asignar máquinas
- `PUT /api/admin/client-settings/[id]` - Actualizar comisión
- `POST /api/admin/users/[id]/reset-password` - Resetear password
- `GET /api/admin/machines` - Listar máquinas

### **Cliente**
- `GET /api/client/dashboard` - Dashboard (solo neto)
- `POST /api/client/refresh` - Ejecutar scraping

📖 **Ejemplos**: Ver [API_EXAMPLES.md](./API_EXAMPLES.md)

---

## 🗄️ Base de Datos

### **Tablas Principales**

| Tabla | Descripción |
|-------|-------------|
| `profiles` | Usuarios (admin/client) |
| `client_settings` | Configuración de comisión por cliente |
| `machines` | Máquinas de vending |
| `client_machine_assignments` | Asignación N:M cliente-máquina |
| `machine_revenue_snapshots` | Snapshots de recaudación BRUTA |
| `scrape_runs` | Auditoría de scraping |

### **Funciones SQL**

- `get_client_net_revenue(client_id, period)` - Calcula recaudación neta
- `get_admin_client_overview(client_id)` - Overview bruto vs neto

---

## 🤖 Scraping

### **Proceso**

1. Login en dashboard.orain.io
2. Navegar a **Datos > Máquinas**
3. Configurar **100 entradas** (sin paginación)
4. **Por cada periodo** (daily, weekly, monthly):
   - Cambiar filtro de fecha
   - Extraer datos de tabla
   - Guardar snapshot bruto

### **Datos Recolectados**

- Nombre de la máquina
- Ubicación
- Compras anónimas (total)
- Anónimas tarjeta
- Anónimas efectivo

### **Modo Mock**

Para desarrollo sin credenciales:
```env
USE_MOCK_SCRAPER=true
```

---

## 🧪 Testing

### **Datos de Prueba**

Después de ejecutar `002_seed_data.sql`:

**Admin**: `admin@lifyvending.com` (crear password manualmente)

**Clientes**:
- `hotel.delmar@example.com` (30% comisión, 3 máquinas)
- `gimnasio.atom@example.com` (25% comisión, 4 máquinas)

### **Verificar Seguridad**

```sql
-- Como cliente, intentar ver bruto (debe fallar)
SELECT amount_gross FROM machine_revenue_snapshots;

-- Como cliente, intentar ver settings (debe fallar)
SELECT * FROM client_settings;
```

---

## 🚀 Deployment

### **Vercel + Supabase**

1. **Deploy Supabase**:
   - Ejecutar migraciones en producción
   - Anotar URL y keys

2. **Deploy Vercel**:
   ```bash
   vercel
   ```

3. **Variables de Entorno** (Vercel Dashboard):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `USE_MOCK_SCRAPER=false` (producción)
   - `ORAIN_USERNAME` (opcional)
   - `ORAIN_PASSWORD` (opcional)

📖 **Detalles**: Ver [MULTI_TENANT_DOCS.md#deployment](./MULTI_TENANT_DOCS.md#deployment)

---

## 📊 Stack Tecnológico

| Tecnología | Uso |
|------------|-----|
| **Next.js 14** | Framework React (App Router) |
| **TypeScript** | Type safety |
| **Tailwind CSS** | Estilos utility-first |
| **shadcn/ui** | Componentes UI |
| **Supabase** | Backend as a Service (Auth + DB) |
| **PostgreSQL** | Base de datos relacional |
| **Puppeteer** | Scraping web |
| **Vercel** | Hosting y deployment |

---

## 📈 Roadmap

### **Versión 1.0** (Actual) ✅
- [x] Autenticación y roles
- [x] CRUD de clientes
- [x] Asignación de máquinas
- [x] Cálculo de comisiones
- [x] Scraping de recaudación
- [x] Dashboards admin y cliente
- [x] RLS completo

### **Versión 1.1** (Próxima)
- [ ] Gráficos de tendencias
- [ ] Exportar reportes PDF/Excel
- [ ] Notificaciones email
- [ ] Logs de auditoría detallados

### **Versión 2.0** (Futuro)
- [ ] App móvil (React Native)
- [ ] Multi-idioma (i18n)
- [ ] Dashboard analytics avanzado
- [ ] Integración con contabilidad

---

## 🤝 Contribuir

Proyecto propietario de Lify Vending. Para cambios o mejoras, contactar con el equipo de desarrollo.

---

## 📝 Licencia

Propietario - Lify Vending © 2024

---

## 📞 Soporte

**Documentación**:
- [QUICKSTART.md](./QUICKSTART.md) - Inicio rápido
- [MULTI_TENANT_DOCS.md](./MULTI_TENANT_DOCS.md) - Documentación completa
- [SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md) - Seguridad
- [API_EXAMPLES.md](./API_EXAMPLES.md) - Ejemplos API

**Contacto**: [tu-email-soporte]

---

**Desarrollado con ❤️ para Lify Vending**  
**Versión**: 1.0.0 | **Fecha**: Marzo 2024
