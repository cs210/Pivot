import exifread
import cv2
import numpy as np
import sys

# Read EXIF data
def extract_metadata(image_path):
    with open(image_path, 'rb') as f:
        tags = exifread.process_file(f)
    return tags

# Feature extraction for SfM
def extract_features(image_path):
    image = cv2.imread(image_path)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    sift = cv2.SIFT_create()
    keypoints, descriptors = sift.detectAndCompute(gray, None)
    return keypoints, descriptors

def main():
    if len(sys.argv) != 2:
        print("Usage: python extract_exif_data.py <path_to_image>")
        sys.exit(1)
    
    # Get the image file path from command line argument
    image_path = sys.argv[1]
    
    try:
        # Extract metadata
        metadata = extract_metadata(image_path)
        if not metadata:
            print("No EXIF data found.")
        else:
            print("Metadata:")
            for tag, value in metadata.items():
                print(f"{tag}: {value}")
        
        # Extract features
        keypoints, descriptors = extract_features(image_path)
        if not keypoints:
            print("No features found.")
        else:
            print(f"Number of keypoints: {len(keypoints)}")
            print(f"Shape of descriptors: {descriptors.shape}")
    
    except Exception as e:
        print(f"Error processing the image: {e}")

if __name__ == "__main__":
    main()
