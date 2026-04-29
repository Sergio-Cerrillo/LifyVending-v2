/**
 * API: Actualizar datos (ejecutar scraping)
 * POST /api/client/refresh
 * 
 * ⚠️ DEPRECADO - Ya no se usa
 * 
 * MOTIVO:
 * - El scraping ahora se ejecuta automáticamente cada hora via Vercel Cron
 * - Los clientes ya NO pueden forzar actualizaciones (solo admin puede)
 * - Esto evita race conditions, abuse, y mejora la experiencia de usuario
 * 
 * NUEVA ARQUITECTURA:
 * - Scraping automático: /api/cron/scrape-machines (ejecutado por Vercel cada hora)
 * - Scraping manual admin: POST /api/admin/force-scrape (solo admin)
 * - Cliente solo lee datos: GET /api/client/dashboard (lectura instantánea de BD)
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { 
      error: 'Este endpoint está deprecado',
      message: 'Los datos se actualizan automáticamente cada hora. Si necesitas forzar una actualización, contacta con el administrador.',
      deprecatedSince: '2026-03-04'
    }, 
    { status: 410 } // 410 Gone
  );
}
