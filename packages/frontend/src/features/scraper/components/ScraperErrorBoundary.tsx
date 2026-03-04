import React from 'react';

interface ScraperErrorBoundaryState {
    hasError: boolean;
    message: string;
}

interface ScraperErrorBoundaryProps {
    children: React.ReactNode;
}

export class ScraperErrorBoundary extends React.Component<
    ScraperErrorBoundaryProps,
    ScraperErrorBoundaryState
> {
    constructor(props: ScraperErrorBoundaryProps) {
        super(props);
        this.state = {hasError: false, message: ''};
    }

    public static getDerivedStateFromError(error: unknown): ScraperErrorBoundaryState {
        return {
            hasError: true,
            message: (error as {message?: string}).message ?? 'An unexpected error occurred'
        };
    }

    public componentDidCatch(error: unknown, info: React.ErrorInfo): void {
        console.error('[Scraper] ErrorBoundary', error, info);
    }

    public render(): React.ReactNode {
        if (this.state.hasError) {
            return (
                <div role="alert" style={{padding: '2rem', textAlign: 'center'}}>
                    <p style={{color: 'var(--color-danger)', marginBottom: '0.5rem', fontWeight: 600}}>
                        Something went wrong in the Scraper section.
                    </p>
                    <p style={{color: 'var(--color-text-secondary)', fontSize: '0.875rem'}}>
                        {this.state.message}
                    </p>
                    <button
                        type="button"
                        style={{
                            marginTop: '1rem',
                            padding: '0.5rem 1rem',
                            background: 'var(--color-primary)',
                            color: 'var(--color-text-inverse)',
                            border: 'none',
                            borderRadius: '0.375rem',
                            cursor: 'pointer'
                        }}
                        onClick={() => { this.setState({hasError: false, message: ''}); }}
                    >
                        Retry
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
