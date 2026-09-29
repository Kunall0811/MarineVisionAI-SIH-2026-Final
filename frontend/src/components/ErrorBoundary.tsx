import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
          <div className="max-w-2xl w-full bg-slate-900 border border-red-500/30 rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚠️</span>
              <div>
                <h1 className="text-xl font-bold text-red-400">Application Error Detected</h1>
                <p className="text-xs text-slate-400">A component crashed while rendering.</p>
              </div>
            </div>

            <div className="bg-black/60 rounded-lg p-4 font-mono text-xs text-red-300 border border-white/5 overflow-auto max-h-60">
              <div className="font-bold text-sm text-red-200 mb-2">
                {this.state.error?.name}: {this.state.error?.message}
              </div>
              <pre className="whitespace-pre-wrap text-[11px] text-slate-400">
                {this.state.error?.stack}
              </pre>
            </div>

            {this.state.errorInfo?.componentStack && (
              <details className="text-xs text-slate-400">
                <summary className="cursor-pointer text-cyan-400 hover:underline">Component Stack Trace</summary>
                <pre className="mt-2 bg-black/40 p-3 rounded text-[10px] overflow-auto max-h-40">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null, errorInfo: null });
                  window.location.href = '/';
                }}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-medium text-xs transition"
              >
                Go to Dashboard
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-slate-200 rounded font-medium text-xs transition"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
