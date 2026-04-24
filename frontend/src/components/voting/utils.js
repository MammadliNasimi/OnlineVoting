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
