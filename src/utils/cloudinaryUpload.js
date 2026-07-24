/**
 * Utility functions for uploading files to Cloudinary
 * Used by profile form and other image upload fields
 */

/**
 * Upload a file to Cloudinary using the signed upload endpoint
 * @param {File} file - The file to upload
 * @param {string} folder - Cloudinary folder name (e.g., 'emp_profiles/documents')
 * @param {Object} options - Additional options
 * @returns {Promise<{url: string, public_id: string}>}
 */
export async function uploadToCloudinary(file, folder, options = {}) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    
    // Add any additional options
    if (options.public_id) {
      formData.append('public_id', options.public_id);
    }
    if (options.tags) {
      formData.append('tags', options.tags);
    }

    const response = await fetch('/api/cloudinary/upload', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Upload failed');
    }

    return {
      url: data.secure_url || data.url,
      public_id: data.public_id,
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
}

/**
 * Upload multiple files to Cloudinary
 * @param {File[]} files - Array of files to upload
 * @param {string} folder - Cloudinary folder name
 * @returns {Promise<Array>}
 */
export async function uploadMultipleToCloudinary(files, folder) {
  try {
    const uploadPromises = files.map(file =>
      uploadToCloudinary(file, folder)
    );
    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error('Batch upload error:', error);
    throw error;
  }
}

/**
 * Delete a file from Cloudinary
 * @param {string} public_id - The public ID of the file
 * @returns {Promise<boolean>}
 */
export async function deleteFromCloudinary(public_id) {
  try {
    const response = await fetch('/api/cloudinary/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_id }),
    });

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    return false;
  }
}

/**
 * Get a Cloudinary URL with transformations
 * @param {string} url - Original Cloudinary URL
 * @param {Object} transformations - Cloudinary transformations
 * @returns {string}
 */
export function getCloudinaryUrl(url, transformations = {}) {
  if (!url || !url.includes('cloudinary')) return url;
  
  // Example: add width/height/quality
  if (Object.keys(transformations).length === 0) return url;
  
  // Build transformation string
  const params = [];
  if (transformations.width) params.push(`w_${transformations.width}`);
  if (transformations.height) params.push(`h_${transformations.height}`);
  if (transformations.quality) params.push(`q_${transformations.quality}`);
  if (transformations.crop) params.push(`c_${transformations.crop}`);
  if (transformations.gravity) params.push(`g_${transformations.gravity}`);
  
  if (params.length === 0) return url;
  
  const transformation = params.join(',');
  // Insert transformation before filename
  return url.replace('/upload/', `/upload/${transformation}/`);
}
