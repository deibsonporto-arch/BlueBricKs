import { Component } from 'react';
import type { ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  handleReset = () => {
    localStorage.clear();
    window.location.href = '/obras';
  };

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            height: '100vh',
            padding: 24,
            textAlign: 'center',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h1 style={{ margin: 0, fontSize: 20 }}>Algo deu errado ao carregar o BRICS</h1>
          <p style={{ margin: 0, maxWidth: 480, color: '#64748b' }}>
            Isso geralmente acontece quando dados salvos localmente em uma versão anterior do app
            ficam incompatíveis com a versão atual. Clique no botão abaixo para limpar os dados locais
            e recarregar com dados de exemplo novos.
          </p>
          <pre style={{ fontSize: 12, color: '#94a3b8', maxWidth: 480, whiteSpace: 'pre-wrap' }}>
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={this.handleReset}
            style={{
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Limpar dados locais e recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
