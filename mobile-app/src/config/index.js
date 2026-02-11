// Toggle this flag to switch between local dev and production
const USE_PRODUCTION = true;

// Local development (your machine's WiFi IP)
const LOCAL_API_URL = 'http://10.66.43.129:3000/api';

// Production (AWS EC2 — update this after launching your instance)
const PRODUCTION_API_URL = 'https://YOUR_EC2_PUBLIC_IP:3000/api'; // <-- Replace after AWS setup

export const API_URL = USE_PRODUCTION ? PRODUCTION_API_URL : LOCAL_API_URL;
export const SUPABASE_URL = 'https://pjiishvyrepvltrklyjw.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqaWlzaHZ5cmVwdmx0cmtseWp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2OTAwNTksImV4cCI6MjA4NTI2NjA1OX0.2AIRP7XchehlUQEy93973iICILWS4Cg2CQnHkHH93Lg';
