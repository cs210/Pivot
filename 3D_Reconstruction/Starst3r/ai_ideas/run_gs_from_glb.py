import argparse
import torch
from starster import Scene
from starster.gs import init_3dgs, run_3dgs_optim
import trimesh

def run_gs_from_glb(glb_file, iterations=400, enable_pruning=True, verbose=True, device="cuda"):
    """
    Initializes and runs Gaussian Splatting optimization from a GLB file.

    Args:
        glb_file (str): Path to the input GLB file (containing the point cloud).
        iterations (int): Number of optimization iterations.
        enable_pruning (bool): Whether to enable pruning during optimization.
        verbose (bool): Whether to print optimization progress.
        device (str): Torch device to use ("cuda" or "cpu").
    """
    try:
        # Load the GLB file using trimesh
        scene_mesh = trimesh.load(glb_file)

        # Check if the loaded scene is a point cloud
        if not isinstance(scene_mesh, trimesh.points.PointCloud):
            raise ValueError("GLB file does not contain a point cloud.")

        # Extract vertices (points) and colors from the trimesh object
        points = scene_mesh.vertices
        colors = scene_mesh.visual.vertex_colors[:, :3]  # Take only RGB, discard alpha if present

        # Convert to torch tensors
        points_tensor = torch.tensor(points, dtype=torch.float32, device=device)
        colors_tensor = torch.tensor(colors, dtype=torch.float32, device=device)

        # Create a dummy scene
        scene = Scene(device=device)
        scene.dense_pts = [points_tensor]
        scene.dense_cols = [colors_tensor]

        # Initialize 3DGS
        init_3dgs(scene)

        # Run 3DGS optimization
        run_3dgs_optim(scene, iterations, enable_pruning, verbose=verbose)

        print("Gaussian Splatting optimization complete.")

    except Exception as e:
        print(f"Error running Gaussian Splatting: {e}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run Gaussian Splatting from a GLB file.")
    parser.add_argument("glb_file", type=str, help="Path to the input GLB file (point cloud).")
    parser.add_argument("--iterations", type=int, default=400, help="Number of optimization iterations.")
    parser.add_argument("--no_pruning", action="store_false", dest="enable_pruning",
                        help="Disable pruning during optimization.")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose output.")
    parser.add_argument("--device", type=str, default="cuda", help="Torch device to use (cuda or cpu).")
    args = parser.parse_args()

    run_gs_from_glb(args.glb_file, args.iterations, args.enable_pruning, args.verbose, args.device)
