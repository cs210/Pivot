import exifread
import math
import numpy as np
import sys
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
import os

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

def convert_to_cartesian(lat, lon, alt=0):
    # WGS84 ellipsoid parameters
    a = 6378137.0  # semi-major axis (equatorial radius) in meters
    e2 = 0.00669438  # eccentricity squared
    
    # Convert to radians
    lat_rad = math.radians(lat)
    lon_rad = math.radians(lon)
    
    # Calculate N (radius of curvature in the prime vertical)
    N = a / math.sqrt(1 - e2 * math.sin(lat_rad) * math.sin(lat_rad))
    
    # Calculate ECEF (Earth-Centered, Earth-Fixed) coordinates
    x = (N + alt) * math.cos(lat_rad) * math.cos(lon_rad)
    y = (N + alt) * math.cos(lat_rad) * math.sin(lon_rad)
    z = (N * (1 - e2) + alt) * math.sin(lat_rad)
    
    return (x, y, z)

def calculate_distance_meters(lat1, lon1, lat2, lon2):
    """Calculate distance between two points in meters"""
    # Earth radius in meters
    R = 6371000
    
    # Convert to radians
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    # Haversine formula
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    
    a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

def visualize_positions(panorama_data):
    # Create a 3D plot
    fig = plt.figure(figsize=(12, 10))
    ax = fig.add_subplot(111, projection='3d')
    
    # Extract coordinates and use altitude directly for Z
    x_coords = []
    y_coords = []
    z_coords = []
    
    # Use the first point as reference
    if panorama_data:
        lat0 = panorama_data[0]['gps']['latitude']
        lon0 = panorama_data[0]['gps']['longitude']
        alt0 = panorama_data[0]['gps'].get('altitude', 0)
        
        for data in panorama_data:
            # Calculate distance in meters
            dx, dy = calculate_distance_meters(
                lat0, lon0, 
                data['gps']['latitude'], lon0
            ), calculate_distance_meters(
                lat0, lon0, 
                lat0, data['gps']['longitude']
            )
            
            # Apply sign based on direction
            if data['gps']['latitude'] < lat0:
                dx = -dx
            if data['gps']['longitude'] < lon0:
                dy = -dy
                
            # Use actual altitude difference for z
            dz = data['gps'].get('altitude', 0) - alt0
            
            x_coords.append(dx)
            y_coords.append(dy)
            z_coords.append(dz)
    
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
    
    # Add labels with filenames instead of "Pan X"
    for i, data in enumerate(panorama_data):
        # Extract filename without extension
        filename = os.path.basename(data['path'])
        filename = os.path.splitext(filename)[0]  # Remove extension
        ax.text(x_coords[i], y_coords[i], z_coords[i] + 0.2, filename, fontsize=12)
    
    # Add direction arrows if available
    for i, data in enumerate(panorama_data):
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
    if len(panorama_data) > 1:
        alt_text = "Altitude differences (m):\n"
        for i, data in enumerate(panorama_data):
            filename = os.path.basename(data['path'])
            filename = os.path.splitext(filename)[0]  # Remove extension
            alt_text += f"{filename}: {z_coords[i]:.2f}\n"
        
        plt.figtext(0.02, 0.02, alt_text, fontsize=10, 
                   bbox=dict(facecolor='white', alpha=0.8))
    
    # Set labels
    ax.set_xlabel('X (meters east)')
    ax.set_ylabel('Y (meters north)')
    ax.set_zlabel('Z (meters altitude difference)')
    ax.set_title('3D Positions of Panoramas with Floor Reference')
    
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
    
    # Save and show
    plt.savefig('panorama_positions_with_floor.png', dpi=300, bbox_inches='tight')
    print("Visualization saved as 'panorama_positions_with_floor.png'")
    plt.show()

def main():
    if len(sys.argv) < 2:
        print("Usage: python extract_gps.py <image1> [<image2> ...]")
        sys.exit(1)
    
    panorama_data = []
    
    for i, image_path in enumerate(sys.argv[1:]):
        print(f"Processing {image_path}...")
        
        # Extract GPS data
        gps_info = extract_gps_info(image_path)
        
        if gps_info:
            print(f"GPS Coordinates: {gps_info['latitude']}, {gps_info['longitude']}")
            if 'altitude' in gps_info:
                print(f"Altitude: {gps_info['altitude']} meters")
            if 'direction' in gps_info:
                print(f"Direction: {gps_info['direction']} degrees")
            
            # Convert to cartesian coordinates
            cartesian = convert_to_cartesian(
                gps_info['latitude'], 
                gps_info['longitude'], 
                gps_info.get('altitude', 0)
            )
            
            panorama_data.append({
                'id': i,
                'path': image_path,
                'gps': gps_info,
                'cartesian': cartesian
            })
            
            print(f"Cartesian coordinates: {cartesian}")
            print("-" * 40)
        else:
            print(f"No GPS data found in {image_path}")
    
    # Visualize the panorama positions
    if len(panorama_data) > 0:
        visualize_positions(panorama_data)

if __name__ == "__main__":
    main()