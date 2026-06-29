// API utility for centralized backend URL configuration
const API_URL = import.meta.env.VITE_API_URL || '';

export const apiFetch = async (endpoint: string, options?: RequestInit) => {
  const url = API_URL ? `${API_URL}${endpoint}` : endpoint;
  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Include cookies for authentication
  });
  return response;
};

export const API_URL_CONFIG = API_URL;
