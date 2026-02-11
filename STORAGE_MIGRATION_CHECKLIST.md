# Supabase Storage Migration Checklist

## ✅ Code Changes Completed

The following files have been created/updated to integrate Supabase Storage:

### Created Files:
- ✅ `backend/src/config/supabase.js` - Centralized Supabase client
- ✅ `backend/src/services/storage.js` - Storage service for image operations
- ✅ `SUPABASE_STORAGE_SETUP.md` - Comprehensive setup documentation

### Updated Files:
- ✅ `backend/src/middleware/upload.js` - Changed from disk storage to memory storage
- ✅ `backend/src/middleware/auth.js` - Now uses centralized Supabase client
- ✅ `backend/src/routes/images.js` - Updated to use Supabase Storage
- ✅ `backend/src/app.js` - Added image routes mounting
- ✅ `backend/.env.example` - Updated with Supabase configuration
- ✅ `mobile-app/src/services/api.js` - Implemented actual image upload/delete

## 🔧 Required Actions

### 1. Supabase Dashboard Setup

Follow the steps in [`SUPABASE_STORAGE_SETUP.md`](./SUPABASE_STORAGE_SETUP.md):

- [ ] Create storage bucket named `journal-images`
- [ ] Enable public access on the bucket
- [ ] Set file size limit to 5MB
- [ ] Configure allowed MIME types (image formats)
- [ ] Create storage policy: "Allow authenticated uploads"
- [ ] Create storage policy: "Allow public read"
- [ ] Create storage policy: "Allow authenticated delete"

### 2. Environment Variables

Update your `backend/.env` file:

```env
# Add these if not already present:
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.your-project.supabase.co:5432/postgres
```

To get these values:
- [ ] Go to Supabase Dashboard → Settings → API
- [ ] Copy Project URL → `SUPABASE_URL`
- [ ] Copy `anon public` key → `SUPABASE_ANON_KEY`
- [ ] Copy `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Copy Connection String → `DATABASE_URL`

### 3. Install Dependencies (if needed)

The backend already has `@supabase/supabase-js` installed. Verify:

```bash
cd backend
npm list @supabase/supabase-js
```

If not installed:
```bash
npm install @supabase/supabase-js
```

### 4. Test the Implementation

#### Backend Test:
```bash
cd backend
npm start
```

Check console for:
- No errors on startup
- Server running message
- Database connection confirmed

#### Mobile App Test:
1. [ ] Start the mobile app
2. [ ] Log in with a test account
3. [ ] Create a new journal entry
4. [ ] Add an image
5. [ ] Save the entry
6. [ ] Verify image uploads and displays
7. [ ] Edit the entry and change the image
8. [ ] Delete the entry and verify image cleanup

#### API Test (Optional):
```bash
# Get your JWT token from the app, then:
curl -X POST http://localhost:3000/api/images/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "image=@/path/to/test.jpg"
```

### 5. Verify in Supabase Dashboard

After uploading images:
- [ ] Go to Storage → journal-images
- [ ] Verify folder structure: `user-id/timestamp-random.jpg`
- [ ] Click on an image to preview
- [ ] Check storage usage metrics

## 📊 What Changed

### Before (Local Storage):
```
Mobile App
    ↓ (image file)
Backend (multer)
    ↓ (save to disk)
/uploads/ folder
    ↓ (serve via Express static)
Image URL: http://localhost:3000/uploads/filename.jpg
```

### After (Supabase Storage):
```
Mobile App
    ↓ (image file via FormData)
Backend (multer memory)
    ↓ (buffer in memory)
Storage Service
    ↓ (upload to Supabase)
Supabase Storage Bucket
    ↓ (public URL)
Image URL: https://[project].supabase.co/storage/v1/object/public/journal-images/[user]/[file].jpg
```

## 🔐 Security Features

- ✅ Authentication required for upload/delete
- ✅ Users can only delete their own images
- ✅ File size limited to 5MB
- ✅ Only image MIME types accepted
- ✅ Images organized by user ID
- ✅ Public read access for displaying images

## 🚨 Important Notes

### Service Role Key Security
- ⚠️ NEVER commit `.env` to git
- ⚠️ NEVER expose service role key in client code
- ⚠️ Keep `.env.example` updated without real values

### Image Access
- Images are **publicly accessible** if someone has the URL
- Don't upload sensitive/private images
- Consider adding watermarks if needed

### Mobile App Configuration
Make sure `mobile-app/src/config/index.js` points to correct backend:
```javascript
export const API_URL = 'http://your-backend-url:3000/api';
```

For testing:
- Android Emulator: `http://10.0.2.2:3000/api`
- iOS Simulator: `http://localhost:3000/api`
- Physical Device: `http://YOUR_LOCAL_IP:3000/api` (e.g. `http://192.168.1.100:3000/api`)

## 🐛 Troubleshooting

If images don't upload:
1. [ ] Check backend console for errors
2. [ ] Verify environment variables are set
3. [ ] Confirm storage bucket exists and is public
4. [ ] Check storage policies are created
5. [ ] Verify authentication token is valid

If images don't display:
1. [ ] Check that bucket is public
2. [ ] Verify "Allow public read" policy exists
3. [ ] Check image URL is valid (should be Supabase URL)
4. [ ] Confirm CORS is configured (public buckets usually work)

## ✨ Benefits

### Developer Experience
- ✅ No local file management
- ✅ No need to serve static files
- ✅ Automatic backups (via Supabase)
- ✅ Built-in CDN for fast delivery

### Production Ready
- ✅ Scalable storage
- ✅ Global CDN
- ✅ Automatic optimization
- ✅ Usage analytics

### User Experience
- ✅ Faster image loading
- ✅ Reliable uploads
- ✅ Works on any device
- ✅ No server disk space limits

## 📈 Next Steps

Optional enhancements:
- [ ] Add image compression before upload
- [ ] Implement image caching in mobile app
- [ ] Add progressive image loading
- [ ] Create image thumbnails
- [ ] Set up automated backups
- [ ] Monitor storage usage/costs
- [ ] Add image optimization (WebP format)

## 📚 Resources

- [Supabase Storage Setup Guide](./SUPABASE_STORAGE_SETUP.md)
- [Supabase Storage Docs](https://supabase.com/docs/guides/storage)
- [Backend .env.example](./backend/.env.example)

---

**Ready to go!** Follow the checklist above to complete the migration. 🚀
