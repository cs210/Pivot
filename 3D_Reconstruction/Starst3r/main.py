"""
3D Reconstruction Script with Configurable Parameters
"""

import os
import sys
from pathlib import Path
import torch
import argparse
import numpy as np
import cv2

# Add Open3D import at the top level
try:
    import open3d as o3d
    OPEN3D_AVAILABLE = True
except ImportError:
    OPEN3D_AVAILABLE = False
    print("Open3D not available. Install with: pip install open3d")

# =============================================================================
# HYPERPARAMETERS - Tweak these values to adjust reconstruction quality
# =============================================================================

# General Settings
RES = 312                    # Image resolution for processing
USE_CUDA = True              # Whether to use GPU acceleration

# Input/Output Paths
IMAGE_DIR = "D:/CS210/Phoenix-Recon/3D_Reconstruction/open_mvg/images"
MODEL_CHECKPOINT = "D:/CS210/Phoenix-Recon/3D_Reconstruction/mast3r/docker/files/checkpoints/MASt3R_ViTLarge_BaseDecoder_512_catmlpdpt_metric.pth"
OUTPUT_DIR = "models"        # Directory to save 3D models
RENDER_DIR = "imgs"          # Directory to save rendered images

# 3DGS Parameters
INIT_SCALE = 1e-4            # Initial scale for Gaussian points (smaller = more detail)
ENABLE_PRUNING = True        # Enable pruning during optimization
NUM_COARSE_ITERS = 2        # Number of coarse optimization batches
COARSE_ITERS = 200           # Iterations per coarse optimization batch
NUM_FINE_ITERS = 1           # Number of fine optimization batches
FINE_ITERS = 200             # Iterations per fine optimization batch (no pruning)

# Loss Weights for 3DGS Optimization
LOSS_OPACITY_FAC = 0.005     # Opacity loss factor (higher = sparser points)
LOSS_SCALE_FAC = 0.005       # Scale loss factor (higher = larger gaussians)
LOSS_SSIM_FAC = 0.2          # SSIM loss factor

# Point Cloud Processing
VOXEL_SIZE = 0.002           # Larger voxels = smoother but less detailed
OUTLIER_NEIGHBORS = 40       # More neighbors for better outlier detection
OUTLIER_STD = 1.8            # Lower threshold = more aggressive filtering

# Normal Estimation
NORMAL_RADIUS = 0.02         # Larger radius for smoother normals
NORMAL_MAX_NN = 100          # Many neighbors for stable normals

# Alpha Shape Parameters
ALPHA_VALUES = [0.005, 0.0075, 0.01]  # Alpha values to try

# Ball Pivoting Parameters
BP_RADIUS_MULT = [0.25, 0.5, 1.0, 2.0]  # Multipliers for ball pivot radius

# Poisson Reconstruction Parameters
POISSON_DEPTHS = [8, 9]      # Lower depths = smoother surfaces
POISSON_SCALE = 1.2          # Slightly larger to fill holes
POISSON_LINEAR_FIT = True    # Better for noisy data
POISSON_DENSITY_QUANTILE = 0.03  # Higher threshold = cleaner results

# Mesh Postprocessing
SMOOTHING_ITERATIONS = 15    # More iterations = smoother result
TARGET_TRIANGLES = 80000     # Fewer triangles = smoother simplified mesh

# MASt3R Parameters
MAST3R_CONF_THRESHOLD = 0.8  # Confidence threshold for MASt3R feature matching (0.5-1.5)
                             # Lower values retain more points (possibly noisier)
                             # Higher values keep only high-confidence points
IMAGE_BATCH_SIZE = 2         # Number of images to process in each batch

# =============================================================================
# SETUP
# =============================================================================

# Set PyTorch memory allocation for better GPU memory handling
os.environ['PYTORCH_CUDA_ALLOC_CONF'] = 'expandable_segments:True'

# Add required paths
sys.path.append("mast3r")
sys.path.append("mast3r/dust3r")
sys.path.append("mast3r/dust3r/croco")

# Set device
DEVICE = torch.device("cuda" if USE_CUDA and torch.cuda.is_available() else "cpu")
print(f"Using device: {DEVICE}")

# Add required workaround for argparse
torch.serialization.add_safe_globals([argparse.Namespace])

# Create output directories
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(RENDER_DIR, exist_ok=True)

# =============================================================================
# MAIN FUNCTION
# =============================================================================

def main():
    # Import starster here to avoid import errors if CUDA isn't available
    import starster
    
    # Load image files
    print("Loading images...")
    files = []
    dir_path = Path(IMAGE_DIR).absolute()
    for file in dir_path.iterdir():
        if file.suffix.lower() == ".jpg":
            files.append(str(file))
    
    if not files:
        print(f"No images found in {IMAGE_DIR}")
        return
    
    print(f"Found {len(files)} images")
    
    # Load images and resize to target resolution
    imgs = []
    for file in files:
        imgs.append(starster.load_image(file, RES))
    
    # Load Mast3r model
    print("Loading Mast3r model...")
    model = starster.Mast3rModel.from_pretrained(MODEL_CHECKPOINT).to(DEVICE)
    
    # Initialize scene and add images
    print("Creating scene and adding images...")
    scene = starster.Scene(device=DEVICE)

    # Process images in batches with confidence threshold
    print(f"Using MASt3R confidence threshold: {MAST3R_CONF_THRESHOLD}")
    for i in range(0, len(imgs), IMAGE_BATCH_SIZE):
        batch = imgs[i:i+IMAGE_BATCH_SIZE]
        print(f"Adding batch of {len(batch)} images ({i+1}-{min(i+IMAGE_BATCH_SIZE, len(imgs))}/{len(imgs)})...")
        scene.add_images(model, batch, conf_thres=MAST3R_CONF_THRESHOLD)

    print(f"Scene created with image shape: {scene.imgs[0].shape}")
    
    # Initialize 3D Gaussian Splatting with configured initial scale
    print("Initializing 3D Gaussian Splatting...")
    scene.init_3dgs(init_scale=INIT_SCALE)
    
    # Run optimization with configured iterations
    print(f"Running coarse optimization ({NUM_COARSE_ITERS} batches of {COARSE_ITERS} iterations with pruning)...")
    for i in range(NUM_COARSE_ITERS):
        print(f"Batch {i+1}/{NUM_COARSE_ITERS}")
        scene.run_3dgs_optim(
            COARSE_ITERS, 
            enable_pruning=ENABLE_PRUNING, 
            loss_opacity_fac=LOSS_OPACITY_FAC,
            loss_scale_fac=LOSS_SCALE_FAC,
            loss_ssim_fac=LOSS_SSIM_FAC,
            verbose=True
        )
    
    print(f"Running fine optimization ({NUM_FINE_ITERS} batches of {FINE_ITERS} iterations without pruning)...")
    for i in range(NUM_FINE_ITERS):
        print(f"Batch {i+1}/{NUM_FINE_ITERS}")
        scene.run_3dgs_optim(
            FINE_ITERS, 
            enable_pruning=False,
            loss_opacity_fac=LOSS_OPACITY_FAC/2,  # Reduce penalties for final refinement
            loss_scale_fac=LOSS_SCALE_FAC/2,
            loss_ssim_fac=LOSS_SSIM_FAC,
            verbose=True
        )
    
    # Render views and save images
    print("Rendering views...")
    imgs, alpha, info = scene.render_3dgs_original(RES, RES)
    print(f"Rendered {imgs.shape[0]} views")
    imgs = torch.clip(imgs.detach().cpu(), 0, 1)
    imgs = (imgs.numpy()[..., ::-1] * 255).astype(np.uint8)
    
    # Save rendered images
    for i, img in enumerate(imgs):
        cv2.imwrite(f"{RENDER_DIR}/{i}.png", img)
    
    # Export 3D model using Open3D if available
    export_mesh(scene)

# =============================================================================
# MESH EXPORT FUNCTION
# =============================================================================

# Update export_mesh function to use global o3d

def export_mesh(scene):
    print("\n--------- Exporting 3D Model ---------")
    if not OPEN3D_AVAILABLE:
        print("Open3D not found. Falling back to basic point cloud export.")
        export_basic_point_cloud(scene)
        return
        
    # Export Gaussian centers as point cloud
    print("Converting Gaussians to point cloud...")
    means = scene.gaussians["means"].detach().cpu().numpy()
    colors = 1 - scene.gaussians["sh0"][:, 0].detach().cpu().numpy()  # Recover colors
    
    # Create Open3D point cloud
    pcd = o3d.geometry.PointCloud()
    pcd.points = o3d.utility.Vector3dVector(means)
    pcd.colors = o3d.utility.Vector3dVector(colors)
    
    # Pre-process point cloud
    print("Pre-processing point cloud...")
    pcd = pre_process_point_cloud(pcd)
    
    # Save processed point cloud
    point_cloud_path = f"{OUTPUT_DIR}/scene_point_cloud.ply"
    o3d.io.write_point_cloud(point_cloud_path, pcd)
    print(f"Exported processed point cloud with {len(pcd.points)} points to {point_cloud_path}")
    
    # Generate meshes using different methods
    generate_alpha_shape_meshes(pcd)
    generate_ball_pivoting_mesh(pcd)
    generate_poisson_meshes(pcd)
    
    print("\nMesh creation complete. Check the output directory for mesh files.")
    print("You can visualize these meshes using tools like MeshLab, Blender, or Open3D's visualization.")

# =============================================================================
# POINT CLOUD PROCESSING FUNCTIONS
# =============================================================================

def pre_process_point_cloud(pcd):
    """Apply pre-processing steps to point cloud for better mesh reconstruction."""
    # First voxel pass to unify density
    print(f"  Initial downsampling with voxel size {VOXEL_SIZE*2}...")
    pcd = pcd.voxel_down_sample(voxel_size=VOXEL_SIZE*2)
    
    # Statistical outlier removal (first pass - aggressive)
    print(f"  Removing gross outliers...")
    cl, ind = pcd.remove_statistical_outlier(nb_neighbors=OUTLIER_NEIGHBORS, std_ratio=OUTLIER_STD*0.8)
    pcd = cl
    
    # Second voxel pass for final density
    print(f"  Final downsampling with voxel size {VOXEL_SIZE}...")
    pcd = pcd.voxel_down_sample(voxel_size=VOXEL_SIZE)
    
    # Second outlier pass (finer)
    print(f"  Removing fine outliers...")
    cl, ind = pcd.remove_statistical_outlier(nb_neighbors=OUTLIER_NEIGHBORS, std_ratio=OUTLIER_STD)
    pcd = cl
    
    # Normal estimation with careful parameters
    print(f"  Estimating smooth normals...")
    pcd.estimate_normals(
        search_param=o3d.geometry.KDTreeSearchParamHybrid(radius=NORMAL_RADIUS, max_nn=NORMAL_MAX_NN)
    )
    
    # Apply normal filtering to smooth normals (this helps create smoother meshes)
    normal_arr = np.asarray(pcd.normals)
    for _ in range(2):  # 2 iterations of normal smoothing
        smooth_normals = np.zeros_like(normal_arr)
        tree = o3d.geometry.KDTreeFlann(pcd)
        for i in range(len(pcd.points)):
            [k, idx, _] = tree.search_knn_vector_3d(pcd.points[i], 10)
            smooth_normals[i] = np.mean(normal_arr[idx], axis=0)
        smooth_normals = smooth_normals / np.linalg.norm(smooth_normals, axis=1, keepdims=True)
        normal_arr = smooth_normals
    
    pcd.normals = o3d.utility.Vector3dVector(normal_arr)
    
    # Orient normals consistently
    print("  Orienting normals...")
    estimated_camera_pos = np.mean(np.asarray(pcd.points), axis=0) + np.array([0, 0, 1])
    pcd.orient_normals_towards_camera_location(estimated_camera_pos)
    
    return pcd

# =============================================================================
# MESH GENERATION FUNCTIONS
# =============================================================================

def generate_alpha_shape_meshes(pcd):
    """Generate meshes using Alpha Shape algorithm with different alpha values."""
    print("\nMethod 1: Creating mesh with Alpha Shapes...")
    try:
        best_alpha_mesh = None
        best_alpha_triangle_count = 0
        
        for alpha_value in ALPHA_VALUES:
            print(f"  Creating alpha shape with alpha={alpha_value}...")
            mesh_alpha = o3d.geometry.TriangleMesh.create_from_point_cloud_alpha_shape(pcd, alpha_value)
            mesh_alpha.compute_vertex_normals()
            
            if len(mesh_alpha.vertices) > 0:
                # Color the mesh
                color_mesh_from_point_cloud(mesh_alpha, pcd)
                
                # Save the alpha shape mesh
                alpha_mesh_path = f"{OUTPUT_DIR}/scene_mesh_alpha_{alpha_value:.4f}.ply"
                o3d.io.write_triangle_mesh(alpha_mesh_path, mesh_alpha)
                print(f"  Alpha Shape mesh with alpha={alpha_value} saved with {len(mesh_alpha.triangles)} triangles")
                
                # Track the best alpha mesh (most triangles, up to a reasonable limit)
                if len(mesh_alpha.triangles) > best_alpha_triangle_count and len(mesh_alpha.triangles) < 1000000:
                    best_alpha_triangle_count = len(mesh_alpha.triangles)
                    best_alpha_mesh = mesh_alpha
        
        # Save the best alpha mesh
        if best_alpha_mesh is not None:
            best_alpha_path = f"{OUTPUT_DIR}/scene_mesh_alpha_best.ply"
            o3d.io.write_triangle_mesh(best_alpha_path, best_alpha_mesh)
            print(f"Best alpha shape mesh (with {best_alpha_triangle_count} triangles) saved")
            
    except Exception as e:
        print(f"Alpha Shape reconstruction failed: {e}")

def generate_ball_pivoting_mesh(pcd):
    """Generate mesh using Ball Pivoting algorithm."""
    print("\nMethod 2: Creating mesh with Ball Pivoting...")
    try:
        # Calculate average point distance for better radius selection
        avg_dist = 0
        pcd_tree = o3d.geometry.KDTreeFlann(pcd)
        for i in range(min(1000, len(pcd.points))):
            [_, idx, dist] = pcd_tree.search_knn_vector_3d(pcd.points[i], 11)
            avg_dist += np.mean(dist[1:])
        avg_dist /= min(1000, len(pcd.points))
        base_radius = np.sqrt(avg_dist) * 1.5
        
        # Create radius array
        radii = [base_radius * mult for mult in BP_RADIUS_MULT]
        print(f"  Using ball radii: {[f'{r:.6f}' for r in radii]}")
        
        mesh_bpa = o3d.geometry.TriangleMesh.create_from_point_cloud_ball_pivoting(
            pcd, o3d.utility.DoubleVector(radii)
        )
        mesh_bpa.compute_vertex_normals()
        
        if len(mesh_bpa.vertices) > 0:
            # Color the mesh
            color_mesh_from_point_cloud(mesh_bpa, pcd)
            
            # Save Ball Pivoting mesh
            bpa_mesh_path = f"{OUTPUT_DIR}/scene_mesh_ball_pivot_r{base_radius:.4f}.ply"
            o3d.io.write_triangle_mesh(bpa_mesh_path, mesh_bpa)
            print(f"Ball Pivoting mesh saved with {len(mesh_bpa.triangles)} triangles")
            
            # Also save with standard name
            std_bpa_path = f"{OUTPUT_DIR}/scene_mesh_ball_pivot.ply"
            o3d.io.write_triangle_mesh(std_bpa_path, mesh_bpa)
    except Exception as e:
        print(f"Ball Pivoting reconstruction failed: {e}")

def generate_poisson_meshes(pcd):
    """Generate meshes using Poisson Surface Reconstruction at different depths."""
    print("\nMethod 3: Creating mesh with Poisson reconstruction...")
    try:
        best_poisson_mesh = None
        best_quality_score = -1
        best_depth = 0
        
        for depth in POISSON_DEPTHS:
            print(f"  Testing Poisson reconstruction at depth {depth}...")
            try:
                # Set parameters for Poisson reconstruction
                mesh_poisson, densities = o3d.geometry.TriangleMesh.create_from_point_cloud_poisson(
                    pcd, depth=depth, width=0, scale=POISSON_SCALE, linear_fit=POISSON_LINEAR_FIT
                )
                
                if len(mesh_poisson.vertices) == 0:
                    print("  No vertices generated at this depth.")
                    continue
                    
                # Save raw mesh before filtering
                raw_mesh_path = f"{OUTPUT_DIR}/scene_mesh_poisson_raw_d{depth}.ply"
                o3d.io.write_triangle_mesh(raw_mesh_path, mesh_poisson)
                
                # Filter by density (keeping more points)
                density_threshold = np.quantile(densities, POISSON_DENSITY_QUANTILE)
                print(f"  Filtering mesh with density threshold: {density_threshold:.6f}")
                vertices_to_remove = densities < density_threshold
                mesh_poisson.remove_vertices_by_mask(vertices_to_remove)
                
                # Clean mesh
                mesh_poisson = clean_mesh(mesh_poisson)
                
                # Compute normals
                mesh_poisson.compute_vertex_normals()
                
                # Calculate metrics
                vertex_count = len(mesh_poisson.vertices)
                triangle_count = len(mesh_poisson.triangles)
                
                if triangle_count < 100 or vertex_count < 100:
                    print(f"  Too few vertices ({vertex_count}) or triangles ({triangle_count}) after filtering.")
                    continue
                
                # Calculate quality score
                quality_score = triangle_count * (1 - abs(2.0 - triangle_count/max(1, vertex_count)))
                print(f"  Quality score: {quality_score:.1f} (vertices: {vertex_count}, triangles: {triangle_count})")
                
                # Color the mesh from point cloud
                color_mesh_from_point_cloud(mesh_poisson, pcd)
                
                # Save the filtered mesh for this depth
                filtered_mesh_path = f"{OUTPUT_DIR}/scene_mesh_poisson_d{depth}.ply"
                o3d.io.write_triangle_mesh(filtered_mesh_path, mesh_poisson)
                print(f"  Poisson mesh (depth={depth}) saved to {filtered_mesh_path}")
                
                # Track best mesh quality
                if quality_score > best_quality_score:
                    best_quality_score = quality_score
                    best_depth = depth
                    # Save this mesh's data for later use
                    print(f"  ✓ New best mesh found at depth {depth}!")
            
            except Exception as e:
                print(f"  Error at depth {depth}: {e}")
                
        # Process the best mesh separately (after the loop)
        if best_depth > 0:
            print(f"\nPost-processing best Poisson mesh (depth={best_depth})...")
            # Reload the best mesh from file instead of using clone()
            best_mesh_path = f"{OUTPUT_DIR}/scene_mesh_poisson_d{best_depth}.ply"
            best_poisson_mesh = o3d.io.read_triangle_mesh(best_mesh_path)
            
            if len(best_poisson_mesh.vertices) > 0:
                # Apply smoothing using Taubin method (preserves volume better)
                print("  Applying Taubin smoothing...")

                # OLD SMOOTHING METHOD
                # best_poisson_mesh = best_poisson_mesh.filter_smooth_taubin(
                #     number_of_iterations=SMOOTHING_ITERATIONS,
                #     lambda_filter=0.5,
                #     mu=-0.53  # Standard value to prevent shrinking
                # )
                
                # NEW SMOOTHING METHOD
                best_poisson_mesh = apply_advanced_smoothing(best_poisson_mesh, SMOOTHING_ITERATIONS)

                best_poisson_mesh.compute_vertex_normals()
                
                # Save the optimized mesh
                optimized_poisson_path = f"{OUTPUT_DIR}/scene_mesh_poisson_optimized_d{best_depth}.ply"
                o3d.io.write_triangle_mesh(optimized_poisson_path, best_poisson_mesh)
                print(f"  Optimized Poisson mesh saved to {optimized_poisson_path}")
                
                # Create simplified version if needed
                if len(best_poisson_mesh.triangles) > TARGET_TRIANGLES:
                    print(f"  Creating simplified version ({len(best_poisson_mesh.triangles)} → {TARGET_TRIANGLES} triangles)...")
                    mesh_simplified = best_poisson_mesh.simplify_quadric_decimation(TARGET_TRIANGLES)
                    mesh_simplified.compute_vertex_normals()
                    simple_mesh_path = f"{OUTPUT_DIR}/scene_mesh_poisson_simplified_d{best_depth}.ply"
                    o3d.io.write_triangle_mesh(simple_mesh_path, mesh_simplified)
                    print(f"  Simplified mesh saved to {simple_mesh_path}")
                
                # Save standard name version too
                std_poisson_path = f"{OUTPUT_DIR}/scene_mesh_poisson_optimized.ply"
                o3d.io.write_triangle_mesh(std_poisson_path, best_poisson_mesh)
            else:
                print("  Error: Best mesh has no vertices after reloading.")
        else:
            print("No suitable Poisson mesh found.")
            
    except Exception as e:
        print(f"Poisson reconstruction process failed: {e}")
        import traceback
        traceback.print_exc()

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def color_mesh_from_point_cloud(mesh, pcd):
    """Transfer colors from point cloud to mesh vertices using nearest neighbors."""
    if len(mesh.vertices) == 0:
        return
        
    # Get data as numpy arrays
    vertices = np.asarray(mesh.vertices)
    points = np.asarray(pcd.points)
    point_colors = np.asarray(pcd.colors)
    
    # Find nearest points for each vertex
    from scipy.spatial import KDTree
    tree = KDTree(points)
    distances, indices = tree.query(vertices, k=min(3, len(points)))
    
    # Weight colors by distance
    weights = 1.0 / (distances + 1e-10)
    weights_sum = np.sum(weights, axis=1, keepdims=True)
    weights = weights / weights_sum
    
    # Calculate weighted average colors
    vertex_colors = np.zeros((len(vertices), 3))
    for i in range(min(3, distances.shape[1])):
        vertex_colors += weights[:, i:i+1] * point_colors[indices[:, i]]
    
    # Explicitly clamp colors to [0,1] range
    vertex_colors = np.clip(vertex_colors, 0.0, 1.0)
    
    # Assign colors to mesh
    mesh.vertex_colors = o3d.utility.Vector3dVector(vertex_colors)

def export_basic_point_cloud(scene):
    """Export point cloud as PLY file without Open3D dependency."""
    try:
        print("Falling back to basic point cloud export...")
        from plyfile import PlyData, PlyElement
        
        # Export Gaussian centers as point cloud
        means = scene.gaussians["means"].detach().cpu().numpy()
        colors = 1 - scene.gaussians["sh0"][:, 0].detach().cpu().numpy()
        
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
        point_cloud_path = f"{OUTPUT_DIR}/scene_point_cloud.ply"
        PlyData([el]).write(point_cloud_path)
        print(f"Exported basic point cloud to {point_cloud_path}")
    except Exception as e:
        print(f"Basic point cloud export failed: {e}")

def clean_mesh(mesh):
    """Apply cleaning operations to make mesh smoother and more manifold."""
    # Remove degenerate triangles
    mesh.remove_degenerate_triangles()
    
    # Remove duplicated vertices
    mesh.remove_duplicated_vertices()
    
    # Remove duplicated triangles
    mesh.remove_duplicated_triangles()
    
    # Remove non-manifold edges (critical for smooth meshes)
    mesh.remove_non_manifold_edges()
    
    return mesh

def apply_advanced_smoothing(mesh, iterations=5, lambda_value=0.5):
    """Apply advanced smoothing to mesh."""
    # Apply Taubin smoothing
    mesh = mesh.filter_smooth_taubin(
        number_of_iterations=iterations,
        lambda_filter=lambda_value,
        mu=-0.53  # Standard value to prevent shrinking
    )
    
    # Apply simple Laplacian smoothing after to further smooth surface
    mesh = mesh.filter_smooth_simple(iterations // 2)
    
    # Recompute normals
    mesh.compute_vertex_normals()
    return mesh

# =============================================================================
# ENTRY POINT
# =============================================================================

if __name__ == "__main__":
    main()
