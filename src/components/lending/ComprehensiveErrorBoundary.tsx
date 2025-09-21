import React, { Component, ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Bug, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  children: ReactNode;
  fallback?: React.ComponentType<{ error: Error; errorInfo: any; retry: () => void }>;
  onError?: (error: Error, errorInfo: any) => void;
  level?: 'page' | 'component' | 'feature';
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: any;
  errorId?: string;
}

export class ComprehensiveErrorBoundary extends Component<Props, State> {
  private retryCount = 0;
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error caught by boundary:', error, errorInfo);
    
    this.setState({ error, errorInfo });
    
    // Report error to monitoring service
    this.reportError(error, errorInfo);
    
    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private reportError = (error: Error, errorInfo: any) => {
    // In production, send to error monitoring service
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorId: this.state.errorId,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      level: this.props.level || 'component'
    };
    
    console.warn('Error Report:', errorReport);
    
    // Example: Send to monitoring service
    // fetch('/api/errors', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(errorReport)
    // });
  };

  private handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      this.setState({ 
        hasError: false, 
        error: undefined, 
        errorInfo: undefined,
        errorId: undefined 
      });
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoBack = () => {
    window.history.back();
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent 
            error={this.state.error!} 
            errorInfo={this.state.errorInfo}
            retry={this.handleRetry}
          />
        );
      }

      const canRetry = this.retryCount < this.maxRetries;
      const isPageLevel = this.props.level === 'page';

      return (
        <Card className={`mx-auto mt-8 max-w-2xl bg-destructive/5 border-destructive/20 ${isPageLevel ? 'min-h-[400px]' : ''}`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                {isPageLevel ? 'Page Error' : 'Component Error'}
              </CardTitle>
              <Badge variant="secondary" className="font-mono text-xs">
                {this.state.errorId}
              </Badge>
            </div>
            <CardDescription>
              {isPageLevel 
                ? 'An error occurred while loading this page. Our team has been notified.'
                : 'This component encountered an error. You can try refreshing or continue using other features.'
              }
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Error Details */}
            {this.state.error && (
              <details className="group">
                <summary className="cursor-pointer flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                  <Bug className="h-4 w-4" />
                  Error Details
                  <span className="ml-auto group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="mt-2 p-3 rounded bg-muted border text-xs font-mono break-all">
                  <div className="text-destructive font-semibold mb-1">
                    {this.state.error.name}: {this.state.error.message}
                  </div>
                  {this.state.error.stack && (
                    <pre className="text-muted-foreground whitespace-pre-wrap text-xs">
                      {this.state.error.stack.slice(0, 500)}
                      {this.state.error.stack.length > 500 && '...'}
                    </pre>
                  )}
                </div>
              </details>
            )}

            {/* Retry Information */}
            {!canRetry && this.retryCount > 0 && (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded text-sm text-orange-800">
                Maximum retry attempts reached ({this.maxRetries}). Please try reloading the page.
              </div>
            )}

            {/* Action Buttons */}
            <div className={`flex gap-2 ${isPageLevel ? 'flex-col sm:flex-row' : 'flex-wrap'}`}>
              {canRetry && (
                <Button onClick={this.handleRetry} variant="default" className="flex-1">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again ({this.maxRetries - this.retryCount} left)
                </Button>
              )}
              
              <Button onClick={this.handleReload} variant="outline" className="flex-1">
                <RefreshCw className="h-4 w-4 mr-2" />
                Reload Page
              </Button>
              
              {isPageLevel && (
                <Button onClick={this.handleGoBack} variant="ghost" className="flex-1">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Go Back
                </Button>
              )}
            </div>

            {/* Help Text */}
            <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded">
              <p>
                If this problem persists, please contact support with error ID: 
                <span className="font-mono ml-1 font-semibold">{this.state.errorId}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

// HOC for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  options?: Omit<Props, 'children'>
) {
  return function WithErrorBoundaryComponent(props: P) {
    return (
      <ComprehensiveErrorBoundary {...options}>
        <Component {...props} />
      </ComprehensiveErrorBoundary>
    );
  };
}

// Hook for error reporting in functional components
export function useErrorHandler() {
  return (error: Error, errorInfo?: any) => {
    console.error('Manual error report:', error, errorInfo);
    
    // In production, send to monitoring service
    const errorReport = {
      message: error.message,
      stack: error.stack,
      errorInfo,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      source: 'manual'
    };
    
    // Example: Send to monitoring service
    // fetch('/api/errors', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(errorReport)
    // });
  };
}