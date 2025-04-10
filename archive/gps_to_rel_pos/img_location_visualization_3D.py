# Use this program to visualize the positions of images with GPS data in 3D space.
# Usage: python3 img_location_visualization_3D.py --folder <folder_path>
# Or for individual images: python3 img_location_visualization_3D.py <image1> [<image2> ...]

import exifread
import math
import numpy as np
import sys
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
import os
import glob
import argparse

def extract_gps_info(image_path):
    with open(image_path, 'rb') as f:
        tags = exifread.process_file(f)
    
    # Extract GPS data
    gps_data = {}
    
    if 'GPS GPSLatitude' in tags and 'GPS GPSLongitude' in tags:
        lat = tags['GPS GPSLatitude'].values
        lat_ref = tags['GPS GPSLatitudeRef'].values
        lng = tags['GPS GPSLongitude'].values
        lng_ref = tags['GPS GPSLongitudeRef'].values
        
        # Convert to decimal degrees
        lat_decimal = convert_to_decimal(lat)
        if lat_ref == 'S':
            lat_decimal = -lat_decimal
            
        lng_decimal = convert_to_decimal(lng)
        if lng_ref == 'W':
            lng_decimal = -lng_decimal
        
        gps_data['latitude'] = lat_decimal
        gps_data['longitude'] = lng_decimal
        
        # Get altitude if available
        if 'GPS GPSAltitude' in tags:
            alt_values = tags['GPS GPSAltitude'].values
            altitude = float(alt_values[0].num) / float(alt_values[0].den)
            
            # Check altitude reference (above/below sea level)
            if 'GPS GPSAltitudeRef' in tags and tags['GPS GPSAltitudeRef'].values == 1:
                altitude = -altitude
                
            gps_data['altitude'] = altitude
        
        # Get direction if available
        if 'GPS GPSImgDirection' in tags:
            dir_values = tags['GPS GPSImgDirection'].values
            direction = float(dir_values[0].num) / float(dir_values[0].den)
            gps_data['direction'] = direction
    
    return gps_data

def convert_to_decimal(dms_values):
    # Convert degrees, minutes, seconds to decimal degrees
    degrees = float(dms_values[0].num) / float(dms_values[0].den)
    minutes = float(dms_values[1].num) / float(dms_values[1].den)
    seconds = float(dms_values[2].num) / float(dms_values[2].den)
    
    return degrees + (minutes / 60.0) + (seconds / 3600.0)

def calculate_directional_distances(lat1, lon1, alt1, lat2, lon2, alt2):
    # Radius of the Earth in meters + average altitude
    R = 6371000 + (alt1 + alt2) / 2
    
    # Convert latitude and longitude from degrees to radians
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    # North-South distance (change in latitude)
    dlat = lat2_rad - lat1_rad
    north_south_distance = R * dlat  # In meters
    
    # East-West distance (change in longitude), adjusted for the latitude
    dlon = lon2_rad - lon1_rad
    east_west_distance = R * dlon * math.cos((lat1_rad + lat2_rad) / 2)  # In meters
    
    # Positive is when p2 is north and east, negative is south and west
    return north_south_distance, east_west_distance

def visualize_positions(img360_data):
    # Create a 3D plot
    fig = plt.figure(figsize=(12, 10))
    ax = fig.add_subplot(111, projection='3d')
    
    # Extract coordinates and use altitude directly for Z
    x_coords = []
    y_coords = []
    z_coords = []
    labels = []
    
    # Use the first point as reference
    if img360_data:
        lat0 = img360_data[0]['gps']['latitude']
        lon0 = img360_data[0]['gps']['longitude']
        alt0 = img360_data[0]['gps'].get('altitude', 0)
        print(f"Using reference point from file {os.path.basename(img360_data[0]['path'])}: {lat0}, {lon0}, {alt0}")
        
        for data in img360_data:
            # Calculate distance in meters
            dy, dx = calculate_directional_distances(lat0, lon0, alt0, data['gps']['latitude'], data['gps']['longitude'], data['gps'].get('altitude', 0))
            dz = data['gps'].get('altitude', 0) - alt0

            print(f"Filename: {os.path.basename(data['path'])}")
            print(f"dx: {dx}, dy: {dy}, dz: {dz}")

            x_coords.append(dx)
            y_coords.append(dy)
            z_coords.append(dz)

            filename = os.path.basename(data['path'])
            filename = os.path.splitext(filename)[0]  # Remove extension
            labels.append(filename)
    
    # Calculate bounds for the floor plane
    x_min, x_max = min(x_coords) - 2, max(x_coords) + 2
    y_min, y_max = min(y_coords) - 2, max(y_coords) + 2
    z_min = min(z_coords) - 0.5  # Place floor slightly below lowest point
    
    # Create floor plane
    xx, yy = np.meshgrid(np.linspace(x_min, x_max, 10), np.linspace(y_min, y_max, 10))
    zz = np.ones_like(xx) * z_min
    
    # Plot floor with a semi-transparent grid
    ax.plot_surface(xx, yy, zz, alpha=0.3, color='gray', edgecolor='darkgray', 
                    linewidth=0.5, antialiased=True)
    
    # Plot points
    scatter = ax.scatter(x_coords, y_coords, z_coords, c='red', s=100, marker='o')
    
    # Add labels with filenames
    for i in range(len(labels)):
        ax.text(x_coords[i], y_coords[i], z_coords[i] + 0.2, labels[i], fontsize=12)
    
    # Add direction arrows if available
    for i, data in enumerate(img360_data):
        if 'direction' in data['gps']:
            direction_rad = math.radians(data['gps']['direction'])
            dx = math.sin(direction_rad)
            dy = math.cos(direction_rad)
            ax.quiver(x_coords[i], y_coords[i], z_coords[i], dx, dy, 0, 
                      length=1.5, color='blue', arrow_length_ratio=0.2)
    
    # Add vertical lines from points to floor
    for i in range(len(x_coords)):
        ax.plot([x_coords[i], x_coords[i]], [y_coords[i], y_coords[i]], 
                [z_min, z_coords[i]], 'k--', alpha=0.5)
    
    # Add annotation for altitude differences using filenames
    if len(img360_data) > 1:
        alt_text = "Altitude differences (m):\n"
        for i, label in enumerate(labels):
            alt_text += f"{label}: {z_coords[i]:.2f}\n"
        
        plt.figtext(0.02, 0.02, alt_text, fontsize=10, 
                   bbox=dict(facecolor='white', alpha=0.8))
    
    # Set labels
    ax.set_xlabel('X (meters east)')
    ax.set_ylabel('Y (meters north)')
    ax.set_zlabel('Z (meters altitude difference)')
    ax.set_title('3D Positions of Images with Floor Reference')
    
    # Set equal aspect ratio for X and Y
    max_range_xy = max(max(x_coords)-min(x_coords), max(y_coords)-min(y_coords))
    if max_range_xy < 2:  # Set minimum range to 2 meters for better visibility
        max_range_xy = 2
        
    z_range = max(z_coords)-min(z_coords)
    if z_range < 1:  # If z_range is too small, set a minimum to make it visible
        z_range = 1
    
    mid_x = (max(x_coords) + min(x_coords)) * 0.5
    mid_y = (max(y_coords) + min(y_coords)) * 0.5
    mid_z = (max(z_coords) + min(z_coords)) * 0.5
    
    ax.set_xlim(mid_x - max_range_xy/2, mid_x + max_range_xy/2)
    ax.set_ylim(mid_y - max_range_xy/2, mid_y + max_range_xy/2)
    ax.set_zlim(z_min, mid_z + z_range)
    
    # Save static PNG image
    plt.savefig('image_positions_with_floor.png', dpi=300, bbox_inches='tight')
    print("Static visualization saved as 'image_positions_with_floor.png'")
    
    # Show the plot
    plt.show()
    
    return fig, ax

def get_image_files_from_folder(folder_path):
    """Get all image files from a folder"""
    # Common image file extensions
    image_extensions = ['*.jpg', '*.jpeg', '*.png', '*.tif', '*.tiff', '*.gif', '*.bmp']
    
    # Get all image files
    image_files = set()  # Use a set to avoid duplicates
    
    # Only search the specified folder (not recursive)
    for extension in image_extensions:
        for file in glob.glob(os.path.join(folder_path, extension)):
            image_files.add(file)
            
    return list(image_files)

def main():
    # Set up argument parser
    parser = argparse.ArgumentParser(description='Visualize GPS locations of images in 3D space.')
    parser.add_argument('--folder', type=str, help='Folder containing images to process')
    parser.add_argument('images', nargs='*', help='Individual image files to process')
    
    args = parser.parse_args()
    
    image_paths = []
    
    # If a folder is specified, get all images from it
    if args.folder:
        folder_path = args.folder
        print(f"Processing images from folder: {folder_path}")
        image_paths = get_image_files_from_folder(folder_path)
        print(f"Found {len(image_paths)} image files")
    
    # Add individual images if specified
    if args.images:
        image_paths.extend(args.images)
    
    # If no images were found or specified, show usage
    if not image_paths:
        print("No images found or specified.")
        print("Usage: python img_location_visualization_3D.py --folder <folder_path>")
        print("   or: python img_location_visualization_3D.py <image1> [<image2> ...]")
        sys.exit(1)
    
    img360_data = []
    
    for i, image_path in enumerate(image_paths):
        print(f"Processing {image_path}...")
        
        # Extract GPS data
        gps_info = extract_gps_info(image_path)
        
        if gps_info:
            print(f"GPS Coordinates: {gps_info['latitude']}, {gps_info['longitude']}")
            if 'altitude' in gps_info:
                print(f"Altitude: {gps_info['altitude']} meters")
            if 'direction' in gps_info:
                print(f"Direction: {gps_info['direction']} degrees")
            

            img360_data.append({
                'id': i,
                'path': image_path,
                'gps': gps_info,
            })
            
            print("-" * 40)
        else:
            print(f"No GPS data found in {image_path}")
    
    # Visualize the image positions
    if len(img360_data) > 0:
        # Visualize with the original matplotlib visualization
        visualize_positions(img360_data)
    else:
        print("No images with GPS data found. Visualization cannot be created.")

if __name__ == "__main__":
    main()