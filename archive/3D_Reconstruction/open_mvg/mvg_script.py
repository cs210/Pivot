import subprocess
import os
import sys

def run_command(command):
    """Run a shell command, print its output in real-time, and check for errors."""
    print(f"Running: {command}")
    
    process = subprocess.Popen(command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    
    # Stream output in real-time
    for line in process.stdout:
        sys.stdout.write(line)
        sys.stdout.flush()
    
    for line in process.stderr:
        sys.stderr.write(line)
        sys.stderr.flush()
    
    process.wait()
    
    if process.returncode == 0:
        print("✅ Command ran successfully!")
    else:
        print(f"❌ Error running command: {command}")
        exit(1)

def main():
    # Define commands
    commands = [
        "openMVG_main_SfMInit_ImageListing -i images -d /opt/openMVG_Build/install/lib/openMVG/sensor_width_camera_database.txt -o output/sfm/matches",
        "openMVG_main_ComputeFeatures -i output/sfm/matches/sfm_data.json -o output/sfm/matches/",
        "openMVG_main_PairGenerator -i output/sfm/matches/sfm_data.json -o output/sfm/matches/pairs.bin",
        "openMVG_main_ComputeMatches -i output/sfm/matches/sfm_data.json -p output/sfm/matches/pairs.bin -o output/sfm/matches/matches.putative.bin -n AUTO",
        "openMVG_main_GeometricFilter -i output/sfm/matches/sfm_data.json -m output/sfm/matches/matches.putative.bin -o output/sfm/matches/matches.f.bin",
        "openMVG_main_SfM -i output/sfm/matches/sfm_data.json -m output/sfm/matches/ -o output/sfm/ -s INCREMENTAL",
        "openMVG_main_ComputeSfM_DataColor -i output/sfm/sfm_data.bin -o output/sfm/colorized.ply",
        "openMVG_main_ComputeStructureFromKnownPoses -i output/sfm/sfm_data.bin -m output/sfm/matches/ -f output/sfm/matches/matches.f.bin -o output/sfm/robust.bin",
        "openMVG_main_openMVG2openMVS -i output/sfm/sfm_data.bin -o output/mvs/scene.mvs -d output/mvs/images"
    ]
    
    # Execute commands in sequence
    for cmd in commands:
        run_command(cmd)

if __name__ == "__main__":
    main()