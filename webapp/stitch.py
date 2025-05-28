#!/usr/bin/env python3
"""
Incremental PTGui Panorama Stitcher with Multiple Attempts
Tries multiple times with different random starting images to get at least 75% of photos accepted.
"""

import os
import subprocess
import shutil
import tempfile
from pathlib import Path
from datetime import datetime
import random
import time

class IncrementalPanoramaStitcher:
    def __init__(self, source_dir):
        self.source_dir = Path(source_dir).expanduser()
        self.ptgui_path = "/Applications/PTGui.app/Contents/MacOS/PTGui"
        self.temp_dir = None
        
        # Verify PTGui exists
        if not Path(self.ptgui_path).exists():
            raise FileNotFoundError(f"PTGui not found at {self.ptgui_path}")
        
        # Verify source directory exists
        if not self.source_dir.exists():
            raise FileNotFoundError(f"Source directory not found: {self.source_dir}")
    
    def get_images_by_creation_time(self):
        """Get all JPEG images sorted by creation time."""
        images = []
        
        # Get all jpg and jpeg files
        for pattern in ["*.jpg", "*.jpeg", "*.JPG", "*.JPEG"]:
            for file in self.source_dir.glob(pattern):
                stat = file.stat()
                # Use birth time on macOS
                creation_time = stat.st_birthtime
                images.append((file, creation_time))
        
        # Sort by creation time
        images.sort(key=lambda x: x[1])
        
        return [img[0] for img in images]
    
    def create_temp_workspace(self):
        """Create a temporary directory for processing."""
        self.temp_dir = tempfile.mkdtemp(prefix="ptgui_incremental_")
        print(f"Created temporary workspace: {self.temp_dir}")
        return self.temp_dir
    
    def copy_images_to_temp(self, images):
        """Copy selected images to temporary directory."""
        temp_images = []
        for img in images:
            dest = Path(self.temp_dir) / img.name
            shutil.copy2(img, dest)
            temp_images.append(dest)
        return temp_images
    
    def try_stitch(self, images, project_name):
        """Attempt to stitch the given images."""
        if not images:
            return False, None, 0.0
        
        stitch_start_time = time.time()
        
        # Copy images to temp directory
        temp_images = self.copy_images_to_temp(images)
        
        # Build file list for PTGui
        file_list = ' '.join([str(img) for img in temp_images])
        
        # Project file path
        project_file = Path(self.temp_dir) / f"{project_name}.pts"
        
        # Create project
        create_cmd = f'{self.ptgui_path} -createproject {file_list} -output {project_file}'
        
        try:
            result = subprocess.run(create_cmd, shell=True, capture_output=True, text=True)
            if result.returncode != 0:
                stitch_time = time.time() - stitch_start_time
                return False, None, stitch_time
            
            # Attempt to stitch
            stitch_cmd = f'{self.ptgui_path} -stitchnogui {project_file}'
            
            result = subprocess.run(stitch_cmd, shell=True, capture_output=True, text=True)
            
            # Check for success indicators in output
            output = result.stdout + result.stderr
            
            # Common failure indicators
            failure_indicators = [
                "Could not find control points",
                "not stitching the panorama",
                "No control points found",
                "Unable to align images",
                "Optimization failed"
            ]
            
            for indicator in failure_indicators:
                if indicator in output:
                    stitch_time = time.time() - stitch_start_time
                    return False, None, stitch_time
            
            # Look for output file (PTGui usually creates a file with _0000.jpg suffix)
            output_pattern = project_file.stem + "*0000.jpg"
            output_files = list(Path(self.temp_dir).glob(output_pattern))
            
            stitch_time = time.time() - stitch_start_time
            
            if output_files:
                return True, output_files[0], stitch_time
            else:
                # Sometimes PTGui creates files with different naming
                jpg_files = [f for f in Path(self.temp_dir).glob("*.jpg") 
                           if f not in temp_images and f.stat().st_size > 0]
                if jpg_files:
                    # Get the largest file (likely the panorama)
                    output_file = max(jpg_files, key=lambda f: f.stat().st_size)
                    return True, output_file, stitch_time
                else:
                    return False, None, stitch_time
                    
        except subprocess.CalledProcessError as e:
            stitch_time = time.time() - stitch_start_time
            return False, None, stitch_time
        finally:
            # Clean up temporary images
            for img in temp_images:
                try:
                    img.unlink()
                except:
                    pass
    
    def run_single_attempt(self, all_images, starting_index, attempt_num):
        """Run a single attempt starting from a specific image."""
        attempt_start_time = time.time()
        
        print(f"\n{'='*60}")
        print(f"ATTEMPT {attempt_num}: Starting with image {starting_index + 1} - {all_images[starting_index].name}")
        print(f"{'='*60}")
        
        kept_images = [all_images[starting_index]]
        total_images = len(all_images)
        failures = 0
        failure_threshold = int(total_images * 0.25)  # 25% of total images
        
        # Track timing statistics
        accepted_times = []
        rejected_times = []
        
        # Process images in order, wrapping around
        # Start from starting_index and go through all images
        for offset in range(1, total_images):
            # Calculate actual index with wrap-around
            current_index = (starting_index + offset) % total_images
            current_image = all_images[current_index]
            
            # Try to stitch with current set plus new image
            test_set = kept_images + [current_image]
            
            success, _, stitch_time = self.try_stitch(test_set, f"attempt{attempt_num}_test_{offset}")
            
            if success:
                kept_images.append(current_image)
                accepted_times.append(stitch_time)
                status = "✓ ACCEPTED"
                print(f"\rImage {current_index + 1}/{total_images}: {current_image.name:<30} {status} ({stitch_time:.1f}s)")
            else:
                failures += 1
                rejected_times.append(stitch_time)
                status = "✗ REJECTED"
                print(f"\rImage {current_index + 1}/{total_images}: {current_image.name:<30} {status} ({stitch_time:.1f}s)")
                
                # Check if we should stop early
                if failures >= failure_threshold:
                    print(f"\n\nStopping early: {failures} failures (≥{failure_threshold} threshold)")
                    break
        
        attempt_time = time.time() - attempt_start_time
        
        # Calculate timing statistics
        avg_accepted = sum(accepted_times) / len(accepted_times) if accepted_times else 0
        avg_rejected = sum(rejected_times) / len(rejected_times) if rejected_times else 0
        
        print(f"\n\nAttempt {attempt_num} complete: kept {len(kept_images)}/{total_images} images ({len(kept_images)/total_images*100:.1f}%)")
        print(f"Total attempt time: {attempt_time:.1f} seconds")
        print(f"\nTiming comparison:")
        print(f"  Accepted images: {len(accepted_times)} (avg: {avg_accepted:.1f}s per image)")
        print(f"  Rejected images: {len(rejected_times)} (avg: {avg_rejected:.1f}s per image)")
        if avg_accepted > 0 and avg_rejected > 0:
            print(f"  Acceptance takes {avg_accepted/avg_rejected:.1f}x longer than rejection")
        
        return kept_images
    
    def run_multiple_attempts(self):
        """Run multiple attempts with different starting images."""
        total_start_time = time.time()
        
        print(f"Starting multi-attempt panorama stitching from: {self.source_dir}")
        
        # Get images sorted by creation time
        all_images = self.get_images_by_creation_time()
        total_images = len(all_images)
        print(f"Found {total_images} images to process")
        
        if not all_images:
            print("No images found!")
            return None
        
        # Create temporary workspace
        self.create_temp_workspace()
        
        # Target is 75% of images
        target_count = int(total_images * 0.75)
        print(f"Target: at least {target_count} images ({target_count/total_images*100:.0f}%)")
        
        best_result = []
        best_output = None
        
        # Try up to 10 times
        for attempt in range(1, 11):
            # Pick a random starting image
            starting_index = random.randint(0, total_images - 1)
            
            # Run single attempt
            kept_images = self.run_single_attempt(all_images, starting_index, attempt)
            
            # Check if this is our best result so far
            if len(kept_images) > len(best_result):
                best_result = kept_images.copy()
                print(f"  → New best result: {len(best_result)} images")
                
                # Create panorama for this attempt
                success, output_file, _ = self.try_stitch(best_result, f"best_attempt_{attempt}")
                if success and output_file:
                    best_output = output_file
            
            # Check if we've reached our target
            if len(kept_images) >= target_count:
                print(f"\n✓ Reached target! {len(kept_images)} images ≥ {target_count}")
                break
        
        # Final report
        print(f"\n{'='*60}")
        print(f"FINAL RESULTS")
        print(f"{'='*60}")
        print(f"Best result: {len(best_result)}/{total_images} images ({len(best_result)/total_images*100:.1f}%)")
        
        total_time = time.time() - total_start_time
        print(f"Total execution time: {total_time:.1f} seconds ({total_time/60:.1f} minutes)")
        
        if best_result:
            print("\nImages included in final panorama:")
            # Sort by original creation time for display
            best_result_sorted = sorted(best_result, key=lambda x: x.stat().st_birthtime)
            for img in best_result_sorted:
                print(f"  - {img.name}")
            
            if best_output:
                # Copy final panorama to source directory
                output_path = self.source_dir / f"panorama_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
                shutil.copy2(best_output, output_path)
                print(f"\nFinal panorama saved to: {output_path}")
                return output_path
            else:
                print("\nFailed to create final panorama")
                return None
        else:
            print("\nNo images could be stitched together!")
            return None
    
    def cleanup(self):
        """Clean up temporary directory."""
        if self.temp_dir and Path(self.temp_dir).exists():
            shutil.rmtree(self.temp_dir)
            print(f"\nCleaned up temporary directory: {self.temp_dir}")

def main():
    # Configuration
    SOURCE_DIR = "~/Desktop/evgr/bedroom"
    
    try:
        # Create stitcher instance
        stitcher = IncrementalPanoramaStitcher(SOURCE_DIR)
        
        # Run the multi-attempt stitching process
        result = stitcher.run_multiple_attempts()
        
        if result:
            print(f"\n✓ Success! Final panorama saved to: {result}")
        else:
            print("\n✗ Failed to create panorama")
            
    except Exception as e:
        print(f"\nError: {e}")
    finally:
        # Clean up
        if 'stitcher' in locals():
            stitcher.cleanup()

if __name__ == "__main__":
    main()