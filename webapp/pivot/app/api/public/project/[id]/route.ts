import { createClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const projectId = params.id;
  const supabase = createClient({ cookies });

  try {
    // Get the project
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("is_public", true)
      .single();

    if (projectError) {
      return NextResponse.json(
        { error: "Project not found or not public" },
        { status: 404 }
      );
    }

    // Fetch associated panoramas
    const { data: panoramas, error: panoramasError } = await supabase
      .from("panoramas")
      .select("*")
      .eq("project_id", projectId)
      .eq("is_public", true);

    if (panoramasError) {
      return NextResponse.json(
        { error: "Error fetching panoramas" },
        { status: 500 }
      );
    }

    // Fetch associated grid information
    const { data: gridInfo, error: gridError } = await supabase
      .from("grids")
      .select("*")
      .eq("project_id", projectId)
      .single();

    // Fetch grid nodes if grid exists
    let gridNodes = [];
    if (!gridError && gridInfo) {
      const { data: nodes, error: nodesError } = await supabase
        .from("grid_nodes")
        .select("*")
        .eq("grid_id", gridInfo.id);

      if (!nodesError) {
        gridNodes = nodes;
      }
    }

    return NextResponse.json({
      project,
      panoramas,
      grid: gridInfo || null,
      gridNodes,
    });
  } catch (error) {
    console.error("Error fetching public project data:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
