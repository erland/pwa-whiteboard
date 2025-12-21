import React from 'react';

type Props = {
  children: React.ReactNode;
  fallbackTitle?: string;
};

type State = {
  hasError: boolean;
  error?: unknown;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // Keep logs in dev; in production you might report to Sentry etc.
    console.error('ErrorBoundary caught error', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const title = this.props.fallbackTitle ?? 'Something went wrong';
    const msg =
      this.state.error instanceof Error
        ? this.state.error.message
        : typeof this.state.error === 'string'
          ? this.state.error
          : '';

    return (
      <div style={{ padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>{title}</h2>
        {msg ? <pre style={{ whiteSpace: 'pre-wrap' }}>{msg}</pre> : null}
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid #334155',
            background: '#0f172a',
            color: '#e5e7eb',
            cursor: 'pointer',
          }}
        >
          Reload
        </button>
      </div>
    );
  }
}
