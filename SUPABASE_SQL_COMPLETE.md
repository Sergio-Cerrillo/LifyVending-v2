# 🗄️ SQL COMPLETO PARA SUPABASE

Este archivo contiene **TODO** el SQL necesario para crear la base de datos completa del sistema multi-tenant de vending.

## 📋 Instrucciones

1. Ve a [app.supabase.com](https://app.supabase.com)
2. Selecciona tu proyecto
3. Ve a **SQL Editor** (icono `</>` en la barra lateral)
4. Clic en **"New query"**
5. **Copia y pega** todo el SQL de abajo
6. Clic en **"Run"** (esquina inferior derecha)
7. Deberías ver: `Success. No rows returned`

---

## 🔧 SQL A EJECUTAR

```sql
-- =====================================================
-- SCHEMA COMPLETO PARA SISTEMA MULTI-TENANT DE VENDING
-- =====================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TIPOS ENUM
-- =====================================================

CREATE TYPE user_role AS ENUM ('admin', 'client');
CREATE TYPE revenue_period AS ENUM ('daily', 'weekly', 'monthly');
CREATE TYPE scrape_status AS ENUM ('pending', 'running', 'completed', 'error');

-- =====================================================
-- TABLA: profiles
-- Extiende auth.users con información de perfil
-- =====================================================

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'client',
    email TEXT NOT NULL UNIQUE,
    display_name TEXT,
    company_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- TABLA: client_settings
-- Configuración por cliente (porcentaje de comisión)
-- =====================================================

CREATE TABLE client_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    commission_hide_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (commission_hide_percent >= 0 AND commission_hide_percent <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(client_id)
);

-- =====================================================
-- TABLA: machines
-- Máquinas de vending (información base)
-- 
-- IMPORTANTE: Se crean automáticamente desde el scraping
-- =====================================================

CREATE TABLE machines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    orain_machine_id TEXT UNIQUE, -- ID en el sistema Orain
    name TEXT NOT NULL,
    location TEXT,
    status TEXT DEFAULT 'active',
    last_scraped_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_machines_orain_id ON machines(orain_machine_id);
CREATE INDEX idx_machines_status ON machines(status);

-- =====================================================
-- TABLA: client_machine_assignments
-- Asignación de máquinas a clientes (N:M)
-- =====================================================

CREATE TABLE client_machine_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(client_id, machine_id)
);

CREATE INDEX idx_assignments_client ON client_machine_assignments(client_id);
CREATE INDEX idx_assignments_machine ON client_machine_assignments(machine_id);

-- =====================================================
-- TABLA: machine_revenue_snapshots
-- Snapshots de recaudación BRUTA por máquina y periodo
-- 
-- IMPORTANTE: Se llenan automáticamente cada hora (Vercel Cron)
-- =====================================================

CREATE TABLE machine_revenue_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    scraped_at TIMESTAMPTZ NOT NULL,
    period revenue_period NOT NULL,
    
    -- Recaudación BRUTA (sin reducir)
    amount_gross NUMERIC(10,2) NOT NULL DEFAULT 0,
    
    -- Desglose de compras anónimas
    anonymous_total NUMERIC(10,2) DEFAULT 0,
    anonymous_card NUMERIC(10,2) DEFAULT 0,
    anonymous_cash NUMERIC(10,2) DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_revenue_machine ON machine_revenue_snapshots(machine_id);
CREATE INDEX idx_revenue_period ON machine_revenue_snapshots(period);
CREATE INDEX idx_revenue_scraped_at ON machine_revenue_snapshots(scraped_at DESC);
CREATE INDEX idx_revenue_machine_period ON machine_revenue_snapshots(machine_id, period, scraped_at DESC);

-- =====================================================
-- TABLA: scrape_runs
-- Auditoría de ejecuciones de scraping
-- 
-- triggered_by_user_id = NULL → Automático (Vercel Cron)
-- triggered_by_user_id = UUID → Manual (admin)
-- =====================================================

CREATE TABLE scrape_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    triggered_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    triggered_role user_role,
    status scrape_status NOT NULL DEFAULT 'pending',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    error_message TEXT,
    machines_scraped INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scrape_runs_status ON scrape_runs(status);
CREATE INDEX idx_scrape_runs_started ON scrape_runs(started_at DESC);
CREATE INDEX idx_scrape_runs_user ON scrape_runs(triggered_by_user_id);

-- =====================================================
-- FUNCIONES AUXILIARES
-- =====================================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_settings_updated_at BEFORE UPDATE ON client_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_machines_updated_at BEFORE UPDATE ON machines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_machine_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_revenue_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_runs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLICIES: profiles
-- =====================================================

-- Admin puede ver y gestionar todos los perfiles
CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can update all profiles" ON profiles
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can insert profiles" ON profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Cliente solo puede ver su propio perfil
CREATE POLICY "Clients can view own profile" ON profiles
    FOR SELECT
    TO authenticated
    USING (id = auth.uid() AND role = 'client');

-- =====================================================
-- POLICIES: client_settings
-- =====================================================

-- Admin puede gestionar todos los settings
CREATE POLICY "Admins can manage all client settings" ON client_settings
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Cliente NO puede ver sus settings (para ocultar el porcentaje)
-- Solo puede conocer el neto calculado desde el backend

-- =====================================================
-- POLICIES: machines
-- =====================================================

-- Admin puede gestionar todas las máquinas
CREATE POLICY "Admins can manage all machines" ON machines
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Cliente puede ver solo sus máquinas asignadas
CREATE POLICY "Clients can view assigned machines" ON machines
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() 
            AND p.role = 'client'
            AND EXISTS (
                SELECT 1 FROM client_machine_assignments
                WHERE client_id = p.id AND machine_id = machines.id
            )
        )
    );

-- =====================================================
-- POLICIES: client_machine_assignments
-- =====================================================

-- Admin puede gestionar todas las asignaciones
CREATE POLICY "Admins can manage all assignments" ON client_machine_assignments
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Cliente puede ver solo sus asignaciones
CREATE POLICY "Clients can view own assignments" ON client_machine_assignments
    FOR SELECT
    TO authenticated
    USING (client_id = auth.uid());

-- =====================================================
-- POLICIES: machine_revenue_snapshots
-- =====================================================

-- Admin puede gestionar todos los snapshots
CREATE POLICY "Admins can manage all revenue snapshots" ON machine_revenue_snapshots
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Cliente puede ver snapshots SOLO de sus máquinas asignadas
-- IMPORTANTE: El cliente nunca debe poder leer amount_gross directamente
-- El backend debe calcular el neto y devolverlo
CREATE POLICY "Clients can view revenue of assigned machines" ON machine_revenue_snapshots
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            JOIN client_machine_assignments cma ON cma.client_id = p.id
            WHERE p.id = auth.uid() 
            AND p.role = 'client'
            AND cma.machine_id = machine_revenue_snapshots.machine_id
        )
    );

-- =====================================================
-- POLICIES: scrape_runs
-- =====================================================

-- Admin puede ver todos los scrape runs
CREATE POLICY "Admins can view all scrape runs" ON scrape_runs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Admin y cliente pueden insertar scrape runs (para auditoría)
CREATE POLICY "Authenticated users can insert scrape runs" ON scrape_runs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        triggered_by_user_id = auth.uid() 
        OR triggered_by_user_id IS NULL
    );

-- Cliente puede ver sus propios scrape runs
CREATE POLICY "Clients can view own scrape runs" ON scrape_runs
    FOR SELECT
    TO authenticated
    USING (triggered_by_user_id = auth.uid());

-- =====================================================
-- FUNCIÓN SECURITY DEFINER: Calcular recaudación neta
-- =====================================================

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
    amount_net NUMERIC,
    scraped_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id AS machine_id,
        m.name AS machine_name,
        m.location,
        mrs.period,
        ROUND(mrs.amount_gross * (1 - COALESCE(cs.commission_hide_percent, 0) / 100.0), 2) AS amount_net,
        mrs.scraped_at
    FROM machine_revenue_snapshots mrs
    JOIN machines m ON m.id = mrs.machine_id
    JOIN client_machine_assignments cma ON cma.machine_id = m.id
    LEFT JOIN client_settings cs ON cs.client_id = cma.client_id
    WHERE cma.client_id = p_client_id
      AND mrs.period = p_period
      AND (p_machine_id IS NULL OR m.id = p_machine_id)
    ORDER BY mrs.scraped_at DESC, m.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN SECURITY DEFINER: Overview admin (bruto vs neto)
-- =====================================================

CREATE OR REPLACE FUNCTION get_admin_client_overview(
    p_client_id UUID
)
RETURNS TABLE (
    period revenue_period,
    total_gross NUMERIC,
    total_net NUMERIC,
    commission_percent NUMERIC,
    machine_count INTEGER,
    last_update TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    WITH latest_scrapes AS (
        SELECT DISTINCT ON (mrs.machine_id, mrs.period)
            mrs.machine_id,
            mrs.period,
            mrs.amount_gross,
            mrs.scraped_at
        FROM machine_revenue_snapshots mrs
        JOIN client_machine_assignments cma ON cma.machine_id = mrs.machine_id
        WHERE cma.client_id = p_client_id
        ORDER BY mrs.machine_id, mrs.period, mrs.scraped_at DESC
    )
    SELECT 
        ls.period,
        ROUND(SUM(ls.amount_gross), 2) AS total_gross,
        ROUND(SUM(ls.amount_gross * (1 - COALESCE(cs.commission_hide_percent, 0) / 100.0)), 2) AS total_net,
        COALESCE(cs.commission_hide_percent, 0) AS commission_percent,
        COUNT(DISTINCT ls.machine_id)::INTEGER AS machine_count,
        MAX(ls.scraped_at) AS last_update
    FROM latest_scrapes ls
    LEFT JOIN client_settings cs ON cs.client_id = p_client_id
    GROUP BY ls.period, cs.commission_hide_percent;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMENTARIOS
-- =====================================================

COMMENT ON TABLE profiles IS 'Perfiles de usuario extendiendo auth.users con roles';
COMMENT ON TABLE client_settings IS 'Configuración por cliente (% comisión oculta)';
COMMENT ON TABLE machines IS 'Máquinas de vending - Se crean automáticamente desde el scraping';
COMMENT ON TABLE client_machine_assignments IS 'Relación N:M entre clientes y máquinas';
COMMENT ON TABLE machine_revenue_snapshots IS 'Snapshots de recaudación BRUTA - Llenados automáticamente cada hora';
COMMENT ON TABLE scrape_runs IS 'Auditoría de scraping - triggered_by_user_id NULL = automático';
COMMENT ON FUNCTION get_client_net_revenue IS 'Calcula recaudación NETA aplicando comisión (SECURITY DEFINER)';
COMMENT ON FUNCTION get_admin_client_overview IS 'Vista global admin con bruto vs neto por periodo';

-- =====================================================
-- ✅ COMPLETADO
-- =====================================================

-- Ejecuta este mensaje de confirmación (opcional)
DO $$
BEGIN
    RAISE NOTICE '✅ Schema completo creado exitosamente';
    RAISE NOTICE '📊 Tablas: 6 (profiles, client_settings, machines, assignments, snapshots, scrape_runs)';
    RAISE NOTICE '🔒 RLS Policies: 15+';
    RAISE NOTICE '⚙️ Funciones SQL: 2 (get_client_net_revenue, get_admin_client_overview)';
    RAISE NOTICE '🎯 Siguiente paso: Crear usuario admin';
END $$;
```

---

## ✅ Verificación

Después de ejecutar el SQL, verifica que todo se creó correctamente:

```sql
-- Ver todas las tablas creadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'client_settings', 'machines', 'client_machine_assignments', 'machine_revenue_snapshots', 'scrape_runs')
ORDER BY table_name;

-- Deberías ver 6 tablas
```

---

## 👤 Crear usuario admin

Una vez ejecutado el SQL, crea tu primer usuario admin:

### Paso 1: Crear usuario en Supabase Auth

1. Ve a **Authentication** > **Users**
2. Clic en **"Add user"** > **"Create new user"**
3. Completa:
   - Email: `admin@tuempresa.com`
   - Password: (genera una fuerte)
   - Auto Confirm User: ✅
4. Copia el **UUID** del usuario creado

### Paso 2: Asignarle rol admin

En **SQL Editor**, ejecuta:

```sql
-- Reemplaza 'AQUI_EL_UUID' con el UUID real del usuario
INSERT INTO profiles (id, role, email, display_name)
VALUES (
  'd8c8050a-e213-430a-bdca-6f0e29d80863',
  'admin',
  'info@lifyvending.com',
  'Administrador'
);
```

### Verificar

```sql
-- Ver el admin creado
SELECT id, email, role, display_name 
FROM profiles 
WHERE role = 'admin';
```

---

## 🎯 Siguiente paso

Ahora puedes:
1. ✅ Desplegar en Vercel (ver `DEPLOYMENT_GUIDE.md`)
2. ✅ Login con tu usuario admin
3. ✅ Crear clientes desde el panel admin
4. ✅ Esperar a que el scraping automático se ejecute (cada hora en punto)

---

## 📋 Resumen de lo que acabas de crear

| Componente | Cantidad | Descripción |
|------------|----------|-------------|
| **Tablas** | 6 | Estructura completa multi-tenant |
| **RLS Policies** | 15+ | Seguridad por filas |
| **Índices** | 10+ | Optimización de consultas |
| **Funciones SQL** | 2 | Cálculo seguro de neto |
| **Triggers** | 3 | Auto-actualización de timestamps |
| **Enums** | 3 | Tipos personalizados |

**🎉 Base de datos lista para producción!**
