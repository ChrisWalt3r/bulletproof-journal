// Prefer an explicit Expo backend URL when one is provided for testing.
// Fall back to the known production or local endpoints otherwise.
const EXPO_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// Local development (your machine's WiFi IP)
const LOCAL_API_URL = 'http://10.146.155.129:3000/api';

// Production (Render Cloud)
const PRODUCTION_API_URL = 'https://web-journal-2r5u.onrender.com/api';

export const API_URL = EXPO_BACKEND_URL || PRODUCTION_API_URL || LOCAL_API_URL;
export const SUPABASE_URL = 'https://pjiishvyrepvltrklyjw.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqaWlzaHZ5cmVwdmx0cmtseWp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2OTAwNTksImV4cCI6MjA4NTI2NjA1OX0.2AIRP7XchehlUQEy93973iICILWS4Cg2CQnHkHH93Lg';
