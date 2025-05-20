import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
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
      .eq('id', params.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Record the view
    const { error: viewError } = await supabase
      .from('project_views')
      .insert({
        project_id: params.id,
        user_id: user.id,
        organization_id: project.organization_id
      });

    if (viewError) {
      return NextResponse.json({ error: 'Failed to record view' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error recording project view:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 