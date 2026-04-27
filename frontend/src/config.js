// Centralized API + Socket configuration.
// Bir tek REACT_APP_API_URL set etmek yeterli; diğerleri otomatik türetilir.
// İstersen REACT_APP_API_BASE_URL ve REACT_APP_SOCKET_URL ile override edebilirsin.

const stripTrailingSlash = (value) => (value || '').replace(/\/$/, '');

const RAW_API_URL = stripTrailingSlash(process.env.REACT_APP_API_URL || 'http://localhost:5000');

export const API_URL = RAW_API_URL;

export const API_BASE = stripTrailingSlash(
  process.env.REACT_APP_API_BASE_URL || `${RAW_API_URL}/api`
);

export const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || RAW_API_URL;

const config = { API_URL, API_BASE, SOCKET_URL };
export default config;
