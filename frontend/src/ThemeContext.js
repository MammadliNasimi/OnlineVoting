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
  const isDark = mode === 'dark';
  return createTheme({
    palette: {
      mode,
      primary: { main: '#10b981' },
      secondary: { main: '#4f46e5' },
      background: {
        default: isDark ? '#0f172a' : '#dbe6eb',
        paper: isDark ? '#1e293b' : '#ffffff'
      },
      text: {
        primary: isDark ? '#f1f5f9' : '#111827',
        secondary: isDark ? '#94a3b8' : '#475569'
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
  const [mode, setMode] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  const toggleMode = useCallback(() => {
    setMode((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
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
