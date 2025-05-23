import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
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
      .eq('id', context.params.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get total views count
    const { count: totalViews, error: totalViewsError } = await supabase
      .from('project_views')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', context.params.id);

    if (totalViewsError) {
      return NextResponse.json({ error: 'Failed to get total views' }, { status: 500 });
    }

    // Get unique views count (count distinct users)
    const { data: uniqueUsers, error: uniqueViewsError } = await supabase
      .from('project_views')
      .select('user_id')
      .eq('project_id', context.params.id);

    const uniqueViews = uniqueUsers ? new Set(uniqueUsers.map(view => view.user_id)).size : 0;

    return NextResponse.json({
      totalViews: totalViews || 0,
      uniqueViews: uniqueViews || 0
    });
  } catch (error) {
    console.error('Error fetching project metrics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 