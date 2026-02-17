import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="container-fluid py-5">
          <div className="card border-danger shadow-sm" style={{ maxWidth: 560 }}>
            <div className="card-body p-4">
              <h5 className="card-title text-danger d-flex align-items-center gap-2">
                <i className="ti ti-alert-triangle" />
                Something went wrong
              </h5>
              <p className="text-muted small mb-2">{this.state.error.message}</p>
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                onClick={() => this.setState({ hasError: false, error: null })}
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
