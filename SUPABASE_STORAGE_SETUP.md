# Supabase Storage Setup Guide

This guide walks you through setting up Supabase Storage for image uploads in the Bulletproof Journal application.

## Prerequisites

- Active Supabase project
- Supabase credentials (URL, Anon Key, Service Role Key)
- Backend already configured with Supabase Authentication

## Step 1: Create Storage Bucket

1. Navigate to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click **Storage** in the left sidebar
4. Click **"New bucket"** button
5. Configure the bucket:
   - **Name**: `journal-images`
   - **Public bucket**: Toggle **ON** ✅
   - **File size limit**: `5242880` bytes (5MB)
   - **Allowed MIME types**: `image/jpeg, image/jpg, image/png, image/gif, image/webp`
6. Click **"Create bucket"**

## Step 2: Configure Storage Policies

Storage buckets require Row Level Security (RLS) policies to control access.

### Navigate to Policies

1. In the Storage section, click on your `journal-images` bucket
2. Click the **"Policies"** tab
3. You should see "No policies created yet"

### Policy 1: Allow Authenticated Users to Upload

This policy allows logged-in users to upload images.

1. Click **"New Policy"** → **"For full customization"**
2. Fill in the details:
   - **Policy name**: `Allow authenticated uploads`
   - **Allowed operation**: `INSERT` ✅
   - **Target roles**: `authenticated`
   - **Policy definition** (USING expression):
     ```sql
     bucket_id = 'journal-images'
     ```
3. Click **"Review"** then **"Save policy"**

### Policy 2: Allow Public Read Access

This policy allows anyone to view images (necessary for displaying images in the app).

1. Click **"New Policy"** → **"For full customization"**
2. Fill in the details:
   - **Policy name**: `Allow public read`
   - **Allowed operation**: `SELECT` ✅
   - **Target roles**: `anon`, `authenticated` (select both)
     - Note: In Supabase, `anon` is the public/anonymous role
   - **Policy definition** (USING expression):
     ```sql
     bucket_id = 'journal-images'
     ```
3. Click **"Review"** then **"Save policy"**

### Policy 3: Allow Users to Delete Their Own Images

This policy allows users to delete images they uploaded.

1. Click **"New Policy"** → **"For full customization"**
2. Fill in the details:
   - **Policy name**: `Allow authenticated delete`
   - **Allowed operation**: `DELETE` ✅
   - **Target roles**: `authenticated`
   - **Policy definition** (USING expression):
     ```sql
     bucket_id = 'journal-images'
     ```
3. Click **"Review"** then **"Save policy"**

> **Note**: The delete policy is permissive here. The backend code enforces that users can only delete files prefixed with their user ID.

## Step 3: Get Your Service Role Key

The Service Role Key is needed for admin operations that bypass RLS.

1. In Supabase Dashboard, go to **Settings** → **API**
2. Locate the **Service Role Key** section
3. Click **"Reveal"** to show the key
4. Copy the `service_role` key (⚠️ this is a secret key!)

## Step 4: Update Environment Variables

Add these variables to your `backend/.env` file:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Database URL (if not already set)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.your-project.supabase.co:5432/postgres
```

### Where to Find Each Value:

- **SUPABASE_URL**: Settings → API → Project URL
- **SUPABASE_ANON_KEY**: Settings → API → Project API keys → `anon` `public`
- **SUPABASE_SERVICE_ROLE_KEY**: Settings → API → Project API keys → `service_role` (⚠️ Keep secret!)
- **DATABASE_URL**: Settings → Database → Connection string → URI

## Step 5: Verify the Setup

### Test 1: Backend Health Check

Start your backend server:

```bash
cd backend
npm start
```

Check the console for:
```
✓ Connected to PostgreSQL database
✓ Server running on port 3000
```

### Test 2: Upload an Image

You can test image upload using curl:

```bash
# Replace with your actual token and image file
curl -X POST http://localhost:3000/images/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "image=@/path/to/test-image.jpg"
```

Expected response:
```json
{
  "success": true,
  "imageUrl": "https://your-project.supabase.co/storage/v1/object/public/journal-images/user-id/timestamp-random.jpg",
  "filename": "user-id/timestamp-random.jpg",
  "originalName": "test-image.jpg",
  "size": 123456
}
```

### Test 3: View Image in Supabase

1. Go to Storage → journal-images in Supabase Dashboard
2. You should see a folder with your user ID
3. Inside, you'll see the uploaded image
4. Click on it to preview

## Step 6: Test from Mobile App

1. Ensure your mobile app is pointing to the correct backend URL in `mobile-app/src/config/index.js`
2. Launch the app and log in
3. Create or edit a journal entry
4. Add an image from your device
5. Save the entry
6. The image should upload to Supabase Storage
7. View the entry to confirm the image displays correctly

## Architecture Overview

### How It Works

1. **Mobile App** → Selects image from device
2. **Mobile App** → Sends image to backend via FormData
3. **Backend** → Receives image buffer (multer middleware)
4. **Backend** → Uploads to Supabase Storage (storage service)
5. **Supabase** → Stores image and returns public URL
6. **Backend** → Returns URL to mobile app
7. **Mobile App** → Saves URL in journal entry
8. **Mobile App** → Displays image using the URL

### File Organization

Images are organized by user ID:
```
journal-images/
├── user-id-1/
│   ├── 1707523200000-123456789.jpg
│   └── 1707523300000-987654321.jpg
├── user-id-2/
│   ├── 1707523400000-111222333.jpg
│   └── 1707523500000-444555666.jpg
```

This structure:
- ✅ Organizes images by user
- ✅ Prevents filename conflicts
- ✅ Makes it easy to identify image ownership
- ✅ Simplifies deletion verification

## Troubleshooting

### Issue: "No authorization header" error

**Solution**: Ensure the mobile app is sending the JWT token:
```javascript
headers: {
  'Authorization': `Bearer ${token}`
}
```

### Issue: "Only image files are allowed" error

**Solution**: Check that the file MIME type starts with `image/`. Adjust the FormData:
```javascript
formData.append('image', {
  uri: imageUri,
  type: 'image/jpeg', // Correct MIME type
  name: fileName
});
```

### Issue: Images not displaying in app

**Solution**: 
1. Check that the bucket is **public**
2. Verify the "Allow public read" policy exists
3. Ensure the mobile app can access the Supabase URL
4. Check for CORS issues (not usually a problem with public buckets)

### Issue: "Storage bucket not found" error

**Solution**: 
1. Verify bucket name is exactly `journal-images`
2. Check that `BUCKET_NAME` constant in `backend/src/services/storage.js` matches
3. Ensure bucket exists in Supabase Dashboard

### Issue: Users can't delete images

**Solution**:
1. Check that DELETE policy exists
2. Verify user is authenticated
3. Ensure the filename starts with the user's ID (backend enforces this)

## Security Considerations

### ✅ What's Protected:

- Users must be authenticated to upload images
- Users can only delete their own images (enforced by backend)
- File size is limited to 5MB
- Only image MIME types are accepted

### ⚠️ Important Notes:

- **Service Role Key**: Never expose this in client-side code! Only use in backend.
- **Public Bucket**: Images are publicly accessible if someone has the URL. Don't store sensitive images.
- **User Privacy**: Image URLs contain user IDs. Consider using UUIDs if this is a concern.

## Migration from Local Storage

If you have existing images in the local `backend/uploads` folder:

1. Images are now stored in Supabase Storage instead
2. Old local images won't be accessible via the new system
3. Consider running a migration script if you need to preserve old images
4. Update any existing database records with local paths to use Supabase URLs

## API Endpoints

### Upload Image
- **Endpoint**: `POST /images/upload`
- **Auth**: Required (JWT)
- **Body**: FormData with `image` field
- **Response**: `{ success, imageUrl, filename, originalName, size }`

### Delete Image
- **Endpoint**: `DELETE /images/:filename`
- **Auth**: Required (JWT)
- **Params**: `filename` - Full path (e.g., `user-id/timestamp-random.jpg`)
- **Response**: `{ success, message }`

### List User Images
- **Endpoint**: `GET /images/list`
- **Auth**: Required (JWT)
- **Response**: `{ success, files: [...] }`

## Next Steps

- ✅ Storage bucket created and configured
- ✅ Backend updated to use Supabase Storage
- ✅ Mobile app updated to upload/delete images
- 🔄 Monitor storage usage in Supabase Dashboard
- 🔄 Consider implementing image optimization/compression
- 🔄 Set up automated backups if needed
- 🔄 Implement image caching in mobile app for better performance

## Additional Resources

- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [Storage Policies Guide](https://supabase.com/docs/guides/storage/security/access-control)
- [Storage API Reference](https://supabase.com/docs/reference/javascript/storage)

---

**Setup Complete!** 🎉 Your application now uses Supabase Storage for all image uploads.
