// Centralized API + Socket configuration.
// Tek REACT_APP_API_URL set etmek yeterli; diğerleri otomatik türetilir.
// Override istersen REACT_APP_API_BASE_URL ve REACT_APP_SOCKET_URL kullanılabilir.

const stripTrailingSlash = (value) => (value || '').replace(/\/$/, '');

const RAW_API_URL = stripTrailingSlash(process.env.REACT_APP_API_URL || 'http://localhost:5000');

export const API_URL = RAW_API_URL;

export const API_BASE = stripTrailingSlash(
  process.env.REACT_APP_API_BASE_URL || `${RAW_API_URL}/api`
);

export const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || RAW_API_URL;
