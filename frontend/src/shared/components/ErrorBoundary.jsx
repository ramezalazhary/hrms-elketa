import { Component } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

/**
 * React Error Boundary — catches unhandled render-time exceptions and
 * displays a branded fallback instead of a white screen.
 *
 * Wrap this around route outlets or page-level sections:
 *   <ErrorBoundary> <Outlet /> </ErrorBoundary>
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Allow a custom fallback via props
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isDev = import.meta.env.DEV;

      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 mb-5 shadow-sm">
            <AlertTriangle className="h-8 w-8" />
          </div>

          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Something went wrong
          </h2>
          <p className="max-w-md text-sm text-slate-500 mb-6">
            An unexpected error occurred while rendering this page. You can try
            refreshing or going back to the home page.
          </p>

          {isDev && this.state.error && (
            <details className="mb-6 w-full max-w-lg rounded-xl border border-rose-200 bg-rose-50 p-4 text-left">
              <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-rose-700 mb-2">
                Error Details (Development Only)
              </summary>
              <pre className="overflow-auto text-xs text-rose-800 whitespace-pre-wrap">
                {this.state.error.toString()}
                {"\n"}
                {this.state.error.stack}
              </pre>
            </details>
          )}

          <div className="flex gap-3">
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <RotateCcw className="h-4 w-4" /> Try Again
            </button>
            <a
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-600/25 transition hover:shadow-xl"
            >
              <Home className="h-4 w-4" /> Home
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
