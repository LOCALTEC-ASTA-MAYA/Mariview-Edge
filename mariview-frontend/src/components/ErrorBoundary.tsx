import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, Home } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
        this.setState({ errorInfo });
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex items-center justify-center min-h-screen bg-[#0a0e1a] p-4">
                    <Card className="max-w-md w-full p-6 bg-card border-border shadow-xl">
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center animate-pulse">
                                <AlertTriangle className="w-8 h-8 text-red-500" />
                            </div>

                            <h1 className="text-xl font-bold">Something went wrong</h1>

                            <div className="w-full bg-muted/50 p-4 rounded-lg text-left overflow-auto max-h-48 text-xs font-mono">
                                <p className="text-red-400 font-bold mb-2">Error: {this.state.error?.message || 'Unknown error'}</p>
                                {this.state.errorInfo && (
                                    <pre className="text-muted-foreground whitespace-pre-wrap break-all">
                                        {this.state.errorInfo.componentStack}
                                    </pre>
                                )}
                            </div>

                            <div className="flex gap-3 w-full pt-2">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => window.location.href = '/'}
                                >
                                    <Home className="w-4 h-4 mr-2" />
                                    Go Home
                                </Button>
                                <Button
                                    className="flex-1 bg-[#21A68D] hover:bg-[#1a8a72]"
                                    onClick={this.handleReset}
                                >
                                    Try Again
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
