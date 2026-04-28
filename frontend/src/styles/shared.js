/**
 * shared.js — Paylaşılan MUI sx objeleri
 * ─────────────────────────────────────────
 * Tekrar eden stil tanımlarını tek yerden yönetir.
 * auth/styles.js ve voting/styles.js'teki identik fieldSx
 * ve çok benzer primaryButtonSx buradan re-export edilir.
 */

export const fieldSx = {
  '& .MuiInputLabel-root': { color: '#334155' },
  '& .MuiOutlinedInput-root': {
    borderRadius: 1.5,
    backgroundColor: '#ffffff',
    color: '#0f172a',
    '& fieldset': { borderColor: 'rgba(15, 23, 42, 0.22)' },
    '&:hover fieldset': { borderColor: '#14b8a6' },
    '&.Mui-focused fieldset': {
      borderColor: '#14b8a6',
      boxShadow: '0 0 0 3px rgba(20, 184, 166, 0.16)'
    }
  },
  '& .MuiInputLabel-root.Mui-focused': { color: '#0f766e' }
};

// Votingde `fontWeight: 900` + `&.Mui-disabled` kullanılıyor;
// auth'da `fontWeight: 800`, disabled tanımlı değil.
// İkisi de aynı renk/gradient — voting versiyonu daha eksiksiz olduğundan onu baz alıyoruz.
export const primaryButtonSx = {
  py: 1.35,
  borderRadius: 1.5,
  fontWeight: 900,
  textTransform: 'none',
  color: '#06221d',
  background: 'linear-gradient(135deg, #34d399 0%, #10b981 48%, #0f9f8f 100%)',
  boxShadow: '0 16px 34px rgba(16, 185, 129, 0.24)',
  '&:hover': {
    background: 'linear-gradient(135deg, #2cc98f 0%, #0ea774 48%, #0b867a 100%)',
    boxShadow: '0 18px 38px rgba(16, 185, 129, 0.30)'
  },
  '&.Mui-disabled': {
    color: 'rgba(6, 34, 29, 0.55)',
    background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.56), rgba(15, 159, 143, 0.56))'
  }
};
