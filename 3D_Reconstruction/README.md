# 3D Reconstruction Pipelines Attempted
## OpenMVG -> OpenMVS
Status: Can run each component separately, but the integration does not work. MVS considers the scene outputted by MVG to be an "invalid project". See `open_mvs/README.md` for more details.

# Overview of the 3D Reconstruction Technologies
## OpenMVG
Input(s)
* A directory of images

Output(s)
* A sparse, colorized point cloud (.ply)
* An mvs file to input to OpenMVS
## OpenMVS
Input(s)
* A directory of undistorted images
* An MVS file

Output(s)
* A dense point cloud (.ply, .mvs, .dmap)
* A mesh (.ply, .mvs)