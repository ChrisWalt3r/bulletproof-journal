const { supabase, supabaseAdmin } = require('../config/supabase');
const path = require('path');

const BUCKET_NAME = 'journal-images';

/**
 * Upload an image to Supabase Storage using Service Role (Admin)
 * Use this for server-side uploads (e.g. MT5 Webhook) that don't have a user session.
 * @param {Buffer} fileBuffer - The image file buffer
 * @param {string} filename - Full filename path (e.g. 'mt5-1/image.png')
 * @param {string} mimetype - File MIME type
 * @returns {Promise<{success: boolean, imageUrl?: string, error?: string}>}
 */
const uploadImageAdmin = async (fileBuffer, filename, mimetype) => {
  try {
    const client = supabaseAdmin || supabase;
    
    // Validate file type
    // ... (could add validation here if needed)

    // Upload to Supabase Storage
    const { data, error } = await client.storage
      .from(BUCKET_NAME)
      .upload(filename, fileBuffer, {
        contentType: mimetype,
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Supabase admin upload error:', error);
      return { success: false, error: error.message };
    }

    // Get public URL
    const { data: { publicUrl } } = client.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filename);

    return {
      success: true,
      imageUrl: publicUrl,
      filename: filename // Return the full path
    };
  } catch (error) {
    console.error('Error uploading image (admin):', error);
    return { success: false, error: 'Failed to upload image' };
  }
};

/**
 * Upload an image to Supabase Storage
 * @param {Buffer} fileBuffer - The image file buffer
 * @param {string} originalName - Original filename
 * @param {string} mimetype - File MIME type
 * @param {string} userId - User ID for organizing files
 * @returns {Promise<{success: boolean, imageUrl?: string, filename?: string, error?: string}>}
 */
const uploadImage = async (fileBuffer, originalName, mimetype, userId) => {
  try {
    // Validate file type
    if (!mimetype.startsWith('image/')) {
      return { success: false, error: 'Only image files are allowed' };
    }

    // Validate file size (5MB limit)
    if (fileBuffer.length > 5 * 1024 * 1024) {
      return { success: false, error: 'File size exceeds 5MB limit' };
    }

    // Generate unique filename with user ID prefix for organization
    const timestamp = Date.now();
    const randomString = Math.round(Math.random() * 1E9);
    const extension = path.extname(originalName);
    const filename = `${userId}/${timestamp}-${randomString}${extension}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filename, fileBuffer, {
        contentType: mimetype,
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return { success: false, error: error.message };
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filename);

    return {
      success: true,
      imageUrl: publicUrl,
      filename: filename,
      size: fileBuffer.length
    };
  } catch (error) {
    console.error('Error uploading image:', error);
    return { success: false, error: 'Failed to upload image' };
  }
};

/**
 * Delete an image from Supabase Storage
 * @param {string} filename - The filename/path to delete
 * @returns {Promise<{success: boolean, error?: string}>}
 */
const deleteImage = async (filename) => {
  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filename]);

    if (error) {
      console.error('Supabase delete error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting image:', error);
    return { success: false, error: 'Failed to delete image' };
  }
};

/**
 * Delete multiple images from Supabase Storage
 * @param {string[]} filenames - Array of filenames/paths to delete
 * @returns {Promise<{success: boolean, error?: string}>}
 */
const deleteImages = async (filenames) => {
  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(filenames);

    if (error) {
      console.error('Supabase bulk delete error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting images:', error);
    return { success: false, error: 'Failed to delete images' };
  }
};

/**
 * Get public URL for an image
 * @param {string} filename - The filename/path
 * @returns {string} Public URL
 */
const getPublicUrl = (filename) => {
  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filename);
  
  return publicUrl;
};

/**
 * List all images for a user
 * @param {string} userId - User ID
 * @returns {Promise<{success: boolean, files?: Array, error?: string}>}
 */
const listUserImages = async (userId) => {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(userId, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (error) {
      console.error('Supabase list error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, files: data };
  } catch (error) {
    console.error('Error listing images:', error);
    return { success: false, error: 'Failed to list images' };
  }
};

module.exports = {
  uploadImage,
  deleteImage,
  deleteImages,
  getPublicUrl,
  listUserImages,
  uploadImageAdmin,
  BUCKET_NAME
};
