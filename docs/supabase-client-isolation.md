# Separar clientes en cuentas/proyectos Supabase independientes

## Decision recomendada

Para evitar bloqueos por exceso de llamadas compartidas, cada cliente debe tener:

- Su propia cuenta/usuario u organizacion de Supabase.
- Un unico proyecto Supabase dentro de esa cuenta.
- Sus propias variables `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`.
- Su propio despliegue de Vercel, o al menos un environment/deployment separado con variables distintas.

No basta con crear mas usuarios dentro del mismo proyecto Supabase: eso separa permisos, pero no separa cuota ni carga de API.

## Que hay que modificar en la app

La app ya esta preparada para apuntar a un solo proyecto Supabase mediante variables de entorno:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Por eso, para cada cliente aislado no hace falta cambiar codigo si cada despliegue tiene sus propias variables.

Si quieres mantener todos los clientes desde una unica instancia de admin central, entonces si habria que cambiar codigo: habria que crear un router multi-Supabase que elija las keys segun cliente/dominio. No lo recomiendo como primera fase porque aumenta riesgo y puede volver a concentrar llamadas.

## Variables a copiar por cliente

En cada despliegue nuevo configura:

```txt
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
CRON_SECRET=...

FREKUENT_USERNAME=...
FREKUENT_PASSWORD=...

# Si aplica
ORAIN_USERNAME=...
ORAIN_PASSWORD=...
ORAIN_USER=...
ORAIN_PASS=...
TELEVEND_USERNAME=...
TELEVEND_PASSWORD=...

# Browserless en produccion
SCRAPER_USE_BROWSERLESS=true
BROWSERLESS_API_KEY=...
BROWSERLESS_WS_ENDPOINT=...
BROWSERLESS_PLAYWRIGHT_WS_ENDPOINT=...
BROWSERLESS_TIMEOUT_SECONDS=900

# Controles UI
NEXT_PUBLIC_ENABLE_MANUAL_SCRAPING=true
```

Usa credenciales Frekuent/Televend especificas del cliente siempre que sea posible. Si reutilizas la misma cuenta externa de Frekuent en todos los clientes, solo habras movido el cuello de botella desde Supabase hacia Frekuent/Browserless.

## Bootstrap de la base nueva

Ejecuta en el SQL Editor del nuevo proyecto:

```txt
supabase/bootstrap-new-client-project.sql
```

Ese script crea:

- `profiles`
- `client_settings`
- `machines`
- `client_machine_assignments`
- `machine_revenue_snapshots`
- `scrape_runs`
- `machine_stock_current`
- `stock_products_current`
- `commission_snapshots`
- `app_settings`
- `revenue_scrape_jobs`
- `client_revenue_history_adjustments`
- funciones RPC y triggers necesarios
- RLS basico compatible con la app actual

## Alta inicial de usuarios

Opcion A, desde Supabase Auth:

1. Crea un usuario admin.
2. En `raw_user_meta_data`, pon:

```json
{
  "role": "admin",
  "name": "Admin"
}
```

3. El trigger creara su fila en `profiles`.
4. Si el perfil no aparece, inserta manualmente una fila en `profiles` con el mismo `id` del usuario Auth.

Opcion B, desde la app:

1. Entra con un admin ya creado.
2. Crea el cliente desde el panel.
3. Ejecuta scraping.
4. Asigna maquinas al cliente.

## Migrar datos de un cliente existente

Orden recomendado:

1. En el proyecto antiguo, identifica el `client_id` del cliente.
2. Exporta solo sus datos:
   - fila de `profiles`
   - fila de `client_settings`
   - maquinas asignadas desde `client_machine_assignments`
   - filas de `machines` para esas maquinas
   - stock actual de esas maquinas
   - historico manual de `client_revenue_history_adjustments`
   - snapshots/comisiones si quieres conservar historico
3. En el proyecto nuevo, crea primero usuarios Auth. Los ids de `profiles.id` deben existir en `auth.users`.
4. Importa `profiles`, despues `client_settings`, despues `machines`, despues asignaciones y datos dependientes.
5. Ejecuta un scraping manual para refrescar recaudacion y stock.
6. Valida login de admin y cliente.

Si no necesitas historico, es mas seguro empezar limpio:

1. Crear proyecto.
2. Ejecutar bootstrap.
3. Crear admin y cliente.
4. Configurar credenciales del proveedor.
5. Ejecutar scraping.
6. Asignar maquinas.

## Cambios en Vercel

La forma mas simple:

1. Duplica el proyecto Vercel por cliente.
2. Conecta el mismo repo/branch.
3. Configura variables del cliente.
4. Configura dominio/subdominio del cliente.
5. Deja el cron activo solo donde corresponda.

Importante: si duplicas despliegues y todos tienen el mismo cron activo contra la misma cuenta Frekuent, puedes generar exceso de scraping. Cada despliegue debe tener solo las credenciales/proveedores de ese cliente.

## Checklist por cliente

- Cuenta/usuario Supabase independiente creado.
- Proyecto Supabase creado.
- SQL bootstrap ejecutado.
- Admin Auth creado y con perfil `admin`.
- Cliente Auth creado y con perfil `client`.
- Variables Vercel del cliente configuradas.
- Build/deploy correcto.
- Login admin correcto.
- Login cliente correcto.
- Scraping manual correcto.
- Maquinas creadas.
- Maquinas asignadas al cliente.
- Cron activado.
- Proyecto antiguo ya no hace scraping para ese cliente.
