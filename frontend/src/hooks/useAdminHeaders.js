import { useMemo } from 'react';

/**
 * Admin komponentlerinde tekrar eden
 *   useMemo(() => ({ headers: { 'x-session-id': sessionId }, withCredentials: true }), [sessionId])
 * pattern'ini tek yerde toplar.
 */
export default function useAdminHeaders(sessionId) {
  return useMemo(
    () => ({ headers: { 'x-session-id': sessionId }, withCredentials: true }),
    [sessionId]
  );
}
