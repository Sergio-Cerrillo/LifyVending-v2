# Panel de Administración - Lify Vending

Panel de administración completo tipo mini-ERP para gestión de una empresa de vending.

## 🚀 Características

### ✅ Sistema de Autenticación
- **3 roles implementados:**
  - `admin`: Acceso total al sistema
  - `gestor`: Acceso a facturas y nóminas (puede descargar y marcar como contabilizadas)
  - `operador`: Puede ver máquinas, subir incidencias y documentos (sin permisos de eliminación)

### 📊 Dashboard Principal
- Resumen de métricas en tiempo real:
  - Máquinas activas
  - Facturas pendientes de revisar
  - Facturas pendientes de contabilizar
  - Incidencias abiertas
  - Recaudación total del mes
  - Nóminas subidas este mes
- Gráficos de recaudación por máquina
- Estadísticas generales

### 📄 Módulo de Documentos/Facturas
Sistema completo que reemplaza Google Drive:

**Tipos de documentos:**
- RECIBIDA (facturas de proveedores)
- ABONADA (facturas emitidas a clientes)

**Campos:**
- Título, contrapartida, importe, número de factura
- Fecha de factura
- Estados: Revisión (PENDIENTE/REVISADA) y Contabilidad (PENDIENTE/CONTABILIZADA)
- Tags, notas, visibilidad (EMPRESA/GESTOR/AMBOS)
- Periodo contable (autogenerado)
- Historial de eventos

**Funcionalidades:**
- Filtros avanzados (tipo, estado, fechas, importes)
- Búsqueda por título, contrapartida o número
- Marcar como revisada/contabilizada
- Descargar documentos
- Editar metadatos
- Eliminar (solo admin)

### 🤖 Módulo de Máquinas
Gestión completa del parque de máquinas:

**Datos de máquinas:**
- Número, tipo (snack/bebida/café/mixta)
- Marca, modelo, número de serie
- Lector de tarjeta y telemetría
- Ubicación (nombre, dirección, contacto)
- Estado (ACTIVA/ALMACEN/AVERIADA/RETIRADA)
- Porcentaje de comisión
- Documentos asociados (contratos, anexos, fotos)

**Funcionalidades:**
- Filtros por tipo, estado, características
- Búsqueda por número, ubicación, marca o modelo
- Crear y editar máquinas
- Cambiar estado
- Ver historial

### 💰 Módulo de Recaudaciones
Control de recaudaciones por máquina:

**Datos:**
- Máquina, fecha, efectivo, tarjeta, total
- Recaudado por (operador)
- Notas

**Funcionalidades:**
- Filtro por máquina y fechas
- Estadísticas (total efectivo, tarjeta, general)
- Histórico completo
- Exportar CSV (mock)

### ⚠️ Módulo de Incidencias
Gestión de incidencias y averías:

**Tipos:**
- Eléctrica, atasco, lector, vandalismo, otro

**Estados:**
- ABIERTA, EN_PROCESO, CERRADA

**Funcionalidades:**
- Crear incidencia con descripción
- Asignar a técnico
- Subir fotos
- Cambiar estado
- Filtros por estado, tipo, máquina
- Historial por máquina

### 👥 Módulo de Nóminas
Gestión de nóminas de empleados:

**Empleados iniciales:**
- Soledad (Gerente)
- Fernando (Operador)

**Datos de nómina:**
- Empleado, mes, año
- Bruto, neto, coste empresa
- Estado (PENDIENTE/REVISADA)
- Archivo PDF asociado

**Funcionalidades:**
- Filtro por empleado y año
- Subir nómina PDF
- Marcar como revisada
- Descargar
- Estadísticas de costes

## 🛠️ Tecnologías Utilizadas

- **Next.js 16** - Framework React
- **TypeScript** - Tipado estático
- **Tailwind CSS** - Estilos
- **Radix UI** - Componentes accesibles
- **Recharts** - Gráficos
- **date-fns** - Manejo de fechas
- **Sonner** - Notificaciones toast
- **React Hook Form + Zod** - Formularios y validación

## 📁 Estructura del Proyecto

```
app/
  admin/
    layout.tsx                    # Layout del panel admin
    page.tsx                      # Dashboard principal
    documentos/page.tsx           # Gestión de documentos
    maquinas/page.tsx             # Gestión de máquinas
    recaudaciones/page.tsx        # Recaudaciones
    incidencias/page.tsx          # Incidencias
    nominas/page.tsx              # Nóminas
    proveedores/page.tsx          # Placeholder
    configuracion/page.tsx        # Placeholder

components/
  admin/
    admin-layout.tsx              # Layout con sidebar y topbar
    dashboard-page.tsx            # Componente del dashboard
    documents-page.tsx            # Gestión de documentos
    machines-page.tsx             # Gestión de máquinas
    collections-page.tsx          # Recaudaciones
    incidents-page.tsx            # Incidencias
    payrolls-page.tsx             # Nóminas
    status-badge.tsx              # Badge de estados

contexts/
  auth-context.tsx                # Contexto de autenticación
  data-context.tsx                # Contexto de datos (mock)

lib/
  types.ts                        # Tipos TypeScript
  mock-data.ts                    # Datos de prueba
  utils.ts                        # Utilidades
```

## 🚦 Cómo Iniciar

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Iniciar servidor de desarrollo:**
   ```bash
   npm run dev
   ```

3. **Acceder al panel:**
   ```
   http://localhost:3000/admin
   ```

## 👤 Usuarios de Prueba

El sistema inicia con un usuario admin por defecto:

```typescript
// Para cambiar de usuario, modifica en el navegador:
// localStorage.setItem('currentUser', JSON.stringify(mockUsers[0])) // Admin
// localStorage.setItem('currentUser', JSON.stringify(mockUsers[1])) // Gestor
// localStorage.setItem('currentUser', JSON.stringify(mockUsers[2])) // Operador
```

**Usuarios disponibles:**
- admin@lifyvending.com (Admin)
- gestor@lifyvending.com (Gestor)
- operador@lifyvending.com (Operador)

## 🔌 Preparado para Backend Real

El sistema está estructurado para conectar fácilmente con un API REST:

**Endpoints sugeridos:**
```
Documents:
  GET    /api/docs
  POST   /api/docs
  PATCH  /api/docs/:id
  DELETE /api/docs/:id

Machines:
  GET    /api/machines
  POST   /api/machines
  PATCH  /api/machines/:id

Collections:
  GET    /api/collections
  POST   /api/collections

Incidents:
  GET    /api/incidents
  POST   /api/incidents
  PATCH  /api/incidents/:id

Payrolls:
  GET    /api/payrolls
  POST   /api/payrolls
  PATCH  /api/payrolls/:id
```

Para conectar con backend:
1. Reemplazar los hooks en `contexts/data-context.tsx` con llamadas a API
2. Implementar autenticación real en `contexts/auth-context.tsx`
3. Configurar subida de archivos a S3 o similar

## 🎨 Características de UI/UX

- **Responsive**: Funciona perfectamente en móvil, tablet y desktop
- **Dark Mode**: Soporte completo de tema oscuro
- **Sidebar colapsable**: En móvil se convierte en drawer
- **Filtros avanzados**: En todas las tablas
- **Búsqueda en tiempo real**: Filtrado instantáneo
- **Badges de estado**: Codificados por color según estado
- **Notificaciones toast**: Feedback inmediato de acciones
- **Permisos por rol**: Acciones restringidas según rol

## 🔐 Control de Permisos

| Acción | Admin | Gestor | Operador |
|--------|-------|--------|----------|
| Ver dashboard | ✅ | ✅ | ✅ |
| Ver documentos | ✅ | ✅ | ✅ |
| Subir documentos | ✅ | ✅ | ✅ |
| Marcar revisada | ✅ | ✅ | ❌ |
| Marcar contabilizada | ✅ | ✅ | ❌ |
| Eliminar documentos | ✅ | ❌ | ❌ |
| Gestionar máquinas | ✅ | ✅ | Ver |
| Crear incidencias | ✅ | ✅ | ✅ |
| Gestionar nóminas | ✅ | ✅ | ❌ |
| Configuración | ✅ | ❌ | ❌ |

## 📝 Próximas Mejoras

- [ ] Módulo de Proveedores completo
- [ ] Módulo de Usuarios/Gestión de permisos
- [ ] Diálogos de creación/edición para todos los módulos
- [ ] Subida de archivos real
- [ ] Exportación de reportes PDF/Excel
- [ ] Sistema de notificaciones
- [ ] Calendario de tareas
- [ ] Dashboard con más gráficos e insights
- [ ] Sistema de alertas automáticas
- [ ] API REST completa

## 💡 Notas de Desarrollo

- Todos los datos son **mock** y se almacenan en memoria
- Los archivos se simulan con URLs de prueba
- La autenticación es simulada (en producción implementar JWT/OAuth)
- Las fechas usan `date-fns` con locale español
- Los formularios usan `react-hook-form` + `zod` para validación
- Todas las tablas son responsive y paginables
- El código sigue las mejores prácticas de React y TypeScript

---

**Desarrollado con ❤️ para Lify Vending**
