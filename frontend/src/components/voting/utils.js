import { useEffect, useRef, useState } from 'react';

// ─── Geri sayım hook ─────────────────────────────────────────────
// targetDate: ISO string veya Date — o zamana kadar say.
// Null döner (süre dolmuşsa veya geçersizse).
export function useCountdown(targetDate) {
  const calcDiff = () => {
    const diff = new Date(targetDate).getTime() - Date.now();
    if (!Number.isFinite(diff) || diff <= 0) return null;
    const totalSecs = Math.floor(diff / 1000);
    return {
      days: Math.floor(totalSecs / 86400),
      hours: Math.floor((totalSecs % 86400) / 3600),
      minutes: Math.floor((totalSecs % 3600) / 60),
      seconds: totalSecs % 60,
      totalMs: diff
    };
  };

  const [remaining, setRemaining] = useState(() => calcDiff());
  const ref = useRef();

  useEffect(() => {
    setRemaining(calcDiff());
    ref.current = setInterval(() => setRemaining(calcDiff()), 1000);
    return () => clearInterval(ref.current);
  }, [targetDate]); // eslint-disable-line react-hooks/exhaustive-deps

  return remaining;
}

export function padTwo(n) {
  return String(n).padStart(2, '0');
}

// ─────────────────────────────────────────────────────────────────

export const formatVoteDate = (vote) => {
  const raw = vote.voted_at ?? vote.timestamp ?? vote.created_at ?? vote.createdAt ?? vote.date;
  if (!raw) return 'Tarih yok';
  const d = new Date(String(raw).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? 'Gecersiz tarih' : d.toLocaleString('tr-TR');
};

export const formatElectionDate = (value) => {
  if (!value) return 'Belirtilmemis';
  const d = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? 'Belirtilmemis' : d.toLocaleDateString('tr-TR');
};

export const shortAddress = (address = '') => {
  if (!address || address.length < 12) return address || '-';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const getPublicEmailType = (email = '') => (
  email.endsWith('@gmail.com')
  || email.endsWith('@hotmail.com')
  || email.endsWith('@yahoo.com')
  || email.endsWith('@outlook.com')
);
