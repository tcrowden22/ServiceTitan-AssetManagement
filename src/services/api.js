const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

const handleResponse = async (response) => {
  if (response.status === 401) {
    // Dispatch a custom event that AuthContext or App can listen to
    window.dispatchEvent(new Event('auth:unauthorized'));
    throw new Error('Session expired. Please login again.');
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Request failed with status ${response.status}`);
  }
  return response.json();
};

export const api = {
  assets: {
    getAll: async () => {
      const response = await fetch('/api/assets', {
        headers: getHeaders()
      });
      return handleResponse(response);
    },
    
    create: async (assetData) => {
      const response = await fetch('/api/assets', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(assetData)
      });
      return handleResponse(response);
    },
    
    update: async (id, assetData) => {
      const response = await fetch(`/api/assets/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(assetData)
      });
      return handleResponse(response);
    },
    
    delete: async (id) => {
      const response = await fetch(`/api/assets/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      // Delete usually returns 200/204, check response
      if (response.status === 401) {
        window.dispatchEvent(new Event('auth:unauthorized'));
        throw new Error('Session expired. Please login again.');
      }
      if (!response.ok) throw new Error('Failed to delete asset');
      return true;
    },
    
    migrate: async (assets) => {
      const response = await fetch('/api/assets/migrate', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(assets)
      });
      return handleResponse(response);
    },

    getHistory: async (id) => {
      const response = await fetch(`/api/assets/${id}/history`, {
        headers: getHeaders()
      });
      return handleResponse(response);
    },

    assign: async (id, assignedUser) => {
      const response = await fetch(`/api/assets/${id}/assign`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ assignedUser })
      });
      return handleResponse(response);
    },

    return: async (id) => {
      const response = await fetch(`/api/assets/${id}/return`, {
        method: 'POST',
        headers: getHeaders()
      });
      return handleResponse(response);
    },

    getFieldAssignments: async (id) => {
      const response = await fetch(`/api/assets/${id}/field-assignments`, {
        headers: getHeaders()
      });
      return handleResponse(response);
    },

    getFieldAssignment: async (id, fieldName) => {
      const response = await fetch(`/api/assets/${id}/field-assignments/${fieldName}`, {
        headers: getHeaders()
      });
      return handleResponse(response);
    },

    updateFieldAssignment: async (id, fieldName, value, source, sourceField) => {
      const response = await fetch(`/api/assets/${id}/field-assignments/${fieldName}/update`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ value, source, sourceField })
      });
      return handleResponse(response);
    },

    bulkCreateFieldAssignments: async (assignments) => {
      const response = await fetch('/api/assets/field-assignments/bulk', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ assignments })
      });
      return handleResponse(response);
    },

    getDuplicates: async () => {
      const response = await fetch('/api/assets/duplicates', {
        headers: getHeaders()
      });
      return handleResponse(response);
    },

    deleteDuplicate: async (id) => {
      const response = await fetch(`/api/assets/duplicates/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      return handleResponse(response);
    },

    cleanupDuplicates: async (keepStrategy = 'mostRecent') => {
      const response = await fetch('/api/assets/duplicates/cleanup', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ keepStrategy })
      });
      return handleResponse(response);
    },

    getEmployees: async () => {
      const response = await fetch('/api/assets/employees', {
        headers: getHeaders()
      });
      return handleResponse(response);
    },

    cleanupData: async (options = {}) => {
      const response = await fetch('/api/assets/cleanup', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(options)
      });
      return handleResponse(response);
    },

    deleteAll: async () => {
      const response = await fetch('/api/assets', {
        method: 'DELETE',
        headers: getHeaders()
      });
      return handleResponse(response);
    },

    bulkUpdate: async (field, value, filters) => {
      const response = await fetch('/api/assets/bulk-update', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ field, value, filters })
      });
      return handleResponse(response);
    }
  },
  
  auth: {
    login: async (email, password) => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }
      return response.json();
    },
    
    register: async (username, email, password) => {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Registration failed');
      }
      return response.json();
    }
  }
};
