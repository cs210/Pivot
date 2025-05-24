import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; viewId: string }> }
) {
  try {
    const params = await context.params;
    const supabase = createClient();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the request body
    const { duration } = await request.json();

    // Update the view duration
    const { error: updateError } = await supabase
      .from('project_views')
      .update({ view_duration: duration })
      .eq('id', params.viewId)
      .eq('user_id', user.id); // Ensure the user can only update their own views

    if (updateError) {
      console.error('Error updating view duration:', updateError);
      return NextResponse.json({ error: 'Failed to update view duration' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating view duration:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 