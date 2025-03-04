# Extract the telemetry data from a photo
# Supports JPEG, HEIF/HEIC, TIFF, RAW, and WebP image formats

import sys
from PIL import Image
from PIL.ExifTags import TAGS

def main():
    if len(sys.argv) != 2:
        print("Usage: python script.py <path_to_image>")
        sys.exit(1)
    
    # Get the image file path from command line argument
    image_path = sys.argv[1]
    
    try:
        # Open the image and extract EXIF data
        img = Image.open(image_path)
        exif_data = img._getexif()

        # If EXIF data exists, print it
        if exif_data:
            for tag, value in exif_data.items():
                tag_name = TAGS.get(tag, tag)
                print(f"{tag_name}: {value}")
        else:
            print("No EXIF data found.")
    
    except Exception as e:
        print(f"Error processing the image: {e}")

if __name__ == "__main__":
    main()