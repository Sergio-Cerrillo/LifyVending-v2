import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { TelevendScraper } from '@/scraper/televend-scraper';

// CRON JOB: Stock Scraping (v4 - Fresh rebuild)
// Called by cron-job.org every 8 hours

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

export async function GET(request: NextRequest) {
  console.log('[STOCK CRON v4] Starting automatic stock scraping...');

  // Validate authorization
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
  
  if (!process.env.CRON_SECRET) {
    console.error('[STOCK CRON v4] ERROR: CRON_SECRET not configured');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  if (authHeader !== expectedAuth) {
    console.warn('[STOCK CRON v4] Unauthorized access attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const supabaseAdmin = getSupabaseAdmin();

  try {
    // Fetch all machines (NO deleted_at filter)
    console.log('[STOCK CRON v4] Fetching active machines...');
    
    const { data: machines, error: machinesError } = await supabaseAdmin
      .from('machines')
      .select('id, name, location, orain_machine_id, televend_machine_id')
      .order('name');

    if (machinesError) {
      console.error('[STOCK CRON v4] Database error:', machinesError);
      return NextResponse.json(
        { error: 'Database error', details: machinesError.message },
        { status: 500 }
      );
    }

    if (!machines || machines.length === 0) {
      console.log('[STOCK CRON v4] No machines found');
      return NextResponse.json({
        success: true,
        message: 'No machines to scrape',
        machinesScraped: 0,
        machinesFailed: 0,
        duration: Date.now() - startTime
      });
    }

    console.log(`[STOCK CRON v4] Found ${machines.length} machines`);

    // Initialize Televend scraper
    console.log('[STOCK CRON v4] Initializing Televend scraper...');
    
    const televend = new TelevendScraper({
      username: process.env.TELEVEND_USERNAME!,
      password: process.env.TELEVEND_PASSWORD!,
      headless: true,
    });

    await televend.initialize();
    await televend.login();
    await televend.navigateToMachines();

    console.log('[STOCK CRON v4] ✅ Televend login successful');

    // Process each machine
    let successCount = 0;
    let failCount = 0;
    const errors: Array<{ machineId: string; machineName: string; error: string }> = [];

    for (const machine of machines) {
      try {
        console.log(`[STOCK CRON v4] Processing: ${machine.name} (ID: ${machine.id})`);

        const machineUrl = machine.televend_machine_id 
          ? `https://app.televendcloud.com/companies/4949/machines/${machine.televend_machine_id}`
          : null;

        if (!machineUrl) {
          console.warn(`[STOCK CRON v4] ⚠️  Machine ${machine.name} has no televend_machine_id, skipping...`);
          failCount++;
          errors.push({
            machineId: machine.id,
            machineName: machine.name,
            error: 'No televend_machine_id configured'
          });
          continue;
        }

        // Scrape stock data
        const stockData = await televend.extractStockForMachine({
          id: machine.id,
          name: machine.name,
          url: machineUrl,
        });

        if (!stockData || !stockData.products || stockData.products.length === 0) {
          console.warn(`[STOCK CRON v4] ⚠️  No products found for ${machine.name}`);
          failCount++;
          errors.push({
            machineId: machine.id,
            machineName: machine.name,
            error: 'No products returned from scraper'
          });
          continue;
        }

        // Calculate statistics
        const totalProducts = stockData.products.length;
        const totalCapacity = stockData.products.reduce((sum, p) => sum + (p.totalCapacity || 0), 0);
        const totalAvailable = stockData.products.reduce((sum, p) => sum + (p.availableUnits || 0), 0);
        const totalToReplenish = stockData.products.reduce((sum, p) => sum + (p.unitsToReplenish || 0), 0);

        // UPSERT machine stock record
        const { data: stockRecord, error: stockError } = await supabaseAdmin
          .from('machine_stock_current')
          .upsert({
            machine_id: machine.id,
            machine_name: machine.name,
            machine_location: machine.location,
            scraped_at: new Date().toISOString(),
            total_products: totalProducts,
            total_capacity: totalCapacity,
            total_available: totalAvailable,
            total_to_replenish: totalToReplenish,
          }, {
            onConflict: 'machine_id',
            ignoreDuplicates: false
          })
          .select()
          .single();

        if (stockError) {
          console.error(`[STOCK CRON v4] Error upserting stock for ${machine.name}:`, stockError);
          failCount++;
          errors.push({
            machineId: machine.id,
            machineName: machine.name,
            error: `Database error: ${stockError.message}`
          });
          continue;
        }

        // Delete old products
        const { error: deleteError } = await supabaseAdmin
          .from('stock_products_current')
          .delete()
          .eq('stock_id', stockRecord.id);

        if (deleteError) {
          console.error(`[STOCK CRON v4] Error deleting old products for ${machine.name}:`, deleteError);
        }

        // Insert new products
        const productsToInsert = stockData.products.map(p => ({
          stock_id: stockRecord.id,
          product_name: p.name,
          category: p.category || null,
          line: p.line || null,
          total_capacity: p.totalCapacity || 0,
          available_units: p.availableUnits || 0,
          units_to_replenish: p.unitsToReplenish || 0,
        }));

        const { error: productsError } = await supabaseAdmin
          .from('stock_products_current')
          .insert(productsToInsert);

        if (productsError) {
          console.error(`[STOCK CRON v4] Error inserting products for ${machine.name}:`, productsError);
          failCount++;
          errors.push({
            machineId: machine.id,
            machineName: machine.name,
            error: `Failed to insert products: ${productsError.message}`
          });
          continue;
        }

        console.log(`[STOCK CRON v4] ✅ ${machine.name}: ${totalProducts} products, ${totalToReplenish} to replenish`);
        successCount++;

      } catch (error: any) {
        console.error(`[STOCK CRON v4] Error processing ${machine.name}:`, error);
        failCount++;
        errors.push({
          machineId: machine.id,
          machineName: machine.name,
          error: error.message || 'Unknown error'
        });
      }
    }

    // Cleanup
    await televend.close();
    console.log('[STOCK CRON v4] Scraper closed');

    // Return results
    const duration = Date.now() - startTime;
    const durationMinutes = (duration / 1000 / 60).toFixed(2);

    console.log(`[STOCK CRON v4] ✅ Completed in ${durationMinutes} minutes`);
    console.log(`[STOCK CRON v4] Success: ${successCount}, Failed: ${failCount}`);

    return NextResponse.json({
      success: true,
      machinesScraped: successCount,
      machinesFailed: failCount,
      totalMachines: machines.length,
      duration,
      durationMinutes: parseFloat(durationMinutes),
      timestamp: new Date().toISOString(),
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error: any) {
    console.error('[STOCK CRON v4] Fatal error:', error);
    
    return NextResponse.json(
      {
        error: 'Fatal error during stock scraping',
        message: error.message,
        duration: Date.now() - startTime
      },
      { status: 500 }
    );
  }
}
