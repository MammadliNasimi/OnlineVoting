// Lightweight, privacy-friendly analytics stub.
// Sends events to server if API endpoint present, otherwise logs to console.
import axios from 'axios';
import { API_BASE } from '../config';

export function trackEvent(name, payload = {}) {
  try {
    const ev = { name, payload, ts: Date.now() };
    if (API_BASE) {
      // best-effort, don't await
      axios.post(`${API_BASE}/analytics`, ev).catch(() => {});
    }
    // keep local console logging for debugging
    // eslint-disable-next-line no-console
    console.log('Analytics event', ev);
  } catch (e) {
    // swallow errors to avoid impacting UX
  }
}
