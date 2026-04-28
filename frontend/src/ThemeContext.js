import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { createTheme, ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material';

const STORAGE_KEY = 'ov_color_mode';

const ThemeCtx = createContext({
  mode: 'light',
  toggleMode: () => {}
});

export function useThemeMode() {
  return useContext(ThemeCtx);
}

function buildTheme(mode) {
  return createTheme({
    palette: {
      // Referans frontend branch ile uyum: globalde tek, stabil light palet.
      mode: 'light',
      primary: { main: '#10b981' },
      secondary: { main: '#4f46e5' },
      background: {
        default: '#f4f6f8',
        paper: '#ffffff'
      },
      text: {
        primary: '#111827',
        secondary: '#475569'
      }
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none'
          }
        }
      }
    }
  });
}

export function AppThemeProvider({ children }) {
  // Mevcut ekranların çoğu light tasarımla yazıldığı için dark mode kontrast
  // problemleri yaratıyor. Referans branch davranışı için light'a sabitliyoruz.
  const [mode, setMode] = useState('light');

  const toggleMode = useCallback(() => {
    setMode('light');
    localStorage.setItem(STORAGE_KEY, 'light');
  }, []);

  const theme = useMemo(() => buildTheme(mode), [mode]);

  return (
    <ThemeCtx.Provider value={{ mode, toggleMode }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeCtx.Provider>
  );
}
