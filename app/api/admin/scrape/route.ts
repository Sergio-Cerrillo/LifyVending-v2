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
    
    console.log('[ADMIN-SCRAPE] Haciendo petición a:', cronUrl);
    console.log('[ADMIN-SCRAPE] Authorization header configurado:', !!process.env.CRON_SECRET);
    
    const cronResponse = await fetch(cronUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`
      },
      // Aumentar timeout a 10 minutos (600000ms) porque el scraping puede tardar 5-6 minutos
      signal: AbortSignal.timeout(600000)
    });

    console.log('[ADMIN-SCRAPE] Respuesta del CRON:', {
      status: cronResponse.status,
      statusText: cronResponse.statusText,
      ok: cronResponse.ok
    });

    if (!cronResponse.ok) {
      const contentType = cronResponse.headers.get('content-type');
      console.log('[ADMIN-SCRAPE] Content-Type:', contentType);
      
      let errorData: any = {};
      const responseText = await cronResponse.text();
      console.log('[ADMIN-SCRAPE] Respuesta cruda:', responseText.substring(0, 500));
      
      if (contentType?.includes('application/json')) {
        try {
          errorData = JSON.parse(responseText);
        } catch (e) {
          console.error('[ADMIN-SCRAPE] Error parseando JSON:', e);
          errorData = { error: 'Respuesta no es JSON válido', raw: responseText };
        }
      } else {
        errorData = { error: 'Respuesta no es JSON', raw: responseText };
      }
      
      console.error('[ADMIN-SCRAPE] Error del CRON:', errorData);
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
