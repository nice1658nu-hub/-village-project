const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`Laravel API error ${response.status}`);
  }

  return response.json();
}

export const api = {
  getBootstrapData: () => request('/bootstrap'),
  login: (phone, password) => request('/login', {
    method: 'POST',
    body: JSON.stringify({ phone, password }),
  }),
  register: (payload) => request('/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  createIncident: (payload) => request('/incidents', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  updateIncidentStatus: (id, payload) => request(`/incidents/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
  deleteIncident: (id) => request(`/incidents/${id}`, { method: 'DELETE' }),
  saveNews: (payload, id = null) => request(id ? `/news/${id}` : '/news', {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(payload),
  }),
  deleteNews: (id) => request(`/news/${id}`, { method: 'DELETE' }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  saveNotificationToken: (payload) => request('/notification-tokens', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
};

export { API_BASE_URL };
