// Test para validar el parseo de números en diferentes formatos

function parseTelevend(text: string): number {
  console.log('Parseando:', text);
  
  let parsed = 0;
  
  // Si contiene coma Y punto, determinar cuál es decimal
  if (text.includes(',') && text.includes('.')) {
    // Formato europeo: 1.234,56 (punto=miles, coma=decimal)
    const value = text.replace(/\./g, '').replace(',', '.');
    parsed = parseFloat(value) || 0;
  } 
  // Si solo contiene punto
  else if (text.includes('.') && !text.includes(',')) {
    // Formato inglés/Televend: 549.90 (punto=decimal)
    parsed = parseFloat(text) || 0;
  }
  // Si solo contiene coma
  else if (text.includes(',') && !text.includes('.')) {
    // Formato europeo sin miles: 549,90
    const value = text.replace(',', '.');
    parsed = parseFloat(value) || 0;
  }
  // Sin separadores
  else {
    parsed = parseFloat(text) || 0;
  }
  
  console.log('  →', parsed, '€\n');
  return parsed;
}

// Tests
console.log('=== TESTS DE PARSEO DE NÚMEROS ===\n');

// Formato inglés (Televend)
console.assert(parseTelevend('549.90') === 549.90, '❌ ERROR: 549.90');
console.assert(parseTelevend('13.65') === 13.65, '❌ ERROR: 13.65');
console.assert(parseTelevend('0.00') === 0, '❌ ERROR: 0.00');
console.assert(parseTelevend('1234.56') === 1234.56, '❌ ERROR: 1234.56');

// Formato europeo con miles
console.assert(parseTelevend('1.234,56') === 1234.56, '❌ ERROR: 1.234,56');
console.assert(parseTelevend('54.925,00') === 54925.00, '❌ ERROR: 54.925,00');

// Formato europeo sin miles
console.assert(parseTelevend('549,90') === 549.90, '❌ ERROR: 549,90');
console.assert(parseTelevend('13,65') === 13.65, '❌ ERROR: 13,65');

// Sin decimales
console.assert(parseTelevend('100') === 100, '❌ ERROR: 100');
console.assert(parseTelevend('0') === 0, '❌ ERROR: 0');

console.log('✅ TODOS LOS TESTS PASARON');
