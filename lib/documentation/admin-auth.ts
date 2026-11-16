import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase-helpers';

export async function requireDocumentationAdmin(request: Request) {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  const { data: { user }, error } = await supabase.auth.getUser(header.slice(7));
  if (error || !user) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  const { data: profile, error: profileError } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
  if (profileError || profile?.role !== 'admin') return { error: NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 }) };
  return { user };
}
