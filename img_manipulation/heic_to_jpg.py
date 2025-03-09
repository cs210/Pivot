# Basic usage (will create [input-directory]-jpeg next to input directory)
# python3 heic_to_jpeg_converter.py /path/to/photos

# Specify custom output directory
# python3 heic_to_jpeg_converter.py /path/to/photos -o /path/to/output

# Set custom JPEG quality
# python3 heic_to_jpeg_converter.py /path/to/photos -q 95

#!/usr/bin/env python3
import os
import subprocess
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import argparse

def convert_heic_to_jpeg(input_file, output_file, quality=90):
    """
    Convert a HEIC file to JPEG using sips (macOS) or pillow-heif if available.
    Falls back to pyheif + PIL if other methods are not available.
    """
    input_file = str(input_file)
    output_file = str(output_file)
    
    # Try using sips (macOS built-in)
    if os.path.exists("/usr/bin/sips"):
        try:
            subprocess.run([
                "sips", 
                "-s", "format", "jpeg", 
                "-s", "formatOptions", str(quality), 
                input_file, 
                "--out", output_file
            ], check=True, capture_output=True)
            print(f"Converted using sips: {input_file} -> {output_file}")
            return True
        except subprocess.CalledProcessError:
            print(f"sips conversion failed for {input_file}, trying alternative method...")
    
    # Try using pillow-heif
    try:
        import pillow_heif
        from PIL import Image
        
        pillow_heif.register_heif_opener()
        img = Image.open(input_file)
        img.save(output_file, "JPEG", quality=quality)
        print(f"Converted using pillow-heif: {input_file} -> {output_file}")
        return True
    except ImportError:
        print("pillow-heif not installed, trying pyheif...")
    
    # Fall back to pyheif + PIL
    try:
        import pyheif
        from PIL import Image
        
        heif_file = pyheif.read(input_file)
        img = Image.frombytes(
            heif_file.mode, 
            heif_file.size, 
            heif_file.data,
            "raw",
            heif_file.mode,
            heif_file.stride,
        )
        img.save(output_file, "JPEG", quality=quality)
        print(f"Converted using pyheif: {input_file} -> {output_file}")
        return True
    except ImportError:
        print("Error: Neither pillow-heif nor pyheif is installed.")
        print("Please install one of these packages:")
        print("pip install pillow-heif")
        print("or")
        print("pip install pyheif Pillow")
        return False

def process_directory(base_input_dir, base_output_dir, quality=90):
    """
    Recursively process all HEIC files in the base directory and all subdirectories.
    """
    base_input_path = Path(base_input_dir).resolve()
    base_output_path = Path(base_output_dir).resolve()
    
    # Find all HEIC files in the base directory and subdirectories
    heic_files = list(base_input_path.glob("**/*.HEIC"))
    heic_files.extend(base_input_path.glob("**/*.heic"))
    
    if not heic_files:
        print(f"No HEIC files found in {base_input_dir} or its subdirectories")
        return
    
    print(f"Found {len(heic_files)} HEIC files in {base_input_dir} and its subdirectories")
    
    # Process files in parallel
    with ThreadPoolExecutor(max_workers=os.cpu_count()) as executor:
        for heic_file in heic_files:
            # Determine the relative path from the base input directory
            rel_path = heic_file.relative_to(base_input_path)
            
            # Create the corresponding output directory structure
            output_dir = base_output_path / rel_path.parent
            output_dir.mkdir(parents=True, exist_ok=True)
            
            # Create the output file path
            jpeg_file = output_dir / (heic_file.stem + ".jpg")
            
            # Submit the conversion task
            executor.submit(convert_heic_to_jpeg, heic_file, jpeg_file, quality)

def main():
    parser = argparse.ArgumentParser(description="Convert HEIC images to JPEG format")
    parser.add_argument("input_dir", help="Input directory containing HEIC images")
    parser.add_argument("-o", "--output_dir", help="Output directory for JPEG images")
    parser.add_argument("-q", "--quality", type=int, default=90, help="JPEG quality (1-100)")
    args = parser.parse_args()
    
    input_dir = args.input_dir
    
    # If output directory is not specified, create one next to input directory
    if args.output_dir:
        output_dir = args.output_dir
    else:
        input_path = Path(input_dir)
        output_dir = str(input_path.parent / f"{input_path.name}-jpeg")
    
    # Check if input directory exists
    if not os.path.exists(input_dir):
        print(f"Error: Input directory '{input_dir}' not found.")
        return
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"Processing directory: {input_dir}")
    print(f"Output directory: {output_dir}")
    process_directory(input_dir, output_dir, args.quality)
    
    print("Conversion complete!")

if __name__ == "__main__":
    main()