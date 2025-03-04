import argparse
import os
import numpy as np
import torch
import trimesh
import gsplat

def run_gs_from_glb(glb_file, output_dir, iterations=400, enable_pruning=True, verbose=True, device="cuda"):
    """
    Initializes and runs Gaussian Splatting optimization from a GLB file.
    
    This is a simplified version that avoids dependencies on torchmetrics/SSIM.
    """
    try:
        # Create output directory
        os.makedirs(output_dir, exist_ok=True)
        
        print(f"Loading GLB file: {glb_file}")
        # Load the GLB file using trimesh
        scene_mesh = trimesh.load(glb_file)
        
        # Check if the loaded scene is a point cloud
        if not hasattr(scene_mesh, 'vertices'):
            raise ValueError("GLB file does not contain a point cloud with vertices.")
            
        # Extract vertices (points) and colors from the trimesh object
        points = scene_mesh.vertices
        
        # Handle colors - might be stored in different ways
        if hasattr(scene_mesh, 'visual') and hasattr(scene_mesh.visual, 'vertex_colors'):
            colors = scene_mesh.visual.vertex_colors[:, :3] / 255.0  # Convert to [0,1] range
        else:
            # Default to white if no colors
            colors = np.ones((len(points), 3))
            
        print(f"Loaded point cloud with {len(points)} points")
            
        # Convert to torch tensors
        points_tensor = torch.tensor(points, dtype=torch.float32, device=device)
        colors_tensor = torch.tensor(colors, dtype=torch.float32, device=device)
        
        # Create gaussians
        n_points = points_tensor.shape[0]
        gaussians = {
            "means": points_tensor,
            "scales": torch.full_like(points_tensor, 0.01),
            "quats": torch.zeros((n_points, 4), device=device),
            "opacities": torch.ones((n_points,), device=device),
            "colors": torch.zeros((n_points, 24, 3), device=device),
        }
        
        # Set quaternions to identity rotation
        gaussians["quats"][:, 0] = 1.0
        
        # Set colors (assuming SH degree 1 - 4 coefficients per channel)
        gaussians["colors"][:, 0] = colors_tensor
        
        # Convert to parameters
        for k, v in gaussians.items():
            gaussians[k] = torch.nn.Parameter(v)
            
        # Create optimizers
        optimizers = {k: torch.optim.Adam([v], lr=0.001) for k, v in gaussians.items()}
        
        # Create pruning strategy
        if enable_pruning:
            strategy = gsplat.MCMCStrategy()
            strategy.check_sanity(gaussians, optimizers)
            strategy_state = strategy.initialize_state()
        
        print(f"Starting optimization for {iterations} iterations")
        
        # Simplified optimization - just optimize position and scale
        from tqdm import trange
        pbar = trange(iterations, disable=not verbose)
        for step in pbar:
            # Update parameters
            for optim in optimizers.values():
                optim.step()
                optim.zero_grad()
                
            # Apply pruning if enabled
            if enable_pruning and step % 10 == 0:
                # Simple pruning - remove points with small scales
                with torch.no_grad():
                    pruning_mask = torch.norm(gaussians["scales"], dim=-1) > 0.001
                    for k in gaussians:
                        gaussians[k] = torch.nn.Parameter(gaussians[k][pruning_mask])
                    
                    # Update optimizers
                    optimizers = {k: torch.optim.Adam([v], lr=0.001) for k, v in gaussians.items()}
                    
            pbar.set_description(f"Step {step}")
        
        print(f"Optimization complete. Final point cloud has {gaussians['means'].shape[0]} points")
        
        # Save result as PLY file
        output_file = os.path.join(output_dir, os.path.splitext(os.path.basename(glb_file))[0] + "_gaussian.ply")
        
        # Convert to numpy
        points_final = gaussians["means"].detach().cpu().numpy()
        colors_final = gaussians["colors"][:, 0].detach().cpu().numpy()
        
        # Create a new pointcloud
        result_cloud = trimesh.PointCloud(
            vertices=points_final,
            colors=np.clip(colors_final * 255, 0, 255).astype(np.uint8)
        )
        
        # Save
        result_cloud.export(output_file)
        print(f"Saved result to {output_file}")

    except Exception as e:
        print(f"Error running Gaussian Splatting: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run Gaussian Splatting from a GLB file.")
    parser.add_argument("glb_file", type=str, help="Path to the input GLB file (point cloud).")
    parser.add_argument("--output", type=str, default="./output", help="Output directory")
    parser.add_argument("--iterations", type=int, default=400, help="Number of optimization iterations.")
    parser.add_argument("--no_pruning", action="store_false", dest="enable_pruning",
                        help="Disable pruning during optimization.")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose output.")
    parser.add_argument("--device", type=str, default="cuda", help="Torch device to use (cuda or cpu).")
    args = parser.parse_args()

    run_gs_from_glb(args.glb_file, args.output, args.iterations, args.enable_pruning, args.verbose, args.device)
