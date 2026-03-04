import React from 'react';
import styles from '@features/scraper/components/ScraperErrorBoundary.module.css';

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
                <div role="alert" className={styles.fallback}>
                    <p className={styles.title}>
                        Something went wrong in the Scraper section.
                    </p>
                    <p className={styles.message}>
                        {this.state.message}
                    </p>
                    <button
                        type="button"
                        className={styles.retryBtn}
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
