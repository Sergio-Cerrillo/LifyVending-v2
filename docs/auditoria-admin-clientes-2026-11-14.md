# Auditoría de estabilidad y rendimiento de admin y clientes

Fecha: 14 de noviembre de 2026. Código de referencia: `b30e0aa6`.

Hay causas reproducibles en el código que explican las esperas intermitentes, las cargas canceladas, las pantallas rotas y parte de las solicitudes de volver a iniciar sesión. La principal combinación es un bloqueo en la renovación de sesión y peticiones de lectura que esperan sincronizaciones completas de proveedores externos.

No se han modificado archivos de funcionamiento de la aplicación, datos, porcentajes, fórmulas, asignaciones, permisos ni información mostrada. Solo se añaden este informe y un script de diagnóstico. No se han ejecutado migraciones ni scrapers reales. El usuario confirmó que no existe un entorno de pruebas y solicitó continuar con pruebas aisladas.

## Alcance y evidencia

- Revisión de autenticación, sesión, layouts, dashboards, recaudaciones, usuarios/clientes, stock, mapa, rutas y servicios de actualización. La revisión de código es más amplia que la cobertura ejecutable; no se ha navegado cada interacción de estas pantallas.
- **31/31 comprobaciones aisladas reproducidas** mediante código original, servicios simulados y datos ficticios. Se ejecutan módulos TypeScript originales en una VM; algunas funciones se extraen por su AST, sin reescribir sus instrucciones. Las pruebas de sesión utilizan también Supabase JS real instalado, versión `2.98.0`, con transporte simulado.
- **14/14 comprobaciones HTTP locales** sobre una compilación aislada de la aplicación, con credenciales ficticias y peticiones externas bloqueadas.
- **Compilación de producción con webpack correcta**, en una copia temporal sin `.env`. Las fuentes de Google se simularon para permitir una compilación sin acceso externo. El resultado no valida visualmente esas fuentes ni mide su descarga real.
- **TypeScript falla**; incluye los identificadores sin importar que provocan errores de renderizado. La compilación indica explícitamente `Skipping validation of types`.
- **Lint no ejecutable**: `npm run lint` falla con `eslint: command not found` en la instalación actual.
- El servidor temporal se detuvo al terminar.

Estas pruebas confirman comportamientos defectuosos, no que estén corregidos. No son una medición de latencia real ni una prueba de carga de producción. No se han verificado logs de hosting, consultas SQL con `EXPLAIN`, índices efectivos, volumen real de datos, configuración desplegada, sesiones reales, navegación autenticada en navegador, memoria del navegador ni recuperación tras suspensión del dispositivo.

## Causas principales

### 1. Bloqueo de autenticación durante la renovación — prioridad alta

En `contexts/auth-context.tsx:125`, el callback de `onAuthStateChange` es `async` y espera a `loadProfile`. Esa función ejecuta una consulta usando el mismo cliente de Supabase. El SDK obtiene la sesión para autorizar esa consulta mientras la renovación mantiene ocupado su bloqueo interno y espera a que termine el callback.

La reproducción con el SDK instalado confirma que durante `TOKEN_REFRESHED` la consulta del perfil ni siquiera llega al transporte simulado. Otra llamada simultánea a `getSession` supera su límite de 10 segundos. El timeout del perfil, configurado a 25 segundos, libera finalmente el callback, y entonces se ejecuta la consulta pendiente. Se usó escala temporal 1:100 para reproducir ambos límites sin esperas largas.

Esto explica que una sesión válida parezca dejar de funcionar al renovarse. La pantalla falla antes de que termine el bloqueo, y recargar puede permitir que se encuentre después con una sesión ya renovada. La frecuencia exacta de este mecanismo en producción no se ha medido.

El propio código del SDK instalado advierte de este patrón en `node_modules/@supabase/auth-js/src/GoTrueClient.ts:2204`. También está documentado por [Supabase: llamadas que no terminan](https://supabase.com/kb/troubleshooting/why-is-my-supabase-api-call-not-returning-PGzXw0).

Corrección propuesta: mantener síncrono el callback de autenticación y ejecutar la lectura del perfil fuera de él, con control de resultados antiguos. Conservar la comprobación de permisos y rol; un fallo temporal no debe conceder acceso.

### 2. Se cierra una sesión válida ante fallos temporales de perfil — prioridad alta

En `app/login/page.tsx:114`, cualquier error al leer `profiles` se trata como ausencia de perfil. La rama ejecuta `signOut()` en la línea 129 aunque el login haya sido correcto. La prueba con un error 503 de perfil confirma el cierre de sesión.

En el proveedor de autenticación, si falla el perfil y no existe un rol en metadatos ni un usuario anterior, se termina con `loading=false` y `currentUser=null`. `AdminLayout` muestra acceso denegado sin un mecanismo propio para reintentar la carga del perfil.

Además, las páginas no comparten una estrategia única de sesión: muchas usan `getSession`, mientras stock y rutas usan `getFreshAccessToken`. El dashboard de clientes no renueva ni reintenta automáticamente cuando recibe un 401. En `lib/auth-session.ts:29`, cuatro consumidores simultáneos con una sesión próxima a caducar solicitan cuatro llamadas a `refreshSession` en la prueba aislada. Eso demuestra ausencia de coordinación en el helper; no equivale a afirmar cuatro peticiones de red simultáneas, porque el SDK tiene su propia coordinación.

Corrección propuesta: distinguir errores temporales de autenticación inválida, coordinar una sola renovación en curso y permitir un reintento controlado para lecturas tras renovar el token. Mantener intactos los controles de autorización del servidor.

### 3. Abrir una pantalla espera sincronizaciones y cierres mensuales — prioridad alta

Estos GET esperan a `ensureRevenueFreshness()` antes de devolver sus datos:

| Ruta | Referencia |
| --- | --- |
| `/api/client/dashboard` | `app/api/client/dashboard/route.ts:51` |
| `/api/admin/revenue` | `app/api/admin/revenue/route.ts:80` |
| `/api/admin/home-rankings` | `app/api/admin/home-rankings/route.ts:94` |

El servicio, en `lib/services/revenue-refresh-service.ts:889`, espera a la actualización de Frekuent, la de Televend y el cierre del mes anterior. No es trabajo en segundo plano aunque algún mensaje de log lo describa así.

La prueba confirma que las rutas de admin y cliente ni siquiera consultan sus datos principales hasta liberar la actualización. Con datos antiguos, el servicio ejecuta tres cargas de periodo por proveedor, seis en total, y crea/actualiza registros de trabajos. En condiciones normales también puede escribir recaudaciones e histórico mensual.

La frescura predeterminada es de 30 minutos. Por eso dos aperturas de la misma pantalla pueden recorrer caminos muy distintos: leer datos recientes o esperar una actualización externa completa. En Televend, cada periodo recorre máquinas y puede paginar ventas hasta 200 páginas por máquina (`lib/televend.ts:715`). El límite de 12 segundos por petición de proveedor no limita el tiempo total del proceso.

Aunque los datos estén recientes, `/api/admin/revenue` vuelve a solicitar recaudación mensual a Frekuent para resolver identificadores (`route.ts:113`), incluso si ya hay identificadores numéricos guardados.

Corrección propuesta: separar los trabajos de actualización/cierre de las peticiones que muestran datos; servir el último resultado validado y controlar su frescura. Esto requiere pruebas de equivalencia de importes, periodos y permisos antes de cualquier cambio. No se ha modificado esa lógica en esta auditoría.

### 4. Los límites de tiempo no cubren todo el trabajo — prioridad alta

`lib/client-timeouts.ts` presenta tres comportamientos reproducidos:

- `withTimeout` rechaza la espera, pero no cancela la operación original. La consulta puede continuar después del error mostrado y coincidir con un reintento.
- `fetchWithTimeout` elimina el temporizador cuando recibe las cabeceras. La posterior lectura `response.json()` queda fuera del límite y puede seguir pendiente.
- Una cancelación por una señal externa se convierte en `RequestTimeoutError`, lo que oculta si la causa era navegación/cancelación o lentitud real.

Los dashboards cancelan sus peticiones a los 35 segundos, stock a los 40 y mapa a los 45. Los servicios que esas peticiones esperan pueden tardar más. No se propaga el `request.signal` a las cadenas de consulta/proveedor revisadas, así que abortar en el navegador no establece por sí solo un límite para todo ese trabajo.

Corrección propuesta: presupuestos de tiempo para la operación completa, incluida la lectura del cuerpo; cancelación coherente cuando corresponda; distinción entre cancelación voluntaria, timeout, error temporal y sesión inválida. Aumentar solo los tiempos no resuelve las dependencias bloqueantes.

### 5. Se repite el stock completo y falla todo por una parte — prioridad alta

El dashboard inicia cinco peticiones de datos: recaudación, últimas ventas, estado Frekuent, estado Televend y mapa. Tanto los estados como el mapa vuelven a consultar stock a los proveedores. No se comparte el resultado de esas cargas entre estos consumidores.

`getTelevendStockMachines` y su equivalente de Frekuent recorren máquinas con concurrencia predeterminada de seis. En una prueba con **60 máquinas ficticias y tres consumidores simultáneos**, Televend realizó:

| Operación simulada | Peticiones |
| --- | ---: |
| Login compartido | 1 |
| Listados de máquinas | 6 |
| Productos | 3 |
| Columnas de máquinas | 180 |
| Total | 190 |

Se observaron 18 consultas de columnas simultáneas, seis por consumidor. Es una reproducción del crecimiento del trabajo; no una medición del número de máquinas ni de los tiempos actuales en producción. El login sí se comparte; el resultado de stock no.

Una única máquina que responde con error hace fallar la carga completa de Televend. En la vista conjunta de stock, un error de Televend descarta también una respuesta correcta de Frekuent (`components/admin/stock-live-page.tsx:549`).

Corrección propuesta: compartir cargas idénticas en curso y resultados recientes, conservando su ámbito de permisos y proveedor; aislar los errores parciales para no bloquear el resto. Verificar explícitamente que nunca se mezclen resultados de usuarios o filtros distintos.

### 6. Respuestas antiguas pueden sobrescribir la pantalla actual — prioridad alta

En `components/admin/stock-live-page.tsx:541`, no existe comprobación de generación de petición ni cancelación al cambiar de proveedor. La reproducción inicia Frekuent lento, cambia a Televend y recibe sus datos; al terminar la petición antigua, los datos de Frekuent sobrescriben los de Televend.

El efecto de la línea 615 tampoco limpia esa carga al cambiar la selección. Este mecanismo puede mostrar datos de un filtro anterior y dar la impresión de que la pantalla se ha quedado en un estado incoherente.

Corrección propuesta: descartar resultados que ya no correspondan a la selección o al montaje actual y cancelar lo que sea cancelable.

### 7. Hay un error de renderizado directo en `/admin` — prioridad alta

`components/admin/dashboard-page.tsx:77` usa `BarChart3` sin importarlo. La ruta `app/admin/page.tsx` monta ese componente. La ejecución aislada del render reproduce `ReferenceError: BarChart3 is not defined`.

Es distinto de `/admin/dashboard`, que utiliza otro componente. No debe atribuirse este error concreto a todas las pantallas de admin.

`components/admin/collections-page.tsx:123` tiene el mismo problema con `DollarSign`; el fallo se reproduce, pero no se encontró una ruta actual que monte ese componente, por lo que se considera latente.

`next.config.mjs:4` activa `typescript.ignoreBuildErrors`. La compilación aislada pasa y omite tipos, mientras el chequeo explícito detecta estos problemas. No hay un `error.tsx` propio en las áreas revisadas para recuperar errores de renderizado a nivel de sección.

Corrección propuesta: importar los identificadores faltantes y restablecer un chequeo de tipos obligatorio, resolviendo primero los errores existentes. Verificar recuperación por sección para futuros fallos de renderizado.

### 8. El dashboard espera datos opcionales antes de mostrar los principales — prioridad media

En `components/admin/dashboard-overview-page.tsx:537`, `Promise.allSettled` espera también las últimas ventas antes de procesar la recaudación recibida. La reproducción confirma que una recaudación correcta no se muestra mientras ventas siga pendiente. Ese endpoint tiene un límite de 18 segundos y consulta ventas por máquina en ambos proveedores.

El mapa también espera geocodificación, stock externo y escrituras de caché/ubicación antes de responder (`app/api/admin/machine-map/route.ts:449`). La geocodificación externa es condicional y no tiene un timeout propio en `geocodeLocation`; no se ha comprobado si está habilitada en producción.

Corrección propuesta: procesar resultados independientes conforme terminan y sacar geocodificación/sincronización del camino de lectura del mapa.

### 9. La lista de usuarios genera dos consultas por cliente — prioridad media

En `app/api/admin/users/route.ts:50`, cada cliente añade consultas de settings y conteo de máquinas. La prueba de 100 clientes produce **202 consultas de base de datos**, más la validación remota del token. No hay paginación de usuarios en esta ruta. La ruta antigua `/api/admin/clients` presenta un patrón similar.

Corrección propuesta: agrupar settings y conteos en consultas por lote o agregaciones equivalentes y añadir paginación cuando proceda. Comparar los resultados con los actuales sin variar porcentajes, asignaciones ni conteos.

## Integridad de los resultados y protección de datos

**Errores convertidos en importes cero.** En `app/api/client/dashboard/route.ts:74`, si falla una RPC se devuelve un periodo vacío con total cero. La prueba hace fallar las tres RPC y recibe HTTP 200 con `success: true` y totales cero. Eso impide distinguir una avería de una recaudación realmente nula. No se ha cambiado el cálculo. Se propone conservar la distinción entre dato válido y fallo, sin inventar importes.

**Fechas inválidas provocan 500.** Una fecha inválida en una máquina hace fallar el cálculo de `lastUpdate` del dashboard del cliente al convertir `NaN` a ISO. Reproducido con un registro ficticio. Debe validarse la fecha antes de agregarla; se desconoce si hay registros así en producción.

**Hay más escrituras dentro de GET.** El overview administrativo de cliente intenta crear `client_settings` cuando no recibe datos de settings, sin separar la inexistencia real de un error temporal de lectura (`app/api/admin/clients/[clientId]/overview/route.ts:67`). La prueba con fallo temporal confirma el intento de inserción. Las escrituras del mapa y los cierres mensuales son otra razón por la que no se abrieron estas rutas con sesiones reales.

**Un trabajo antiguo puede bloquear renovaciones futuras.** El servicio busca trabajos activos solo de los últimos diez minutos (`revenue-refresh-service.ts:45`). El índice único de trabajos activos también incluye los anteriores. Si un proceso interrumpido deja un trabajo antiguo activo, la inserción puede fallar por duplicado y el servicio devolver `already_running` sin recuperarlo. Reproducido mediante respuestas ficticias. No se ha comprobado si existen trabajos así en la base real. Además, la migración original no permite la acción `frekuent`, mientras el bootstrap posterior sí la permite; el servicio omite el bloqueo si encuentra ese error de constraint. Hace falta comprobar el esquema desplegado antes de resolver esta divergencia.

**Rutas sensibles sin autenticación en el código — prioridad crítica.** Las siguientes rutas consultan con `service_role` sin comprobar sesión y rol en el handler:

| Ruta | Verificación aislada |
| --- | --- |
| `/api/admin/dashboard` | GET sin autorización devuelve 200 con BD simulada; por HTTP local intenta consultar BD y termina en 500 por bloqueo de red externa. |
| `/api/admin/commission-snapshots` | Mismo comportamiento; su SELECT incluye información de perfiles y comisiones. El POST tampoco comprueba autenticación según revisión del código; no se ejecutó por HTTP. |
| `/api/admin/settings` | GET sin autenticación devuelve 200 con settings ficticios. El PATCH tampoco comprueba autenticación según revisión del código; no se ejecutó por HTTP. |

Los layouts y menús del navegador no protegen una API. No hay middleware/proxy de autenticación en este repositorio que cubra esos accesos. No se ha comprobado si existe protección adicional en la infraestructura desplegada y no se solicitaron datos reales para averiguarlo. Se debe corregir este punto junto con la estabilidad, conservando los permisos previstos para cada rol.

**La RPC del cliente se invoca con contexto anónimo de servidor.** En el dashboard se valida al usuario mediante `supabase.auth.getUser(token)`, pero después se usa `supabase.rpc(...)` sobre el cliente público compartido. La prueba con el SDK real confirma que validar un token así no lo establece como sesión: la RPC posterior lleva la clave anónima, no el token del usuario.

La migración `20260901_lock_client_revenue_visibility.sql:30` compara `p_client_id <> auth.uid()`. Si `auth.uid()` es NULL, esa comparación también es NULL y no constituye una denegación explícita. La función es `SECURITY DEFINER`. Esto merece revisión prioritaria del contexto de invocación, de las comprobaciones de NULL y de los permisos `EXECUTE` efectivos. No se ha comprobado qué definición o permisos están desplegados; no se ha demostrado ni intentado acceder a los datos de otro cliente.

## Resultado HTTP de la copia local

| Grupo | Resultado |
| --- | --- |
| `/login`, `/admin`, `/admin/dashboard`, `/client/dashboard` | 4 respuestas HTML 200. Validan disponibilidad inicial, no navegación autenticada ni renderizado posterior a la sesión. |
| APIs de cliente, recaudación, usuarios, rutas, estados, mapa, stock y jobs sin sesión | 8 respuestas 401, como se esperaba. |
| APIs antiguas de dashboard y comisiones sin sesión | 2 intentos de BD sin autenticación previa; el bloqueo externo genera 500. Complementa las pruebas VM con BD ficticia que devuelven 200. |

## Orden de corrección propuesto

1. Cerrar los accesos de API sin autenticación y revisar el contexto/permisos de la RPC del cliente.
2. Eliminar el bloqueo del callback de sesión, distinguir fallos temporales de sesión inválida y coordinar renovaciones.
3. Corregir el render de `/admin` y hacer obligatorio el chequeo de tipos.
4. Separar las sincronizaciones y cierres de las lecturas, preservando exactamente los cálculos y los ámbitos de acceso.
5. Compartir cargas de stock, tratar fallos parciales y descartar respuestas de filtros antiguos.
6. Completar timeout/cancelación, separar datos opcionales y agrupar consultas de usuarios.
7. Validar en un entorno aislado con sesiones, suspensión/reanudación, red lenta, fallos parciales y comparación de payloads antes de desplegar. Medir después en producción con trazas que no incluyan importes ni información personal.

No se han aplicado estas correcciones como parte del análisis.

## Reproducción

Desde la raíz del repositorio, con las dependencias ya instaladas:

```sh
node scripts/audit-admin-client-stability.cjs
./node_modules/.bin/tsc --noEmit --incremental false --pretty false
npm run lint
```

El primer comando no carga `.env`, no permite red real y utiliza datos ficticios. Su salida `PASS` significa que el comportamiento descrito se reproduce; varias comprobaciones dejarán de pasar cuando se corrijan los defectos. El script es un diagnóstico, no una suite de aceptación de una aplicación corregida. El resultado de esta revisión fue `31/31 comprobaciones reproducidas`.

La compilación y las pruebas HTTP se hicieron por separado en `/tmp/lify-stability-audit-q1qcge`, sin copiar `.env`, con claves ficticias, fuentes simuladas y un bloqueo de `fetch/http/https` salientes. La copia solo se sirvió en `127.0.0.1:3187` durante las comprobaciones.
