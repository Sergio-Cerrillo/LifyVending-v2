import { NextResponse } from 'next/server';
import { getSettings, updateGeneralSettings, updateScrapingConfig, updateClientsConfig, updateSecurityConfig, updateNotificationsConfig, updateAppearanceConfig, updateMaintenanceConfig } from '@/lib/services/settings-service';

export async function GET() {
  try {
    const settings = await getSettings();
    if (!settings) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
    }
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { type, data } = body;

    let result;
    switch (type) {
      case 'general':
        result = await updateGeneralSettings(data);
        break;
      case 'scraping':
        result = await updateScrapingConfig(data);
        break;
      case 'clients':
        result = await updateClientsConfig(data);
        break;
      case 'security':
        result = await updateSecurityConfig(data);
        break;
      case 'notifications':
        result = await updateNotificationsConfig(data);
        break;
      case 'appearance':
        result = await updateAppearanceConfig(data);
        break;
      case 'maintenance':
        result = await updateMaintenanceConfig(data);
        break;
      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
