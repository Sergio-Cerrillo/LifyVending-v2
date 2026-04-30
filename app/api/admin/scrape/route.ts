/**
 * API: Ejecutar scraping manual de recaudaciones (solo admin)
 * POST /api/admin/scrape
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase-helpers';

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verificar que sea admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
    }

    console.log('[ADMIN-SCRAPE] Scraping manual iniciado por:', user.email);

    // Verificar configuración
    if (!process.env.CRON_SECRET) {
      console.error('[ADMIN-SCRAPE] ERROR: CRON_SECRET no configurado');
      return NextResponse.json(
        { error: 'Configuración del servidor incompleta: falta CRON_SECRET' },
        { status: 500 }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    console.log('[ADMIN-SCRAPE] Llamando a CRON en:', siteUrl);

    // Llamar al endpoint del CRON con el secret correcto
    const cronUrl = `${siteUrl}/api/cron/scrape-machines`;
    
    const cronResponse = await fetch(cronUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`
      }
    });

    if (!cronResponse.ok) {
      const errorData = await cronResponse.json().catch(() => ({}));
      console.error('[ADMIN-SCRAPE] Error del CRON:', {
        status: cronResponse.status,
        statusText: cronResponse.statusText,
        error: errorData
      });
      throw new Error(errorData.error || `Error del CRON: ${cronResponse.status} ${cronResponse.statusText}`);
    }

    const result = await cronResponse.json();
    console.log('[ADMIN-SCRAPE] Scraping completado:', result);

    return NextResponse.json({
      success: true,
      machines_updated: result.totalMachines || 0,
      message: 'Scraping ejecutado correctamente'
    });

  } catch (error: any) {
    console.error('[ADMIN-SCRAPE] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
