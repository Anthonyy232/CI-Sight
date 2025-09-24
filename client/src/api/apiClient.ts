import axios from 'axios';
import {notifications} from '@mantine/notifications';

/**
 * Axios instance preconfigured for the backend API.
 *
 * Centralizes base URL and common response handling (401 redirect,
 * user-facing notifications for other errors).
 */
export const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Don't show a global error for 401, as it triggers a redirect.
    if (error.response?.status === 401) {
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    } else {
      // For all other errors, show a notification.
      const errorMessage = error.response?.data?.error || error.message || 'An unexpected error occurred';
      notifications.show({
        title: 'API Error',
        message: errorMessage,
        color: 'red',
      });
    }
    return Promise.reject(error);
  }
);