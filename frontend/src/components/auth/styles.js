// fieldSx ve primaryButtonSx artık tek kaynaktan gelir.
export { fieldSx, primaryButtonSx } from '../../styles/shared';

export const secondaryButtonSx = {
  borderRadius: 1.5,
  fontWeight: 700,
  textTransform: 'none',
  borderColor: 'rgba(15, 23, 42, 0.18)',
  color: '#243141',
  '&:hover': {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.07)'
  }
};

export const iconBubbleSx = {
  width: 40,
  height: 40,
  borderRadius: 2,
  display: 'grid',
  placeItems: 'center',
  color: '#2dd4bf',
  backgroundColor: 'rgba(45, 212, 191, 0.12)',
  border: '1px solid rgba(45, 212, 191, 0.22)'
};
