// constants/api.ts

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export const API_ENDPOINTS = {
  // Auth
  login: '/users/login/',
  register: '/users/register/',
  refresh: '/users/token/refresh/',  
  // ...and all your other endpoints
};
