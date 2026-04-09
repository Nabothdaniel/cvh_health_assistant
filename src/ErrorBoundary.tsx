import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = "An unexpected error occurred.";
      
      // Check if it's our structured Firestore error
      try {
        if (this.state.error?.message.includes('operationType')) {
          const errInfo = JSON.parse(this.state.error.message);
          if (errInfo.error.includes('Missing or insufficient permissions')) {
            errorMessage = "You do not have permission to perform this action. Please check your access rights.";
          } else {
            errorMessage = `Database error: ${errInfo.error}`;
          }
        } else if (this.state.error?.message) {
          errorMessage = this.state.error.message;
        }
      } catch (e) {
        // Fallback to default message
      }

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 max-w-md w-full text-center space-y-6">
            <div className="bg-red-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Something went wrong</h1>
              <p className="text-slate-500 mt-2">{errorMessage}</p>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
