import { API_URL } from '../config';
import { supabase } from '../context/AuthContext';

// Get current auth token from Supabase session
const getAuthToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
};

// Helper for network fetch with JSON handling and auth
const fetchJson = async (url, options = {}, requiresAuth = true) => {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  // Add auth token if required
  if (requiresAuth) {
    const token = await getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const res = await fetch(url, {
    ...options,
    headers
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const error = new Error(`HTTP ${res.status} ${res.statusText}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
};

// No-op initialization (SQLite removed, backend handles everything)
const initializeApi = async () => {
  console.log('API initialized (cloud mode)');
};

// Journal API calls - fetching from cloud backend
export const journalAPI = {
  getEntries: async (page = 1, limit = 10, search = '', accountId = null) => {
    let url = `${API_URL}/journal?page=${page}&limit=${limit}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (accountId) url += `&accountId=${accountId}`;

    const data = await fetchJson(url);
    return {
      entries: data.entries || [],
      pagination: data.pagination || { page, limit, total: 0, pages: 0 }
    };
  },

  getBalanceHistory: async (accountId) => {
    // Derive from entries with balance field
    const data = await fetchJson(`${API_URL}/journal?page=1&limit=500&accountId=${accountId}`);
    const entries = (data.entries || [])
      .filter(e => e.balance !== null && e.balance !== undefined)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    return entries;
  },

  getEntry: async (id) => {
    const data = await fetchJson(`${API_URL}/journal/${id}`);
    return { entry: data };
  },

  createEntry: async (entryData) => {
    const data = await fetchJson(`${API_URL}/journal`, {
      method: 'POST',
      body: JSON.stringify(entryData)
    });
    return data;
  },

  updateEntry: async (id, entryData) => {
    const data = await fetchJson(`${API_URL}/journal/${id}`, {
      method: 'PUT',
      body: JSON.stringify(entryData)
    });
    return data;
  },

  deleteEntry: async (id) => {
    const data = await fetchJson(`${API_URL}/journal/${id}`, {
      method: 'DELETE'
    });
    return data;
  },

  // MT5 sync is now handled server-side
  syncMt5Entries: async (accountId) => {
    console.log('MT5 entries are synced server-side');
    return { success: true };
  }
};

// Image API calls
export const imageAPI = {
  uploadImage: async (imageUri) => {
    try {
      console.log('Uploading image to Supabase Storage:', imageUri);
      
      // Get auth token
      const token = await getAuthToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      // Create FormData for file upload
      const formData = new FormData();
      
      // Extract filename from URI
      const uriParts = imageUri.split('/');
      const fileName = uriParts[uriParts.length - 1];
      
      // Append the file to FormData
      formData.append('image', {
        uri: imageUri,
        type: 'image/jpeg', // You can adjust based on actual file type
        name: fileName || `image_${Date.now()}.jpg`
      });

      // Upload to backend (which will store in Supabase)
      const response = await fetch(`${API_URL}/images/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type - let the browser set it with boundary
        },
        body: formData
      });

      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        console.error('Failed to parse response:', text);
        throw new Error('Invalid response from server');
      }

      if (!response.ok) {
        throw new Error(data?.error || `Upload failed: ${response.status}`);
      }

      console.log('Image uploaded successfully:', data);
      return {
        imageUrl: data.imageUrl,
        filename: data.filename
      };
    } catch (error) {
      console.error('Image upload error:', error);
      throw error;
    }
  },

  deleteImage: async (filename) => {
    try {
      if (!filename) {
        console.log('No filename provided for deletion');
        return { success: true };
      }

      // Extract just the filename part if it's a full URL
      let fileToDelete = filename;
      if (filename.includes('supabase.co/storage')) {
        // Extract the path after 'journal-images/'
        const parts = filename.split('journal-images/');
        if (parts.length > 1) {
          fileToDelete = parts[1].split('?')[0]; // Remove query params if present
        }
      } else if (filename.startsWith('/uploads/')) {
        // Handle old local storage format
        fileToDelete = filename.replace('/uploads/', '');
      }

      console.log('Deleting image:', fileToDelete);

      const token = await getAuthToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await fetch(`${API_URL}/images/${encodeURIComponent(fileToDelete)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        console.error('Failed to parse delete response:', text);
      }

      if (!response.ok) {
        console.error('Delete failed:', data);
        throw new Error(data?.error || `Delete failed: ${response.status}`);
      }

      console.log('Image deleted successfully');
      return { success: true };
    } catch (error) {
      console.error('Image deletion error:', error);
      // Don't throw - allow the operation to continue even if delete fails
      return { success: false, error: error.message };
    }
  },
};

// Accounts API calls - fetching from cloud backend
export const accountsAPI = {
  getAccounts: async () => {
    const data = await fetchJson(`${API_URL}/accounts`);
    return data;
  },

  getAccount: async (id) => {
    const data = await fetchJson(`${API_URL}/accounts/${id}`);
    return data;
  },

  createAccount: async (accountData) => {
    const data = await fetchJson(`${API_URL}/accounts`, {
      method: 'POST',
      body: JSON.stringify(accountData)
    });
    return data;
  },

  updateAccount: async (id, accountData) => {
    const data = await fetchJson(`${API_URL}/accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(accountData)
    });
    return data;
  },

  deleteAccount: async (id) => {
    const data = await fetchJson(`${API_URL}/accounts/${id}`, {
      method: 'DELETE'
    });
    return data;
  },

  getAccountStats: async (id) => {
    const data = await fetchJson(`${API_URL}/accounts/${id}/stats`);
    return data;
  },
};

export { initializeApi };
