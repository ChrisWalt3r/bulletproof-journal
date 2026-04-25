import { API_URL } from '../config/env.js';
import { getAccessToken, supabase } from '../context/AuthContext.jsx';

const parseResponse = async (response) => {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { raw: text };
  }
};

const createHttpError = (response, data, code) => {
  const message = `HTTP ${response.status} ${response.statusText}`.trim();
  const error = new Error(message);
  error.status = response.status;
  error.code = code;
  error.data = data;
  return error;
};

const fetchJson = async (
  url,
  options = {},
  requiresAuth = true,
  hasRetriedAuth = false
) => {
  const baseHeaders = {
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  if (!(options.body instanceof FormData)) {
    baseHeaders['Content-Type'] = 'application/json';
  }

  let token = null;
  if (requiresAuth) {
    token = await getAccessToken();
    if (!token) {
      const authError = new Error('Authentication required');
      authError.status = 401;
      authError.code = 'AUTH_REQUIRED';
      throw authError;
    }
  }

  const headers = { ...baseHeaders };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });
  const data = await parseResponse(response);

  if (
    response.status === 401 &&
    requiresAuth &&
    !hasRetriedAuth &&
    token
  ) {
    const refreshedToken = await getAccessToken({ forceRefresh: true });

    if (refreshedToken && refreshedToken !== token) {
      return fetchJson(url, options, requiresAuth, true);
    }
  }

  if (!response.ok) {
    if (response.status === 401 && requiresAuth) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Ignore sign-out errors here; the original HTTP error still matters most.
      }
    }

    const code =
      response.status === 401
        ? 'AUTH_INVALID'
        : response.status === 429
          ? 'RATE_LIMITED'
          : 'HTTP_ERROR';

    throw createHttpError(response, data, code);
  }

  return data;
};

export const initializeApi = async () => {
  console.log('API initialized for web mode');
};

export const journalAPI = {
  async getEntries(page = 1, limit = 10, search = '', accountId = null) {
    let url = `${API_URL}/journal?page=${page}&limit=${limit}`;

    if (search) {
      url += `&search=${encodeURIComponent(search)}`;
    }

    if (accountId) {
      url += `&accountId=${accountId}`;
    }

    const data = await fetchJson(url);
    return {
      entries: data.entries || [],
      pagination: data.pagination || { page, limit, total: 0, pages: 0 },
    };
  },

  async getBalanceHistory(accountId) {
    const data = await fetchJson(
      `${API_URL}/journal?page=1&limit=500&accountId=${accountId}`
    );

    return (data.entries || [])
      .filter((entry) => entry.balance !== null && entry.balance !== undefined)
      .sort((left, right) => new Date(left.created_at) - new Date(right.created_at));
  },

  async getEntry(id) {
    const data = await fetchJson(`${API_URL}/journal/${id}`);
    return { entry: data };
  },

  async createEntry(entryData) {
    return fetchJson(`${API_URL}/journal`, {
      method: 'POST',
      body: JSON.stringify(entryData),
    });
  },

  async updateEntry(id, entryData) {
    return fetchJson(`${API_URL}/journal/${id}`, {
      method: 'PUT',
      body: JSON.stringify(entryData),
    });
  },

  async deleteEntry(id) {
    return fetchJson(`${API_URL}/journal/${id}`, {
      method: 'DELETE',
    });
  },

  async syncMt5Entries() {
    return { success: true };
  },
};

export const imageAPI = {
  async uploadImage(file) {
    if (!file) {
      throw new Error('No image file provided');
    }

    if (typeof file === 'string') {
      return {
        imageUrl: file,
        filename: file.split('/').pop() || `image_${Date.now()}`,
      };
    }

    const token = await getAccessToken();

    if (!token) {
      throw new Error('No authentication token available');
    }

    const formData = new FormData();
    formData.append('image', file, file.name || `image_${Date.now()}.jpg`);

    const response = await fetch(`${API_URL}/images/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    const data = await parseResponse(response);

    if (!response.ok) {
      throw new Error(data?.error || `Upload failed: ${response.status}`);
    }

    return {
      imageUrl: data.imageUrl,
      filename: data.filename,
    };
  },

  async deleteImage(filename) {
    if (!filename) {
      return { success: true };
    }

    let fileToDelete = filename;

    if (filename.includes('supabase.co/storage')) {
      const parts = filename.split('journal-images/');
      if (parts.length > 1) {
        fileToDelete = parts[1].split('?')[0];
      }
    } else if (filename.startsWith('/uploads/')) {
      fileToDelete = filename.replace('/uploads/', '');
    }

    const token = await getAccessToken();

    if (!token) {
      throw new Error('No authentication token available');
    }

    const response = await fetch(
      `${API_URL}/images/${encodeURIComponent(fileToDelete)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      }
    );
    const data = await parseResponse(response);

    if (!response.ok) {
      return {
        success: false,
        error: data?.error || `Delete failed: ${response.status}`,
      };
    }

    return { success: true };
  },
};

export const accountsAPI = {
  getAccounts() {
    return fetchJson(`${API_URL}/accounts`);
  },

  getAccount(id) {
    return fetchJson(`${API_URL}/accounts/${id}`);
  },

  createAccount(accountData) {
    return fetchJson(`${API_URL}/accounts`, {
      method: 'POST',
      body: JSON.stringify(accountData),
    });
  },

  updateAccount(id, accountData) {
    return fetchJson(`${API_URL}/accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(accountData),
    });
  },

  deleteAccount(id) {
    return fetchJson(`${API_URL}/accounts/${id}`, {
      method: 'DELETE',
    });
  },

  getAccountStats(id) {
    return fetchJson(`${API_URL}/accounts/${id}/stats`);
  },
};

export const plansAPI = {
  getPlans() {
    return fetchJson(`${API_URL}/plans`);
  },

  createPlan(name) {
    return fetchJson(`${API_URL}/plans`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  renamePlan(planId, name) {
    return fetchJson(`${API_URL}/plans/${planId}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
  },

  deletePlan(planId) {
    return fetchJson(`${API_URL}/plans/${planId}`, {
      method: 'DELETE',
    });
  },

  getCriteria(planId) {
    return fetchJson(`${API_URL}/plans/${planId}/criteria`);
  },

  addCriterion(planId, text) {
    return fetchJson(`${API_URL}/plans/${planId}/criteria`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  },

  updateCriterionText(planId, criterionId, text) {
    return fetchJson(`${API_URL}/plans/${planId}/criteria/${criterionId}`, {
      method: 'PUT',
      body: JSON.stringify({ text }),
    });
  },

  toggleCriterion(planId, criterionId, checked) {
    return fetchJson(
      `${API_URL}/plans/${planId}/criteria/${criterionId}/toggle`,
      {
        method: 'PATCH',
        body: JSON.stringify({ checked }),
      }
    );
  },

  deleteCriterion(planId, criterionId) {
    return fetchJson(`${API_URL}/plans/${planId}/criteria/${criterionId}`, {
      method: 'DELETE',
    });
  },

  reorderCriteria(planId, order) {
    return fetchJson(`${API_URL}/plans/${planId}/criteria/reorder`, {
      method: 'POST',
      body: JSON.stringify({ order }),
    });
  },

  resetCriteria(planId) {
    return fetchJson(`${API_URL}/plans/${planId}/criteria/reset`, {
      method: 'POST',
    });
  },
};
