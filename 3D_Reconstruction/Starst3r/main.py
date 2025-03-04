"""
Testing script
"""

import os
# Set PyTorch memory allocation for better GPU memory handling
os.environ['PYTORCH_CUDA_ALLOC_CONF'] = 'expandable_segments:True'

import sys
sys.path.append("mast3r")
sys.path.append("mast3r/dust3r")
sys.path.append("mast3r/dust3r/croco")

from pathlib import Path

import starster
import torch
import argparse  # Import argparse
import numpy as np
import cv2

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
RES = 256

torch.serialization.add_safe_globals([argparse.Namespace]) # Add this line

# Load image files
files = []
dir = Path("D:/CS210/Phoenix-Recon/3D_Reconstruction/open_mvg/images").absolute()
for file in dir.iterdir():
    if file.suffix.lower() == ".jpg":
        files.append(str(file))

# Load images and resize to target resolution
imgs = []
for file in files:
    imgs.append(starster.load_image(file, RES))

# Load Mast3r model
model = starster.Mast3rModel.from_pretrained(
    "D:/CS210/Phoenix-Recon/3D_Reconstruction/mast3r/docker/files/checkpoints/MASt3R_ViTLarge_BaseDecoder_512_catmlpdpt_metric.pth"
).to(DEVICE)

# Initialize scene and add images
scene = starster.Scene(device=DEVICE)
scene.add_images(model, imgs[:2])
scene.add_images(model, imgs[2:])

print(scene.imgs[0].shape)

# Initialize 3D Gaussian Splatting with smaller initial scale
scene.init_3dgs(init_scale=1e-3)

# Run optimization with increased iterations
print("Running initial optimization (1200 iterations with pruning)...")
for _ in range(6):
    scene.run_3dgs_optim(200, enable_pruning=True, verbose=True)  # More iterations
print("Running final optimization (200 iterations without pruning)...")
scene.run_3dgs_optim(200, enable_pruning=False, verbose=True)

# Render views and save images
imgs, alpha, info = scene.render_3dgs_original(RES, RES)
print(f"Rendered {imgs.shape[0]} views")
imgs = torch.clip(imgs.detach().cpu(), 0, 1)
imgs = (imgs.numpy()[..., ::-1] * 255).astype(np.uint8)

# Create imgs directory if it doesn't exist
os.makedirs("imgs", exist_ok=True)

for i, img in enumerate(imgs):
    cv2.imwrite(f"imgs/{i}.png", img)

# Export 3D model using Open3D
print("\n--------- Exporting 3D Model ---------")
try:
    import open3d as o3d
    
    # Create output directory
    os.makedirs("models", exist_ok=True)
    
    # Export Gaussian centers as point cloud
    print("Converting Gaussians to point cloud...")
    means = scene.gaussians["means"].detach().cpu().numpy()
    colors = 1 - scene.gaussians["sh0"][:, 0].detach().cpu().numpy()  # Recover colors
    
    # Create Open3D point cloud
    pcd = o3d.geometry.PointCloud()
    pcd.points = o3d.utility.Vector3dVector(means)
    pcd.colors = o3d.utility.Vector3dVector(colors)
    
    # After creating the point cloud, filter outliers
    # For point cloud pre-processing
    # Use smaller voxel size for more detail
    voxel_size = 0.002  # Reducing this increases detail
    pcd = pcd.voxel_down_sample(voxel_size=voxel_size)

    # Don't be too aggressive with outlier removal
    cl, ind = pcd.remove_statistical_outlier(nb_neighbors=30, std_ratio=2.5)  # Allow more points

    # Better normal estimation
    pcd.estimate_normals(
        search_param=o3d.geometry.KDTreeSearchParamHybrid(radius=0.01, max_nn=30)
    )
    # Use a standard viewpoint or estimate one from the point cloud
    estimated_camera_pos = np.mean(np.asarray(pcd.points), axis=0) + np.array([0, 0, 1])  # Position above the center
    pcd.orient_normals_towards_camera_location(estimated_camera_pos)

    # Save raw point cloud
    point_cloud_path = "models/scene_point_cloud.ply"
    o3d.io.write_point_cloud(point_cloud_path, pcd)
    print(f"Exported point cloud with {len(means)} points to {point_cloud_path}")
    
    # Estimate normals for better mesh reconstruction
    print("Estimating point normals...")
    pcd.estimate_normals(
        search_param=o3d.geometry.KDTreeSearchParamHybrid(radius=0.1, max_nn=30)
    )
    pcd.orient_normals_consistent_tangent_plane(100)
    
    # Try different mesh reconstruction methods
    
    # 1. Alpha shapes - fast but may not work well for all point clouds
    print("\nMethod 1: Creating mesh with Alpha Shapes...")
    try:
        # For Alpha Shapes - try much smaller alpha values
        for alpha_value in [0.005, 0.0075, 0.01]:  # Try smaller alpha values for denser mesh
            mesh_alpha = o3d.geometry.TriangleMesh.create_from_point_cloud_alpha_shape(pcd, alpha_value)
            mesh_alpha.compute_vertex_normals()
            
            # Paint the mesh vertices using the point cloud colors
            if len(mesh_alpha.vertices) > 0:
                vertex_colors = np.asarray(pcd.colors)
                if len(vertex_colors) > 0:
                    mesh_alpha.vertex_colors = o3d.utility.Vector3dVector(
                        np.tile(np.mean(vertex_colors, axis=0), (len(mesh_alpha.vertices), 1))
                    )
                
                # Save the alpha shape mesh
                alpha_mesh_path = "models/scene_mesh_alpha.ply"
                o3d.io.write_triangle_mesh(alpha_mesh_path, mesh_alpha)
                print(f"Alpha Shape mesh saved to {alpha_mesh_path}")
    except Exception as e:
        print(f"Alpha Shape reconstruction failed: {e}")
    
    # 2. Ball pivoting - better for uniformly sampled point clouds
    print("\nMethod 2: Creating mesh with Ball Pivoting...")
    try:
        # For Ball Pivoting - adjust based on point cloud density
        # Calculate average point distance for better radius selection
        avg_dist = 0
        pcd_tree = o3d.geometry.KDTreeFlann(pcd)
        for i in range(min(1000, len(pcd.points))):
            [_, idx, dist] = pcd_tree.search_knn_vector_3d(pcd.points[i], 11)
            avg_dist += np.mean(dist[1:])
        avg_dist /= min(1000, len(pcd.points))
        base_radius = np.sqrt(avg_dist) * 1.5  # Smaller multiplier for denser mesh

        # Ball pivoting radii should be adjusted based on point cloud
        radii = [base_radius * 0.25, base_radius * 0.5, base_radius, base_radius * 2]
        mesh_bpa = o3d.geometry.TriangleMesh.create_from_point_cloud_ball_pivoting(
            pcd, o3d.utility.DoubleVector(radii)
        )
        mesh_bpa.compute_vertex_normals()
        
        # Paint the mesh
        if len(mesh_bpa.vertices) > 0:
            # Transfer colors from point cloud to mesh
            mesh_colors = np.zeros((len(mesh_bpa.vertices), 3))
            vertices = np.asarray(mesh_bpa.vertices)
            points = np.asarray(pcd.points)
            point_colors = np.asarray(pcd.colors)
            
            # Find nearest points for each vertex
            from scipy.spatial import KDTree
            tree = KDTree(points)
            distances, indices = tree.query(vertices, k=1)
            
            # Assign colors
            mesh_colors = point_colors[indices]
            mesh_bpa.vertex_colors = o3d.utility.Vector3dVector(mesh_colors)
            
            # Save Ball Pivoting mesh
            bpa_mesh_path = "models/scene_mesh_ball_pivot.ply"
            o3d.io.write_triangle_mesh(bpa_mesh_path, mesh_bpa)
            print(f"Ball Pivoting mesh saved to {bpa_mesh_path}")
    except Exception as e:
        print(f"Ball Pivoting reconstruction failed: {e}")
    
    # 3. Poisson reconstruction - usually best quality but can be slower
    print("\nMethod 3: Creating mesh with Poisson reconstruction...")
    try:
        # For Poisson reconstruction
        # Higher depth for more detail
        mesh_poisson, densities = o3d.geometry.TriangleMesh.create_from_point_cloud_poisson(
            pcd, depth=10, width=0, scale=1.1, linear_fit=False
        )
        
        # Less aggressive density filtering to keep more points
        density_threshold = np.quantile(densities, 0.05)  # Only remove the bottom 5%
        print(f"  Filtering mesh with density threshold: {density_threshold}")
        vertices_to_remove = densities < density_threshold
        mesh_poisson.remove_vertices_by_mask(vertices_to_remove)
        
        mesh_poisson.compute_vertex_normals()
        
        # Color the mesh
        if len(mesh_poisson.vertices) > 0:
            # Transfer colors from point cloud to mesh using KDTree
            vertices = np.asarray(mesh_poisson.vertices)
            points = np.asarray(pcd.points)
            point_colors = np.asarray(pcd.colors)
            
            # Find nearest points for each vertex
            from scipy.spatial import KDTree
            tree = KDTree(points)
            distances, indices = tree.query(vertices, k=3)  # Get 3 nearest points
            
            # Weight colors by distance
            weights = 1.0 / (distances + 1e-10)
            weights_sum = np.sum(weights, axis=1, keepdims=True)
            weights = weights / weights_sum
            
            # Calculate weighted average colors
            vertex_colors = np.zeros((len(vertices), 3))
            for i in range(3):  # For each of the 3 nearest neighbors
                vertex_colors += weights[:, i:i+1] * point_colors[indices[:, i]]
            
            # Explicitly clamp colors to [0,1] range to avoid the warning
            vertex_colors = np.clip(vertex_colors, 0.0, 1.0)
            
            mesh_poisson.vertex_colors = o3d.utility.Vector3dVector(vertex_colors)
            
            # Save Poisson mesh
            poisson_mesh_path = "models/scene_mesh_poisson.ply"
            o3d.io.write_triangle_mesh(poisson_mesh_path, mesh_poisson)
            print(f"Poisson mesh saved to {poisson_mesh_path}")
    except Exception as e:
        print(f"Poisson reconstruction failed: {e}")

    # First create a coarse reconstruction
    mesh_poisson_coarse, _ = o3d.geometry.TriangleMesh.create_from_point_cloud_poisson(
        pcd, depth=8, scale=1.1
    )

    # Then refine it with a second pass
    mesh_poisson_coarse.compute_vertex_normals()
    points_refined = mesh_poisson_coarse.sample_points_uniformly(100000)  # Sample points from mesh
    points_refined.estimate_normals()

    # Create a refined mesh
    mesh_poisson_refined, _ = o3d.geometry.TriangleMesh.create_from_point_cloud_poisson(
        points_refined, depth=10, scale=1.0
    )
    
    # After creating any mesh, apply post-processing
    mesh_poisson = mesh_poisson.filter_smooth_simple(number_of_iterations=5)
    mesh_poisson.compute_vertex_normals()

    # Optional: Simplify the mesh to remove small artifacts
    mesh_poisson = mesh_poisson.simplify_quadric_decimation(
        target_number_of_triangles=100000
    )
        
    print("\nMesh creation complete. Check the 'models' directory for output files.")
    print("You can visualize these meshes using tools like MeshLab, Blender, or Open3D's visualization.")
    
    # Poisson-specific improvements
    print("\nFocused Poisson mesh reconstruction...")

    # 1. Ensure high-quality normals (critical for Poisson)
    pcd.estimate_normals(
        search_param=o3d.geometry.KDTreeSearchParamHybrid(radius=0.01, max_nn=50)
    )
    pcd.orient_normals_consistent_tangent_plane(100)

    # 2. Run Poisson at multiple depths to find best quality
    best_poisson_mesh = None
    best_quality_score = -1

    for depth in [9, 10, 11]:
        print(f"  Testing Poisson reconstruction at depth {depth}...")
        mesh_poisson, densities = o3d.geometry.TriangleMesh.create_from_point_cloud_poisson(
            pcd, depth=depth, width=0, scale=1.1, linear_fit=False
        )
        
        if len(mesh_poisson.vertices) == 0:
            continue
        
        # Only filter the very sparse areas (bottom 2%)
        density_threshold = np.quantile(densities, 0.02)
        print(f"  Filtering sparse areas (threshold: {density_threshold:.6f})...")
        vertices_to_remove = densities < density_threshold
        mesh_poisson.remove_vertices_by_mask(vertices_to_remove)
        
        # Calculate a quality score (higher is better)
        # Based on mesh density vs complexity
        vertex_count = len(mesh_poisson.vertices)
        triangle_count = len(mesh_poisson.triangles)
        if triangle_count == 0:
            continue
        
        # Quality metric: vertex/triangle ratio, normalized by depth
        # Higher values indicate better mesh quality
        quality_score = (vertex_count / triangle_count) * (depth / 10)
        print(f"  Quality score: {quality_score:.4f} (vertices: {vertex_count}, triangles: {triangle_count})")
        
        if quality_score > best_quality_score:
            best_quality_score = quality_score
            best_poisson_mesh = mesh_poisson
            print(f"  ✓ New best mesh found at depth {depth}!")

    # Use the best poisson mesh for further processing
    if best_poisson_mesh is not None:
        mesh_poisson = best_poisson_mesh
        
        # Apply gentle smoothing to remove noise while preserving features
        mesh_poisson = mesh_poisson.filter_smooth_taubin(number_of_iterations=5)
        mesh_poisson.compute_vertex_normals()
        
        # Save the optimized Poisson mesh
        optimized_poisson_path = "models/scene_mesh_poisson_optimized.ply"
        o3d.io.write_triangle_mesh(optimized_poisson_path, mesh_poisson)
        print(f"Optimized Poisson mesh saved to {optimized_poisson_path}")
    
except ImportError:
    print("Please install Open3D: pip install open3d")
    
    # Fallback: Export just the point cloud using NumPy/plyfile
    try:
        print("Falling back to basic point cloud export...")
        from plyfile import PlyData, PlyElement
        
        os.makedirs("models", exist_ok=True)
        
        # Export Gaussian centers as point cloud
        means = scene.gaussians["means"].detach().cpu().numpy()
        colors = 1 - scene.gaussians["sh0"][:, 0].detach().cpu().numpy()  # Recover colors
        
        # Create PLY structure
        vertices = np.zeros(means.shape[0], dtype=[
            ('x', 'f4'), ('y', 'f4'), ('z', 'f4'),
            ('red', 'u1'), ('green', 'u1'), ('blue', 'u1')
        ])
        
        # Fill with data
        vertices['x'] = means[:, 0]
        vertices['y'] = means[:, 1]
        vertices['z'] = means[:, 2]
        vertices['red'] = (colors[:, 0] * 255).astype(np.uint8)
        vertices['green'] = (colors[:, 1] * 255).astype(np.uint8)
        vertices['blue'] = (colors[:, 2] * 255).astype(np.uint8)
        
        # Create and write PLY
        el = PlyElement.describe(vertices, 'vertex')
        point_cloud_path = "models/scene_point_cloud.ply"
        PlyData([el]).write(point_cloud_path)
        print(f"Exported basic point cloud to {point_cloud_path}")
        print("Install Open3D or use tools like MeshLab to convert this to a mesh.")
    except Exception as e:
        print(f"Basic point cloud export failed: {e}")
