import axios from 'axios';

const axiosClient = axios.create({
  // In development, Vite proxies /api to the backend. A relative URL also
  // keeps the API on the same origin when the frontend is opened via
  // localhost, 127.0.0.1, or another development hostname.
  // Set VITE_API_URL when the frontend and API are hosted separately.
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

/*
=========================================================
AJOUT AUTOMATIQUE DU TOKEN JWT
=========================================================
*/
axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export default axiosClient;
