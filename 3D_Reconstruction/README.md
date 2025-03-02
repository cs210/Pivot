# 3D Reconstruction Technologies
## OpenMVG
### Input(s)
* A directory of images
### Output(s)
* A sparse, colorized point cloud (.ply)
* An mvs file to input to OpenMVS
## OpenMVS
### Input(s)
* A directory of undistorted images
* An MVS file
### Output(s)
* A dense point cloud (.ply)
* A mesh (.ply)

# Running Open MVG
For full instructions, see [the OpenMVG github](https://github.com/openMVG/openMVG/wiki/OpenMVG-on-your-image-dataset).
## Run the docker container
```
cd open-mvg
docker build -t open-mvg-image .
docker run -it --name my-openmvg-container open-mvg-image /bin/bash
```
## Run Open MVG from in the docker container 
```
cd /opt/openMVG_Build/software/SfM/
mkdir output
python3 SfM_SequentialPipeline.py images output
```
## Prepare output for OpenMVS
```
mv images output/reconstruction_reconstruction_sequential
cd output/reconstruction_reconstruction_sequential
openMVG_main_openMVG2openMVS -i sfm_data.bin -o scene.mvs -d scene_undistorted_images/
```
## Copy output back to your machine
From `open-mvg` on your machine, run
```
docker cp my-openmvg-container:/opt/openMVG_Build/software/SfM/output .
```
## View with Meshlab
Example of colorized.ply for the Sceaux Castle dataset:
![Point cloud for colorized.ply](img/sample-mvg-output.png)

# Running Open MVS
For instructions on usage, see the [OpenMVS usage wiki](https://github.com/cdcseacave/openMVS/wiki/Usage).
## Run the docker container
For instructions on running the docker container, see the [README in the docker folder of OpenMVS](https://github.com/cdcseacave/openMVS/tree/develop/docker).
```
cd open-mvs-2/docker
./QUICK_START.sh /path/to/Phoenix-Recon/open-mvg/output 
```
## Run Densify Point Cloud
> **Note:** Does not currently work. Getting an "invalid project" error for scene.mvs.
```
DensifyPointCloud scene.mvs
```
## Run ReconstructMesh
> **Note:** Does not currently work. Getting an "invalid project" error for scene.mvs.
```
ReconstructMesh scene.mvs
```
## Full example error
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
