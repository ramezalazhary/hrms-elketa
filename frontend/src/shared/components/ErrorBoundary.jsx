import React from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

/**
 * Error Boundary component to catch and display errors gracefully
 * Provides a user-friendly fallback UI with options to retry or navigate home
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(err, errorInfo) {
    this.setState({
      error: err,
      errorInfo,
    });

    // Log error to monitoring service in production
    console.error("Error Boundary caught an error:", err, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-zinc-200 p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>

            <h1 className="text-lg font-semibold text-zinc-900 text-center mb-2">
              Something went wrong
            </h1>

            <p className="text-sm text-zinc-600 text-center mb-6">
              We&apos;re sorry, but something unexpected happened.
              {import.meta.env.DEV && (
                <details className="mt-2 text-left">
                  <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-700">
                    Technical details
                  </summary>
                  <pre className="mt-2 p-2 bg-zinc-100 rounded text-xs overflow-auto">
                    {this.state.error?.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
            </p>

            <div className="flex gap-3">
              <button
                onClick={this.handleRetry}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>

              <button
                onClick={() => (window.location.href = "/")}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-zinc-100 text-zinc-700 text-sm font-medium rounded-md hover:bg-zinc-200 transition-colors"
              >
                <Home className="w-4 h-4" />
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export { ErrorBoundary };

/**
 * Page-level error boundary for specific routes
 */
export function PageErrorBoundary({ children }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
