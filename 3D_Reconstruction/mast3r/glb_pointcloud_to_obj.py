import trimesh
import argparse
import numpy as np
import open3d as o3d  # For Poisson Surface Reconstruction

def convert_pointcloud_glb_to_mesh_obj(glb_file, obj_file, method="poisson", depth=8):
    """
    Converts a point cloud stored in a GLB file to a mesh (using Poisson Surface Reconstruction)
    and saves the mesh as an OBJ file.

    Args:
        glb_file (str): Path to the input GLB file (containing the point cloud).
        obj_file (str): Path to the output OBJ file (for the generated mesh).
        method (str): Meshing method ("poisson" or "ball_pivot").  Default: "poisson".
        depth (int): Depth parameter for Poisson Surface Reconstruction.
                     Ignored if method is "ball_pivot".
    """
    try:
        # Load the GLB file as a point cloud
        scene = trimesh.load(glb_file)

        # Extract the point cloud
        if hasattr(scene, 'geometry') and len(scene.geometry) > 0:
            # Access the first geometry in the scene, assuming it's the point cloud
            # Note: This assumes your point cloud is the *first* geometry.  Adjust as needed
            geometry = list(scene.geometry.values())[0]
            points = geometry.vertices

        else: # point cloud data is not present
             print(f"No geometry in scene")
             return

        # Convert to Open3D point cloud
        pcd = o3d.geometry.PointCloud()
        pcd.points = o3d.utility.Vector3dVector(points)

        # Estimate normals
        pcd.estimate_normals(search_param=o3d.geometry.KDTreeSearchParamHybrid(radius=0.1, max_nn=30))

        # Perform Poisson surface reconstruction
        mesh, densities = o3d.geometry.TriangleMesh.create_from_point_cloud_poisson(pcd, depth=depth)

        # Convert Open3D mesh to trimesh
        vertices = np.asarray(mesh.vertices)
        faces = np.asarray(mesh.triangles)

        trimesh_mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)

        # Export the mesh to an OBJ file
        trimesh_mesh.export(obj_file)

        print(f"Successfully converted point cloud from {glb_file} to mesh {obj_file} (using Poisson reconstruction)")

    except Exception as e:
        print(f"Error converting point cloud from {glb_file} to mesh {obj_file}: {e}")
        print(e)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert a point cloud GLB file to a mesh OBJ file.")
    parser.add_argument("glb_file", type=str, help="Path to the input GLB file (point cloud).")
    parser.add_argument("obj_file", type=str, help="Path to the output OBJ file (mesh).")
    parser.add_argument("--method", type=str, default="poisson", choices=["poisson", "ball_pivot"],
                        help="Meshing method (poisson or ball_pivot). Default: poisson.")
    parser.add_argument("--depth", type=int, default=8, help="Depth parameter for Poisson reconstruction.")
    args = parser.parse_args()

    convert_pointcloud_glb_to_mesh_obj(args.glb_file, args.obj_file, args.method, args.depth)