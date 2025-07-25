# Running Open MVS
## Run the docker container
```
cd docker
./QUICK_START.sh /path/to/mvs_input_folder
```
`/path/to/mvs_input_folder` should contain `scene.mvs` and an `undistorted_images` folder.

For more in depth instructions on running the docker container, see the [README in the docker folder of OpenMVS](https://github.com/cdcseacave/openMVS/tree/develop/docker).

⚠️ **Issue:** 
* The subsequent OpenMVS commands only work when using `working_mvs_input` from the `open_mvs` folder, which was taken from the [openMVS_sample github](https://github.com/cdcseacave/openMVS_sample). 
* Using `output` from the `open_mvg` folder as input to MVS, for example, gives an ["invalid project" error](#full-example-error-when-run-on-openmvg-output) for `scene.mvs`.
* We need to further explore running it on Colmap outputs. 

## Run Densify Point Cloud
> **Note:** The output gets added to `/path/to/mvs_input_folder`.
```
DensifyPointCloud scene.mvs
```
## Run ReconstructMesh
> **Note:** The output gets added to `/path/to/mvs_input_folder`.
```
ReconstructMesh scene.mvs
```
## Run additional refinement steps
See additional instructions on usage [here](https://github.com/cdcseacave/openMVS/wiki/Usage).
## View with Meshlab
Example of scene_dense.ply for [the Sceaux Castle dataset](https://github.com/openMVG/ImageDataset_SceauxCastle):
![Point cloud for scene_dense.ply](../../img/sample_outputs/mvs_outputs/sample-mvs-dense-output.png)
Example of scene_mesh.ply for [the Sceaux Castle dataset](https://github.com/openMVG/ImageDataset_SceauxCastle):
![Mesh for scene_mesh.ply](../../img/sample_outputs/mvs_outputs/sample-mvs-mesh-output.png)
## Full example error when run on OpenMVG output
> **Note:** The error for `ReconstructMesh scene.mvs` is the same.
```
root@9c8a66a0a3f6:/working# DensifyPointCloud scene.mvs
00:04:33 [App     ] Build date: Dec 10 2019, 20:59:37
00:04:33 [App     ] CPU: Intel(R) Xeon(R) CPU E5-2690 v4 @ 2.60GHz (56 cores)
00:04:33 [App     ] RAM: 125.78GB Physical Memory 119.21GB Virtual Memory
00:04:33 [App     ] OS: Linux 5.15.0-130-generic (x86_64)
00:04:33 [App     ] SSE & AVX compatible CPU & OS detected
00:04:33 [App     ] Command line: scene.mvs
00:04:33 [App     ] error: invalid project
```