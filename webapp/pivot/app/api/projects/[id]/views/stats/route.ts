import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const supabase = createClient();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the project to check organization access
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('organization_id')
      .eq('id', params.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get total views count
    const { count: totalViews, error: totalError } = await supabase
      .from('project_views')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', params.id);

    if (totalError) {
      return NextResponse.json({ error: 'Failed to get total views' }, { status: 500 });
    }

    // Get unique views count
    const { count: uniqueViews, error: uniqueError } = await supabase
      .from('project_views')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', params.id)
      .eq('is_unique_view', true);

    if (uniqueError) {
      return NextResponse.json({ error: 'Failed to get unique views' }, { status: 500 });
    }

    return NextResponse.json({
      totalViews: totalViews || 0,
      uniqueViews: uniqueViews || 0
    });
  } catch (error) {
    console.error('Error getting project view stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 