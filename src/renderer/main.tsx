import React from 'react';
import ReactDOM from 'react-dom/client';
import { Launcher } from './screens/Launcher';
import './index.css';

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

const rootEl = document.getElementById('root');
if (!rootEl) {
  document.body.innerHTML = '<div style="color:red;padding:20px;font-family:monospace">ERROR: No se encontró el elemento #root</div>';
} else {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <ErrorBoundary>
        <Launcher />
      </ErrorBoundary>
    </React.StrictMode>
  );
}
