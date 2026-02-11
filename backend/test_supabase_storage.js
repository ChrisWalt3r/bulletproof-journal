/**
 * Supabase Storage Configuration Test Script
 * 
 * This script tests your Supabase Storage setup without needing to run
 * the full application. Use it to verify your configuration is correct.
 * 
 * Usage:
 *   node test_supabase_storage.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.cyan}${colors.bright}${msg}${colors.reset}`)
};

const BUCKET_NAME = 'journal-images';
let testsPassed = 0;
let testsFailed = 0;

async function main() {
  console.log(`\n${colors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.bright}  Supabase Storage Configuration Test${colors.reset}`);
  console.log(`${colors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  // Test 1: Check environment variables
  log.section('1. Checking Environment Variables');
  
  const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];

  let allEnvVarsPresent = true;
  for (const envVar of requiredEnvVars) {
    if (process.env[envVar]) {
      log.success(`${envVar} is set`);
    } else {
      log.error(`${envVar} is missing`);
      allEnvVarsPresent = false;
    }
  }

  if (!allEnvVarsPresent) {
    log.error('Missing required environment variables. Check your .env file.');
    process.exit(1);
  }

  testsPassed++;

  // Test 2: Initialize Supabase client
  log.section('2. Initializing Supabase Client');
  
  let supabase;
  try {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    log.success('Supabase client created successfully');
    testsPassed++;
  } catch (error) {
    log.error(`Failed to create Supabase client: ${error.message}`);
    testsFailed++;
    process.exit(1);
  }

  // Test 3: Check if bucket exists
  log.section('3. Checking Storage Bucket');
  
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      log.error(`Failed to list buckets: ${error.message}`);
      testsFailed++;
    } else {
      const bucket = buckets.find(b => b.name === BUCKET_NAME);
      
      if (bucket) {
        log.success(`Bucket '${BUCKET_NAME}' exists`);
        log.info(`  - Public: ${bucket.public ? 'Yes' : 'No'}`);
        log.info(`  - Created: ${new Date(bucket.created_at).toLocaleString()}`);
        
        if (!bucket.public) {
          log.warn('Bucket should be public for images to be accessible');
        }
        testsPassed++;
      } else {
        log.error(`Bucket '${BUCKET_NAME}' not found`);
        log.info('Available buckets: ' + buckets.map(b => b.name).join(', '));
        testsFailed++;
      }
    }
  } catch (error) {
    log.error(`Error checking bucket: ${error.message}`);
    testsFailed++;
  }

  // Test 4: Test upload (requires a test image)
  log.section('4. Testing File Upload');
  
  const testImagePath = path.join(__dirname, 'test-image.jpg');
  
  // Check if test image exists
  if (!fs.existsSync(testImagePath)) {
    log.warn('No test-image.jpg found in current directory');
    log.info('Skipping upload test. To test upload, place a test-image.jpg file here.');
  } else {
    try {
      const fileBuffer = fs.readFileSync(testImagePath);
      const testFilename = `test-user-id/test-${Date.now()}.jpg`;
      
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(testFilename, fileBuffer, {
          contentType: 'image/jpeg',
          upsert: false
        });

      if (error) {
        log.error(`Upload failed: ${error.message}`);
        testsFailed++;
      } else {
        log.success('Test file uploaded successfully');
        log.info(`  - File: ${testFilename}`);
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(testFilename);
        
        log.success('Public URL generated');
        log.info(`  - URL: ${publicUrl}`);
        
        // Clean up test file
        log.info('Cleaning up test file...');
        const { error: deleteError } = await supabase.storage
          .from(BUCKET_NAME)
          .remove([testFilename]);
        
        if (deleteError) {
          log.warn(`Failed to delete test file: ${deleteError.message}`);
        } else {
          log.success('Test file deleted successfully');
        }
        
        testsPassed++;
      }
    } catch (error) {
      log.error(`Upload test error: ${error.message}`);
      testsFailed++;
    }
  }

  // Test 5: Check storage policies (requires service role key)
  log.section('5. Checking Storage Policies');
  
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      log.info('Service role key found - checking policies...');
      log.warn('Policy check requires Supabase Admin API access');
      log.info('Please verify policies manually in Supabase Dashboard');
      log.info('Required policies:');
      log.info('  1. Allow authenticated uploads (INSERT)');
      log.info('  2. Allow public read (SELECT)');
      log.info('  3. Allow authenticated delete (DELETE)');
      
    } catch (error) {
      log.error(`Error with service role: ${error.message}`);
    }
  } else {
    log.warn('SUPABASE_SERVICE_ROLE_KEY not set - skipping policy check');
  }

  // Summary
  log.section('Test Summary');
  console.log(`${colors.green}Passed: ${testsPassed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${testsFailed}${colors.reset}`);
  
  if (testsFailed === 0) {
    console.log(`\n${colors.green}${colors.bright}✓ All tests passed! Your Supabase Storage is configured correctly.${colors.reset}\n`);
  } else {
    console.log(`\n${colors.red}${colors.bright}✗ Some tests failed. Please check the errors above.${colors.reset}\n`);
    process.exit(1);
  }
}

main().catch((error) => {
  log.error(`Unexpected error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
