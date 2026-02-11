const express = require('express');
const upload = require('../middleware/upload');
const storageService = require('../services/storage');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Test endpoint to debug FormData issues
router.post('/test', (req, res) => {
  console.log('=== IMAGE TEST ENDPOINT CALLED ===');
  console.log('Method:', req.method);
  console.log('Headers:', req.headers);
  console.log('Content-Type:', req.headers['content-type']);
  console.log('Body:', req.body);
  console.log('Files:', req.files);
  console.log('Raw body available:', !!req.rawBody);
  console.log('=====================================');
  
  res.json({ 
    success: true, 
    message: 'Test endpoint reached',
    headers: req.headers,
    contentType: req.headers['content-type']
  });
});

// Upload image endpoint - now uses Supabase Storage
router.post('/upload', verifyToken, (req, res) => {
  console.log('Image upload request received');
  console.log('Content-Type:', req.headers['content-type']);
  console.log('User ID:', req.user?.id);
  
  upload.single('image')(req, res, async (err) => {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({ error: err.message });
    }
    
    try {
      console.log('File uploaded:', req.file ? 'Yes' : 'No');
      if (req.file) {
        console.log('File details:', {
          originalname: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype
        });
      }
      
      if (!req.file) {
        return res.status(400).json({ error: 'No image file uploaded' });
      }

      // Get user ID from authenticated token
      const userId = req.user.id;

      // Upload to Supabase Storage
      const result = await storageService.uploadImage(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        userId
      );

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      console.log('Image uploaded to Supabase:', result.filename);
      
      res.json({
        success: true,
        imageUrl: result.imageUrl,
        filename: result.filename,
        originalName: req.file.originalname,
        size: result.size
      });
    } catch (error) {
      console.error('Image upload error:', error);
      res.status(500).json({ error: 'Failed to upload image' });
    }
  });
});

// Delete image endpoint - now uses Supabase Storage
// Use regex to capture the full path including slashes
router.delete(/^\/(.*)/, verifyToken, async (req, res) => {
  try {
    const filename = req.params[0];
    const userId = req.user.id;
    
    // Verify the file belongs to the user (filename should start with userId)
    if (!filename.startsWith(userId)) {
      return res.status(403).json({ error: 'Unauthorized: Cannot delete another user\'s image' });
    }
    
    console.log('Deleting image:', filename);
    
    const result = await storageService.deleteImage(filename);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({ success: true, message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Image deletion error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// List user's images - useful for debugging/management
router.get('/list', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await storageService.listUserImages(userId);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({
      success: true,
      files: result.files
    });
  } catch (error) {
    console.error('Error listing images:', error);
    res.status(500).json({ error: 'Failed to list images' });
  }
});

module.exports = router;