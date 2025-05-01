/**
 * Utility function to generate a thumbnail from an image file
 */

/**
 * Generates a thumbnail File object from an original image file
 * 
 * @param {File} originalFile - The original image file
 * @param {Object} options - Configuration options for thumbnail generation
 * @param {number} options.maxDimension - Maximum width or height (whichever is larger) in pixels
 * @param {number} options.quality - JPEG quality from 0 to 1
 * @param {string} options.format - Output format (mime type)
 * @param {string} options.filename - Optional custom filename for the thumbnail
 * @returns {Promise<File>} - A File object containing the thumbnail
 */
export const generateThumbnail = async (
    originalFile: File,
    options = {
      maxDimension: 400,
      quality: 0.8,
      format: 'image/jpeg',
      filename: ''
    }
  ): Promise<File> => {
    return new Promise((resolve, reject) => {
      // Create image element to load the file
      const img = new Image();
      
      // Create canvas for resizing
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      // Handle image loading
      img.onload = () => {
        // Calculate new dimensions (preserving aspect ratio)
        const { maxDimension } = options;
        let width = img.width;
        let height = img.height;
        
        if (width > height && width > maxDimension) {
          height *= maxDimension / width;
          width = maxDimension;
        } else if (height > maxDimension) {
          width *= maxDimension / height;
          height = maxDimension;
        }
        
        // Set canvas dimensions
        canvas.width = width;
        canvas.height = height;
        
        // Draw the image at the new size
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to blob with specified format and quality
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Failed to create thumbnail blob'));
            return;
          }
          
          // Clean up object URL
          URL.revokeObjectURL(img.src);
          
          // Determine thumbnail filename
          const thumbnailFilename = options.filename || 
            `thumbnail_${originalFile.name.replace(/\.[^/.]+$/, '')}.jpg`;
          
          // Create File from Blob
          const thumbnailFile = new File(
            [blob],
            thumbnailFilename,
            { type: options.format }
          );
          
          resolve(thumbnailFile);
        }, options.format, options.quality);
      };
      
      // Handle image loading errors
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      // Load image from File object
      img.src = URL.createObjectURL(originalFile);
    });
  };