// fieldSx ve primaryButtonSx artık tek kaynaktan gelir.
export { fieldSx, primaryButtonSx } from '../../styles/shared';

export const panelSx = {
  borderRadius: 2,
  border: '1px solid rgba(15, 23, 42, 0.10)',
  boxShadow: '0 24px 70px rgba(17, 24, 39, 0.12)'
};

export const outlineButtonSx = {
  borderRadius: 1.5,
  fontWeight: 800,
  textTransform: 'none',
  borderColor: 'rgba(15, 23, 42, 0.16)',
  color: '#243141',
  backgroundColor: 'rgba(255, 255, 255, 0.72)',
  '&:hover': {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.08)'
  }
};

export const headerButtonSx = {
  height: 46,
  px: 2.2,
  borderRadius: 1.5,
  fontWeight: 900,
  textTransform: 'none',
  color: '#f8fafc',
  border: '1px solid rgba(248, 250, 252, 0.18)',
  backgroundColor: 'rgba(255, 255, 255, 0.08)',
  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.10), 0 10px 28px rgba(0, 0, 0, 0.16)',
  backdropFilter: 'blur(12px)',
  '&:hover': {
    borderColor: 'rgba(52, 211, 153, 0.58)',
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 12px 32px rgba(16, 185, 129, 0.14)'
  }
};

export const headerPrimaryButtonSx = {
  ...headerButtonSx,
  color: '#d1fae5',
  borderColor: 'rgba(52, 211, 153, 0.34)',
  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(45, 212, 191, 0.10))'
};
