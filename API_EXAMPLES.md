# 🔌 Ejemplos de Uso de APIs

Guía práctica con ejemplos curl, JavaScript y TypeScript para todos los endpoints.

---

## 🔑 Autenticación

Todos los endpoints requieren JWT token en header `Authorization`.

### **Obtener Token (Login)**

```bash
# Login vía Supabase Auth
curl -X POST 'https://tu-proyecto.supabase.co/auth/v1/token?grant_type=password' \
  -H 'Content-Type: application/json' \
  -H 'apikey: TU_ANON_KEY' \
  -d '{
    "email": "admin@lifyvending.com",
    "password": "tu_password"
  }'

# Respuesta incluye:
# {
#   "access_token": "eyJhbGc...",
#   "user": { "id": "uuid", ... }
# }
```

### **Usar Token en Requests**

```bash
export TOKEN="eyJhbGc..."

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/admin/clients
```

---

## 👨‍💼 Endpoints Admin

### **1. Crear Cliente**

#### cURL
```bash
curl -X POST http://localhost:3000/api/admin/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "hotel@ejemplo.com",
    "password": "temporal123",
    "displayName": "Juan García",
    "companyName": "Hotel Playa S.L.",
    "commissionPercent": 30
  }'
```

#### JavaScript (fetch)
```javascript
const response = await fetch('/api/admin/users', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'hotel@ejemplo.com',
    password: 'temporal123',
    displayName: 'Juan García',
    companyName: 'Hotel Playa S.L.',
    commissionPercent: 30
  })
});

const data = await response.json();
console.log('Cliente creado:', data.user.id);
```

#### Respuesta
```json
{
  "success": true,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "hotel@ejemplo.com"
  }
}
```

### **2. Listar Clientes**

#### cURL
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/admin/clients
```

#### JavaScript
```javascript
const response = await fetch('/api/admin/clients', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { clients } = await response.json();
clients.forEach(client => {
  console.log(`${client.company_name}: ${client.machineCount} máquinas (${client.commissionPercent}%)`);
});
```

#### Respuesta
```json
{
  "clients": [
    {
      "id": "uuid",
      "email": "hotel@ejemplo.com",
      "display_name": "Juan García",
      "company_name": "Hotel Playa S.L.",
      "machineCount": 3,
      "commissionPercent": 30,
      "created_at": "2024-03-04T10:00:00Z"
    }
  ]
}
```

### **3. Asignar Máquinas a Cliente**

#### cURL
```bash
curl -X POST http://localhost:3000/api/admin/assignments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "550e8400-e29b-41d4-a716-446655440000",
    "machineIds": [
      "10000000-0000-0000-0000-000000000001",
      "10000000-0000-0000-0000-000000000002",
      "10000000-0000-0000-0000-000000000003"
    ]
  }'
```

#### JavaScript
```javascript
const assignMachines = async (clientId, machineIds) => {
  const response = await fetch('/api/admin/assignments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ clientId, machineIds })
  });
  
  const result = await response.json();
  console.log(result.message); // "3 máquinas asignadas correctamente"
};

await assignMachines(
  '550e8400-e29b-41d4-a716-446655440000',
  [
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002'
  ]
);
```

### **4. Actualizar Porcentaje de Comisión**

#### cURL
```bash
curl -X PUT http://localhost:3000/api/admin/client-settings/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "commissionPercent": 35.5
  }'
```

#### JavaScript
```javascript
const updateCommission = async (clientId, percent) => {
  const response = await fetch(`/api/admin/client-settings/${clientId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ commissionPercent: percent })
  });
  
  return await response.json();
};

await updateCommission('550e8400-e29b-41d4-a716-446655440000', 35.5);
```

### **5. Overview Cliente (Bruto vs Neto)**

#### cURL
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/admin/clients/550e8400-e29b-41d4-a716-446655440000/overview
```

#### JavaScript
```javascript
const getClientOverview = async (clientId) => {
  const response = await fetch(`/api/admin/clients/${clientId}/overview`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  
  console.log('Cliente:', data.client.company_name);
  console.log('Comisión:', data.client.commissionPercent + '%');
  console.log('\nRecaudación Mensual:');
  console.log('├─ Bruto:', data.revenue.monthly.total_gross, '€');
  console.log('├─ Neto:', data.revenue.monthly.total_net, '€');
  console.log('└─ Diferencia:', 
    (data.revenue.monthly.total_gross - data.revenue.monthly.total_net).toFixed(2), '€'
  );
  
  return data;
};

await getClientOverview('550e8400-e29b-41d4-a716-446655440000');
```

#### Respuesta
```json
{
  "client": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "hotel@ejemplo.com",
    "displayName": "Juan García",
    "companyName": "Hotel Playa S.L.",
    "commissionPercent": 30
  },
  "machines": [
    {
      "id": "10000000-0000-0000-0000-000000000001",
      "name": "CLUB DE MAR 5172",
      "location": "CLUB"
    }
  ],
  "revenue": {
    "daily": {
      "period": "daily",
      "total_gross": 255.10,
      "total_net": 178.57,
      "commission_percent": 30,
      "machine_count": 3,
      "last_update": "2024-03-04T10:00:00Z"
    },
    "weekly": { ... },
    "monthly": { ... }
  }
}
```

### **6. Resetear Contraseña**

#### cURL
```bash
curl -X POST http://localhost:3000/api/admin/users/550e8400-e29b-41d4-a716-446655440000/reset-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "newPassword": "nuevaPassword123"
  }'
```

#### JavaScript
```javascript
const resetPassword = async (userId, newPassword) => {
  const response = await fetch(`/api/admin/users/${userId}/reset-password`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ newPassword })
  });
  
  const result = await response.json();
  console.log(result.message); // "Contraseña reseteada correctamente"
};

await resetPassword('550e8400-e29b-41d4-a716-446655440000', 'nuevaPassword123');
```

### **7. Listar Máquinas**

#### cURL
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/admin/machines
```

#### JavaScript
```javascript
const getMachines = async () => {
  const response = await fetch('/api/admin/machines', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const { machines } = await response.json();
  return machines;
};

const machines = await getMachines();
console.log(`Total máquinas: ${machines.length}`);
```

---

## 👤 Endpoints Cliente

### **1. Dashboard (Recaudación Neta)**

#### cURL
```bash
curl -H "Authorization: Bearer $TOKEN_CLIENTE" \
  http://localhost:3000/api/client/dashboard
```

#### JavaScript
```javascript
const getDashboard = async () => {
  const response = await fetch('/api/client/dashboard', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  
  console.log('Empresa:', data.profile.companyName);
  console.log('Máquinas:', data.machines.length);
  console.log('\nRecaudación:');
  console.log('├─ Diaria:', data.revenue.daily.total, '€');
  console.log('├─ Semanal:', data.revenue.weekly.total, '€');
  console.log('└─ Mensual:', data.revenue.monthly.total, '€');
  
  return data;
};

await getDashboard();
```

#### Respuesta (Cliente)
```json
{
  "success": true,
  "profile": {
    "displayName": "Juan García",
    "companyName": "Hotel Playa S.L."
  },
  "machines": [
    {
      "id": "10000000-0000-0000-0000-000000000001",
      "name": "CLUB DE MAR 5172",
      "location": "CLUB"
    }
  ],
  "revenue": {
    "daily": {
      "total": 178.57,
      "machines": [
        {
          "id": "10000000-0000-0000-0000-000000000001",
          "name": "CLUB DE MAR 5172",
          "location": "CLUB",
          "amountNet": 81.13
        }
      ],
      "lastUpdate": "2024-03-04T10:00:00Z"
    },
    "weekly": { ... },
    "monthly": { ... }
  },
  "lastScrape": {
    "id": "20000000-0000-0000-0000-000000000001",
    "status": "completed",
    "startedAt": "2024-03-04T10:00:00Z",
    "finishedAt": "2024-03-04T10:01:30Z"
  }
}
```

⚠️ **NOTA**: Cliente solo recibe `amountNet`, NO `amountGross` ni `commission_percent`

### **2. Actualizar Datos (Ejecutar Scraping)**

#### cURL
```bash
curl -X POST http://localhost:3000/api/client/refresh \
  -H "Authorization: Bearer $TOKEN_CLIENTE"
```

#### JavaScript (con polling)
```javascript
const refreshData = async () => {
  // 1. Lanzar scraping
  const response = await fetch('/api/client/refresh', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const result = await response.json();
  
  if (!result.success) {
    console.error('Error en scraping:', result.error);
    return;
  }
  
  console.log('Scraping iniciado:', result.scrapeRunId);
  console.log('Máquinas procesadas:', result.machinesScraped);
  console.log('Snapshots creados:', result.snapshotsCreated);
  
  // 2. Esperar 2 segundos
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 3. Recargar dashboard
  const dashboard = await getDashboard();
  console.log('Dashboard actualizado:', dashboard.revenue.monthly.total, '€');
};

await refreshData();
```

#### Respuesta
```json
{
  "success": true,
  "scrapeRunId": "20000000-0000-0000-0000-000000000005",
  "machinesScraped": 10,
  "snapshotsCreated": 30,
  "scrapedAt": "2024-03-04T12:00:00Z"
}
```

---

## 🛠️ Funciones Helper

### **Cliente Supabase TypeScript**

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Login
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'admin@lifyvending.com',
  password: 'password'
});

const token = data.session?.access_token;

// Usar token en fetch
const response = await fetch('/api/admin/clients', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### **Wrapper de API Helper**

```typescript
// lib/api-client.ts
class APIClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async fetch(path: string, options: RequestInit = {}) {
    const response = await fetch(path, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API Error');
    }

    return response.json();
  }

  // Admin methods
  async createClient(data: {
    email: string;
    password: string;
    displayName?: string;
    companyName?: string;
    commissionPercent?: number;
  }) {
    return this.fetch('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getClients() {
    return this.fetch('/api/admin/clients');
  }

  async assignMachines(clientId: string, machineIds: string[]) {
    return this.fetch('/api/admin/assignments', {
      method: 'POST',
      body: JSON.stringify({ clientId, machineIds })
    });
  }

  async updateCommission(clientId: string, commissionPercent: number) {
    return this.fetch(`/api/admin/client-settings/${clientId}`, {
      method: 'PUT',
      body: JSON.stringify({ commissionPercent })
    });
  }

  async getClientOverview(clientId: string) {
    return this.fetch(`/api/admin/clients/${clientId}/overview`);
  }

  // Client methods
  async getDashboard() {
    return this.fetch('/api/client/dashboard');
  }

  async refreshData() {
    return this.fetch('/api/client/refresh', { method: 'POST' });
  }
}

// Uso
const api = new APIClient(token);
const clients = await api.getClients();
const dashboard = await api.getDashboard();
```

---

## 🧪 Scripts de Prueba

### **Test Completo Admin**

```javascript
// test-admin.js
const token = process.env.ADMIN_TOKEN;
const api = new APIClient(token);

async function testAdmin() {
  console.log('🧪 Testeando endpoints admin...\n');

  // 1. Listar clientes
  const { clients } = await api.getClients();
  console.log('✅ Clientes:', clients.length);

  // 2. Crear cliente
  const newClient = await api.createClient({
    email: `test-${Date.now()}@ejemplo.com`,
    password: 'test123',
    companyName: 'Test Company',
    commissionPercent: 25
  });
  console.log('✅ Cliente creado:', newClient.user.id);

  // 3. Listar máquinas
  const { machines } = await api.getMachines();
  console.log('✅ Máquinas:', machines.length);

  // 4. Asignar 2 máquinas
  await api.assignMachines(newClient.user.id, [
    machines[0].id,
    machines[1].id
  ]);
  console.log('✅ Máquinas asignadas');

  // 5. Ver overview
  const overview = await api.getClientOverview(newClient.user.id);
  console.log('✅ Overview obtenido');
  console.log('   Bruto mensual:', overview.revenue.monthly?.total_gross || 0, '€');
  console.log('   Neto mensual:', overview.revenue.monthly?.total_net || 0, '€');

  console.log('\n✅ Todos los tests admin pasados');
}

testAdmin().catch(console.error);
```

### **Test Completo Cliente**

```javascript
// test-client.js
const token = process.env.CLIENT_TOKEN;
const api = new APIClient(token);

async function testClient() {
  console.log('🧪 Testeando endpoints cliente...\n');

  // 1. Obtener dashboard
  const dashboard = await api.getDashboard();
  console.log('✅ Dashboard obtenido');
  console.log('   Empresa:', dashboard.profile.companyName);
  console.log('   Máquinas:', dashboard.machines.length);
  console.log('   Recaudación mensual:', dashboard.revenue.monthly.total, '€');

  // 2. Verificar que NO recibe bruto
  const hasGross = JSON.stringify(dashboard).includes('amount_gross');
  const hasPercent = JSON.stringify(dashboard).includes('commission_percent');
  
  if (hasGross || hasPercent) {
    console.error('❌ FALLO DE SEGURIDAD: Cliente recibe datos prohibidos');
    process.exit(1);
  }
  console.log('✅ Seguridad verificada: No expone bruto ni porcentaje');

  // 3. Actualizar datos
  const result = await api.refreshData();
  console.log('✅ Scraping ejecutado:', result.scrapeRunId);
  console.log('   Máquinas procesadas:', result.machinesScraped);

  console.log('\n✅ Todos los tests cliente pasados');
}

testClient().catch(console.error);
```

---

## 🔍 Debugging

### **Ver Requests en Browser**

```javascript
// Interceptar todas las requests
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  console.log('📤 Request:', args[0]);
  const response = await originalFetch(...args);
  const clone = response.clone();
  const data = await clone.json();
  console.log('📥 Response:', data);
  return response;
};
```

### **Verificar Token**

```javascript
function decodeJWT(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    atob(base64).split('').map(c => 
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join('')
  );
  return JSON.parse(jsonPayload);
}

const payload = decodeJWT(token);
console.log('User ID:', payload.sub);
console.log('Expira:', new Date(payload.exp * 1000));
```

---

**Actualizado**: Marzo 2024  
**Versión**: 1.0.0
