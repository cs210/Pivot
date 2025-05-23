import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(
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

    // Check if this is the user's first view of the project
    const { data: existingViews, error: checkError } = await supabase
      .from('project_views')
      .select('id')
      .eq('project_id', params.id)
      .eq('user_id', user.id)
      .limit(1);

    if (checkError) {
      return NextResponse.json({ error: 'Failed to check existing views' }, { status: 500 });
    }

    const isFirstView = !existingViews || existingViews.length === 0;

    // Record the view
    const { data: viewData, error: viewError } = await supabase
      .from('project_views')
      .insert({
        project_id: params.id,
        user_id: user.id,
        organization_id: project.organization_id,
        is_unique_view: isFirstView,
        viewed_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (viewError) {
      console.error('Error recording view:', viewError);
      return NextResponse.json({ error: 'Failed to record view' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      isFirstView,
      viewId: viewData.id
    });
  } catch (error) {
    console.error('Error recording project view:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 