import { NextResponse } from 'next/server';
import { getScrapingStatus } from '@/lib/services/settings-service';

export async function GET() {
  try {
    const status = await getScrapingStatus();
    if (!status) {
      return NextResponse.json({ error: 'Status not found' }, { status: 404 });
    }
    return NextResponse.json(status);
  } catch (error) {
    console.error('Error fetching scraping status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
