const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
const isVercelDeployment =
  typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app');
const API_BASE_URL = isVercelDeployment ? '/api' : configuredApiBaseUrl;
const TOKEN_KEY = 'smart_village_token';

// Keep authentication per browser tab. This allows a citizen, a village
// coordinator and TAO staff to be tested in separate tabs without the most
// recent login replacing every other tab. sessionStorage survives refresh.
const tokenStorage = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  set: (value) => sessionStorage.setItem(TOKEN_KEY, value),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function request(path, options = {}) {
  const token = tokenStorage.get();
  const isFormData = options.body instanceof FormData;
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        Accept: 'application/json',
        ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      ...options,
    });
  } catch (error) {
    throw new ApiError(
      'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณารีเฟรชหน้าเว็บแล้วลองใหม่',
      0,
      { cause: error?.message || 'Network request failed' },
    );
  }

  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(data?.message || `Laravel API error ${response.status}`, response.status, data);
  return data;
}

export const api = {
  hasSession: () => Boolean(tokenStorage.get()),
  clearSession: () => tokenStorage.clear(),
  getBootstrapData: () => request('/bootstrap'),
  getMe: () => request('/me'),
  login: async (phone, password) => {
    const data = await request('/login', { method: 'POST', body: JSON.stringify({ phone, password }) });
    tokenStorage.set(data.token);
    return data;
  },
  logout: async () => {
    try { await request('/logout', { method: 'POST' }); } finally { tokenStorage.clear(); }
  },
  getDashboardData: () => request('/dashboard/bootstrap'),
  register: (payload) => request('/register', {
    method: 'POST',
    body: JSON.stringify({ ...payload, password_confirmation: payload.password }),
  }),
  forgotPassword: (email) => request('/forgot-password', {
    method: 'POST', body: JSON.stringify({ email }),
  }),
  resetPassword: (payload) => request('/reset-password', {
    method: 'POST', body: JSON.stringify(payload),
  }),
  updateRecoveryEmail: (email, currentPassword) => request('/profile/recovery-email', {
    method: 'PATCH', body: JSON.stringify({ email, current_password: currentPassword }),
  }),
  changePassword: (currentPassword, password, confirmation) => request('/profile/password', {
    method: 'PATCH', body: JSON.stringify({ current_password: currentPassword, password, password_confirmation: confirmation }),
  }),
  createIncident: (payload) => request('/incidents', {
    method: 'POST',
    body: payload instanceof FormData ? payload : JSON.stringify(payload),
  }),
  supportIncident: (id) => request(`/incidents/${id}/support`, {
    method: 'PUT',
    body: JSON.stringify({}),
  }),
  updateIncidentStatus: (id, payload) => {
    if (payload instanceof FormData) {
      payload.append('_method', 'PATCH');
      return request(`/incidents/${id}/status`, { method: 'POST', body: payload });
    }
    return request(`/incidents/${id}/status`, { method: 'PATCH', body: JSON.stringify(payload) });
  },
  createStaff: (payload) => request('/staff', { method: 'POST', body: JSON.stringify(payload) }),
  forwardIncidentToTao: (id, payload) => {
    if (payload instanceof FormData) {
      payload.set('_method', 'PATCH');
      return request(`/incidents/${id}/forward-to-tao`, {
        method: 'POST',
        body: payload,
      });
    }
    return request(`/incidents/${id}/forward-to-tao`, {
      method: 'PATCH',
      body: JSON.stringify({ note: payload }),
    });
  },
  saveIncidentFeedback: (id, payload) => request(`/incidents/${id}/feedback`, { method: 'PUT', body: JSON.stringify(payload) }),
  assignIncident: (id, assigned_to, priority = 1, note = null, department = null, due_at = null) => request(`/incidents/${id}/assign`, { method: 'PATCH', body: JSON.stringify({ assigned_to, priority, note, department, due_at }) }),
  startIncident: (id) => request(`/incidents/${id}/start`, { method: 'PATCH', body: JSON.stringify({}) }),
  addIncidentProgress: (id, payload) => request(`/incidents/${id}/progress`, { method: 'POST', body: payload }),
  submitIncidentWork: (id, payload) => request(`/incidents/${id}/submit`, { method: 'POST', body: payload }),
  reviewIncident: (id, decision, note = null) => request(`/incidents/${id}/review`, { method: 'PATCH', body: JSON.stringify({ decision, note }) }),
  deleteIncident: (id) => request(`/incidents/${id}`, { method: 'DELETE' }),
  saveNews: (payload, id = null) => {
    if (payload instanceof FormData) {
      if (id) payload.append('_method', 'PUT');
      return request(id ? `/news/${id}` : '/news', { method: 'POST', body: payload });
    }
    return request(id ? `/news/${id}` : '/news', { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
  },
  deleteNews: (id) => request(`/news/${id}`, { method: 'DELETE' }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  updateUserStatus: (id, account_status, approval_note = null) => request(`/users/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ account_status, approval_note }),
  }),
  saveNotificationToken: (payload) => request('/notification-tokens', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  getNotifications: () => request('/notifications'),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, {
    method: 'PATCH',
  }),
};

export { API_BASE_URL };
