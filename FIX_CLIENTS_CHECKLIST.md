# ✅ Checklist: Reparar Clientes Sin Perfil

## 📋 Preparación

- [ ] Abre **Supabase Dashboard** → **SQL Editor**
- [ ] Activa el modo **"RLS disabled"** (necesitas service_role)
- [ ] Ten abierta la **consola del navegador** (F12) para ver logs

---

## 🔍 Diagnóstico

### Paso 1: ¿Hay usuarios sin perfil?

```sql
SELECT COUNT(*) FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL;
```

**Resultado:**
- [ ] **0 usuarios** → ✅ Todo OK, no hay nada que reparar
- [ ] **> 0 usuarios** → ⚠️ Hay usuarios sin perfil, continúa

---

### Paso 2: Ver detalles de los usuarios problemáticos

```sql
SELECT 
  au.email,
  COALESCE(au.raw_user_meta_data->>'role', 'SIN METADATA') as rol_esperado
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL;
```

**Anota los emails:**
- [ ] _______________________
- [ ] _______________________
- [ ] _______________________

**Revisa la columna `rol_esperado`:**
- [ ] Todos muestran un rol válido (client, admin, operador)
- [ ] Algunos muestran "SIN METADATA" → Usuario creado sin helpers

---

## 🔧 Reparación

### Paso 3: Crear perfiles faltantes

```sql
INSERT INTO public.profiles (id, email, role, display_name)
SELECT 
  au.id,
  au.email,
  COALESCE((au.raw_user_meta_data->>'role')::user_role, 'client'::user_role),
  COALESCE(au.raw_user_meta_data->>'name', au.email)
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
```

**Resultado esperado:**
```
INSERT 0 3  (donde 3 es el número de perfiles creados)
```

- [ ] Query ejecutada sin errores
- [ ] Mensaje muestra "INSERT 0 X"
- [ ] X coincide con el número del Paso 1

**Si hay error:**
- [ ] Revisa que el enum `user_role` existe
- [ ] Verifica que estás en modo "RLS disabled"

---

### Paso 4: Crear settings para clientes

```sql
INSERT INTO public.client_settings (client_id, commission_hide_percent, commission_payment_percent)
SELECT p.id, 0, 0
FROM public.profiles p
LEFT JOIN public.client_settings cs ON cs.client_id = p.id
WHERE p.role = 'client' AND cs.id IS NULL
ON CONFLICT (client_id) DO NOTHING;
```

**Resultado esperado:**
```
INSERT 0 2  (número de settings creados)
```

- [ ] Query ejecutada sin errores
- [ ] Settings creados para clientes

---

## ✅ Verificación Final

### Paso 5.1: Confirmar que NO hay usuarios sin perfil

```sql
SELECT COUNT(*) FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL;
```

**Resultado esperado:** `0`

- [ ] **Cuenta = 0** → ✅ Perfecto, todos tienen perfil

---

### Paso 5.2: Confirmar que todos los clientes tienen settings

```sql
SELECT 
  p.email,
  CASE 
    WHEN cs.id IS NULL THEN '❌ SIN SETTINGS'
    ELSE '✅ OK'
  END as estado
FROM public.profiles p
LEFT JOIN public.client_settings cs ON cs.client_id = p.id
WHERE p.role = 'client';
```

- [ ] Todos muestran **"✅ OK"**
- [ ] Si alguno muestra "❌", vuelve a ejecutar el Paso 4

---

### Paso 5.3: Ver resumen por roles

```sql
SELECT role, COUNT(*) as cantidad
FROM public.profiles
GROUP BY role;
```

**Anota los resultados:**
- [ ] admin: _____ usuarios
- [ ] client: _____ usuarios
- [ ] operador: _____ usuarios (si aplica)

---

## 🎉 Prueba en la Aplicación

### Paso 6: Verificar en el frontend

- [ ] Ve a **Admin → Gestión de Clientes**
- [ ] Verifica que aparecen TODOS los clientes
- [ ] El contador debe coincidir con el Paso 5.3

**Si no aparecen:**
- [ ] Recarga la página (Ctrl+R / Cmd+R)
- [ ] Revisa la consola del navegador (F12)
- [ ] Busca logs `[GET-CLIENTS]` en la consola del servidor

---

### Paso 7: Probar login de cliente

Elige un cliente reparado e intenta hacer login:

- [ ] Email: _______________________
- [ ] Password: (pídela al admin o resetéala)

**Login exitoso debe:**
- [ ] Mostrar toast "Bienvenido"
- [ ] Redirigir a `/client/dashboard`
- [ ] Cargar el dashboard del cliente
- [ ] No mostrar errores en consola

---

## 🚨 Errores Comunes

### Error: "permission denied for table auth.users"

**Causa:** Estás usando anon key en lugar de service role

**Solución:**
- [ ] Activa "RLS disabled" en Supabase SQL Editor
- [ ] O usa el service_role key directamente

---

### Error: "type 'user_role' does not exist"

**Causa:** El enum no está creado

**Solución:**
```sql
CREATE TYPE user_role AS ENUM ('admin', 'client', 'operador');
```
- [ ] Ejecuta esta query primero
- [ ] Luego reinicia desde el Paso 3

---

### Error: "duplicate key value violates unique constraint"

**Causa:** El perfil ya existe (no es realmente un error)

**Solución:**
- [ ] Verifica con el Paso 5.1 que ya no hay usuarios sin perfil
- [ ] Si el Paso 5.1 muestra 0, ignora este "error"

---

### Los clientes no aparecen en la lista

**Posibles causas:**
1. Cache del navegador
2. La API no usa `supabaseAdmin`
3. RLS bloqueando la query

**Solución:**
- [ ] Recarga la página con Ctrl+Shift+R (hard reload)
- [ ] Cierra sesión y vuelve a iniciar
- [ ] Revisa logs de consola del servidor
- [ ] Verifica que `/api/admin/clients` usa `supabaseAdmin`

---

## 📊 Estado Final Esperado

Al terminar todos los pasos:

```
✅ Usuarios sin perfil: 0
✅ Clientes sin settings: 0
✅ Clientes visibles en Admin: SÍ
✅ Login de cliente funciona: SÍ
✅ Dashboard de cliente carga: SÍ
```

- [ ] Todos los checks anteriores están ✅

---

## 📝 Notas Finales

**Información recopilada:**
- Total usuarios sin perfil encontrados: _____
- Total perfiles creados: _____
- Total settings creados: _____
- Emails de clientes reparados: _____________________

**Fecha de reparación:** _______________

**Ejecutado por:** _______________

---

## 💡 Prevención Futura

Para evitar este problema en el futuro:

- [ ] Verifica que el trigger `on_auth_user_created` está activo
- [ ] Usa SIEMPRE el helper `createNewClient()` para crear clientes
- [ ] No crees usuarios directamente en Supabase Auth Dashboard
- [ ] Si debes crear manualmente, incluye `user_metadata` con rol

**Query para verificar trigger:**
```sql
SELECT trigger_name FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
```

- [ ] Trigger existe y está activo
