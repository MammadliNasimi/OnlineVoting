const TURKEY_TIME_ZONE = 'Europe/Istanbul';
const TURKEY_LOCALE = 'tr-TR';

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTimeTR(value, options = {}) {
  const date = toDate(value);
  if (!date) return 'Tarih yok';
  return new Intl.DateTimeFormat(TURKEY_LOCALE, {
    dateStyle: 'long',
    timeStyle: 'medium',
    timeZone: TURKEY_TIME_ZONE,
    ...options
  }).format(date);
}

export function formatDateTR(value, options = {}) {
  const date = toDate(value);
  if (!date) return 'Tarih yok';
  return new Intl.DateTimeFormat(TURKEY_LOCALE, {
    dateStyle: 'long',
    timeZone: TURKEY_TIME_ZONE,
    ...options
  }).format(date);
}

export function formatTimeTR(value, options = {}) {
  const date = toDate(value);
  if (!date) return 'Saat yok';
  return new Intl.DateTimeFormat(TURKEY_LOCALE, {
    timeStyle: 'medium',
    timeZone: TURKEY_TIME_ZONE,
    ...options
  }).format(date);
}

export function formatLocalDateTR(value) {
  const date = toDate(value);
  if (!date) return 'Belirtilmemiş';
  return date.toLocaleDateString(TURKEY_LOCALE, { timeZone: TURKEY_TIME_ZONE });
}

export function formatLocalDateTimeTR(value) {
  const date = toDate(value);
  if (!date) return 'Belirtilmemiş';
  return date.toLocaleString(TURKEY_LOCALE, { timeZone: TURKEY_TIME_ZONE });
}
