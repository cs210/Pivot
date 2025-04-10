# **COLMAP Installation and Build Notes**

## **General Notes**
- All COLMAP builds were done by cloning and building from [`https://github.com/colmap/colmap`](https://github.com/colmap/colmap).
- Tried installing and building `VCPKG`, but COLMAP build cannot be done manually (for package version tweaking).
- Avoid **Anaconda** and install the required version of necessary packages separately.

---

## **Platform-Specific Notes**

### **1. Acer Predator (Windows & WSL)**
- **Environment:**  
  - Windows Shell or **WSL (Ubuntu 22.04 LTS)**  
  - GUI requires **XServer** for forwarding for WSL; otherwise, it results in a non-informative segmentation fault (SegFault).  
- **Pros:**  
  - Easier build with **Anaconda** on WSL.  
- **Cons:**  
  - Sudden `"Killed"` messages appear in the middle of the process.
  - Can't give enough memory to WSL.
  - Impossible to build using `vcpkg`. Too many build issues.
  - Pre-compiled binaries do not have ceres compiled with CUDA support.

---

### **2. MacOS (M2 Max ARM)**
- **Pros:**  
  - Very straightforward installation and setup.  
- **Cons:**  
  - **No GPU support**, limiting performance.  
- **Decision:**  
  - Not sticking to **Mac**, since GPU is needed for COLMAP—especially for large-scale image reconstruction.  

---

### **3. AWS Ubuntu 22.04 LTS**
- **GPU Support:**  
  - Required for COLMAP, but a **quota increase** was necessary.  
- **Instances Used (via school AWS account):**  
  - `c5g.xlarge`  
  - `g5g.xlarge`  
  - `g5g.2xlarge` (double the memory)  
- **Setup Notes:**  
  - Needs `-X` flag with **SSH** and **XServer** for GUI forwarding.  
- **Performance:**  
  - Runs both **dense** and **sparse** reconstruction, but **slowly**.  



# **Main Reconstruction Speed Issue**

"Failed to use GPU because CudSS was not compiled with GPU support, reverting back to CPU dense and sparse reconstruction."

This is a common issue "https://github.com/colmap/colmap/issues/3100". This is causing dense reconstruction to be extremely slow regardless of the GPU the machine has, since everything is being run on CPU.


# COLMAP Usage Guide (Based on Tutorial)

This guide provides step-by-step instructions for using COLMAP for 3D reconstruction, including both GUI and command-line workflows.

---

## Prerequisites
- Ensure COLMAP is installed and added to your system's PATH.

---

## GUI Workflow

1. Launch the COLMAP GUI:
   ```bash
   colmap gui
   ```

2. Navigate to **Reconstruction → Automatic Reconstruction**.

3. Configure the following settings:
   - **Workspace**: The folder where reconstructions will be saved.
   - **num_threads**: Set this to the number of threads optimal for your machine.
   - **GPU Index**: Set to `0` if using a GPU.

  <div align="center">
  <img width="250" alt="Image" src="https://github.com/user-attachments/assets/8c2ae789-a97e-4f98-9c85-ed4869c890ab" />
</div>

---

## Command-Line Workflow

1. Navigate to your workspace directory:
   ```bash
   cd workspace
   ```

2. Run the automatic reconstruction command:
   ```bash
   colmap automatic_reconstructor \
       --workspace_path . \
       --image_path ./images \
       --gpu_index 0 \
       --use_gpu 0 \
       --num_threads 8 \
       --SiftExtraction.max_image_size $SIZE
   ```

   - Adjust `$SIZE` to control the maximum image size for optimization or tradeoffs default is 2000 I guess.
   - This process generates folders for sparse and dense point clouds.

---

## Meshing

After reconstruction, generate a mesh using Poisson meshing:

```bash
colmap poisson_mesher \
    --input_path stereo/fused.ply \
    --output_path stereo/meshed-poisson.ply \
    --PoissonMeshing.depth 14 \
    --PoissonMeshing.trim 5 \
    --PoissonMeshing.point_weight 1 \
    --PoissonMeshing.color 32 \
    --PoissonMeshing.num_threads 8
```

### Notes:
- Increase `--PoissonMeshing.depth` for smoother and more detailed reconstructions (note: computation time scales exponentially).
- If you encounter loop failures, set `--PoissonMeshing.num_threads` to `1`.
- Adjust other parameters as needed for your specific use case.

---

Different runs of COLMAP on different sets of images:

https://drive.google.com/drive/folders/1uQ89mHqJ988QwqOOKa2Tm_N0iVCFD1WY?usp=drive_link


<img width="350" alt="Image" src="https://github.com/user-attachments/assets/8a3986cc-6ef0-4ca3-9877-5218fb6214cb" />

<img width="350" alt="Image" src="https://github.com/user-attachments/assets/cbb8cf50-7cd0-421f-96d1-26b370990ca5" />

Image to the left is with poisson remeshing, right is only the dense point cloud reconstruction using COLMAP