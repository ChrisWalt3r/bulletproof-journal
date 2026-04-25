const DEFAULT_API_URL = 'https://bulletproof-journal-1.onrender.com/api';
const DEFAULT_SUPABASE_URL = 'https://pjiishvyrepvltrklyjw.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqaWlzaHZ5cmVwdmx0cmtseWp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2OTAwNTksImV4cCI6MjA4NTI2NjA1OX0.2AIRP7XchehlUQEy93973iICILWS4Cg2CQnHkHH93Lg';

export const API_URL =
  import.meta.env.VITE_API_URL ||
  import.meta.env.EXPO_PUBLIC_BACKEND_URL ||
  DEFAULT_API_URL;
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.EXPO_PUBLIC_SUPABASE_URL ||
  DEFAULT_SUPABASE_URL;
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  DEFAULT_SUPABASE_ANON_KEY;
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '2.0.0-web';
export const APP_NAME = 'Bulletproof Journal';
export const APP_DOMAIN =
  import.meta.env.VITE_APP_DOMAIN ||
  import.meta.env.EXPO_PUBLIC_APP_DOMAIN ||
  (typeof window !== 'undefined' ? window.location.origin : '');
