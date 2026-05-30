import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Launcher } from './screens/Launcher';
import { useAppStore } from './store/useAppStore';
import { SetupCheckModal } from './components/SetupCheckModal';
import './index.css';

const THEME_KEY = 'advance-studio-theme';

function loadSavedTheme() {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const store = useAppStore.getState();
      if (parsed.themeBgPanel) store.setTheme(parsed.themeBgPanel, parsed.themeAccent ?? store.themeAccent);
      if (parsed.fontSize) store.setFontSize(parsed.fontSize);
    }
  } catch { /* ignore */ }
}

function saveTheme() {
  const { themeBgPanel, themeAccent, fontSize } = useAppStore.getState();
  localStorage.setItem(THEME_KEY, JSON.stringify({ themeBgPanel, themeAccent, fontSize }));
}

function applyThemeVars(bgPanel: string, accent: string, fontSize: number) {
  const root = document.documentElement;
  root.style.setProperty('--bg-panel', bgPanel);
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--bg-canvas', adjustColor(bgPanel, -0.15));
  root.style.setProperty('--bg-dark', adjustColor(bgPanel, -0.25));
  root.style.setProperty('--bg-terminal', adjustColor(bgPanel, -0.35));
  root.style.setProperty('--bg-raised', adjustColor(bgPanel, 0.1));
  root.style.setProperty('--bg-splitter', adjustColor(bgPanel, 0.03));
  root.style.setProperty('--bg-inspector', adjustColor(bgPanel, -0.08));
  root.style.setProperty('--border-color', adjustColor(bgPanel, -0.15));
  root.style.setProperty('--border-light', adjustColor(bgPanel, -0.05));
  root.style.setProperty('--accent-light', adjustColor(accent, 0.3));
  root.style.setProperty('--accent-lighter', adjustColor(accent, 0.45));
  root.style.setProperty('--accent-dark', adjustColor(accent, -0.15));
  root.style.setProperty('--app-font-size', `${fontSize}px`);
}

function adjustColor(hex: string, factor: number) {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xff) + Math.round(255 * factor)));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * factor)));
  const b = Math.max(0, Math.min(255, (num & 0xff) + Math.round(255 * factor)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function brightness(hex: string) {
  const num = parseInt(hex.slice(1), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function ThemeApplier({ children }: { children: React.ReactNode }) {
  const themeBgPanel = useAppStore((s) => s.themeBgPanel);
  const themeAccent = useAppStore((s) => s.themeAccent);
  const fontSize = useAppStore((s) => s.fontSize);

  // Load saved theme on mount
  useEffect(() => { loadSavedTheme(); }, []);

  // Apply vars and persist whenever settings change
  useEffect(() => {
    applyThemeVars(themeBgPanel, themeAccent, fontSize);
    saveTheme();
  }, [themeBgPanel, themeAccent, fontSize]);

  return <>{children}</>;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 24,
          color: '#f87171',
          background: '#1a0000',
          fontFamily: 'monospace',
          fontSize: 13,
          whiteSpace: 'pre-wrap',
          height: '100vh',
          overflow: 'auto',
        }}>
          <strong style={{ fontSize: 16 }}>Error al montar la aplicación:</strong>
          {'\n\n'}
          {this.state.error.message}
          {'\n\n'}
          {this.state.error.stack}
        </div>
      );
    }
    return this.props.children;
  }
}

function Root() {
  const [showSetup, setShowSetup] = useState(() => !localStorage.getItem('advance-studio-setup-done'));

  return (
    <React.StrictMode>
      <ErrorBoundary>
        <ThemeApplier>
          <Launcher />
        </ThemeApplier>
        {showSetup && <SetupCheckModal onClose={() => { localStorage.setItem('advance-studio-setup-done', '1'); setShowSetup(false); }} />}
      </ErrorBoundary>
    </React.StrictMode>
  );
}

const rootEl = document.getElementById('root');
if (!rootEl) {
  document.body.innerHTML = '<div style="color:red;padding:20px;font-family:monospace">ERROR: No se encontró el elemento #root</div>';
} else {
  ReactDOM.createRoot(rootEl).render(<Root />);
}
