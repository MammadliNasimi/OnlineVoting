export const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 1.5,
    backgroundColor: '#fbfdff',
    '& fieldset': {
      borderColor: 'rgba(15, 23, 42, 0.14)'
    },
    '&:hover fieldset': {
      borderColor: '#10b981'
    },
    '&.Mui-focused fieldset': {
      borderColor: '#10b981',
      boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.14)'
    }
  },
  '& .MuiInputLabel-root.Mui-focused': {
    color: '#0f9f8f'
  }
};

export const primaryButtonSx = {
  py: 1.45,
  borderRadius: 1.5,
  fontWeight: 800,
  textTransform: 'none',
  color: '#06221d',
  boxShadow: '0 16px 34px rgba(16, 185, 129, 0.24)',
  background: 'linear-gradient(135deg, #34d399 0%, #10b981 48%, #0f9f8f 100%)',
  '&:hover': {
    boxShadow: '0 18px 38px rgba(16, 185, 129, 0.30)',
    background: 'linear-gradient(135deg, #2cc98f 0%, #0ea774 48%, #0b867a 100%)'
  }
};

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
