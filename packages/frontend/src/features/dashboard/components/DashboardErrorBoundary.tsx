import React from 'react';
import styles from '@features/dashboard/components/DashboardErrorBoundary.module.css';

interface State {
    hasError: boolean;
    message: string;
}

interface Props {
    children: React.ReactNode;
}

export class DashboardErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {hasError: false, message: ''};
    }

    public static getDerivedStateFromError(error: unknown): State {
        const message = error instanceof Error ? error.message : 'An unexpected error occurred';
        return {hasError: true, message};
    }

    public override componentDidCatch(error: unknown, info: React.ErrorInfo): void {
        console.error('[Dashboard] ErrorBoundary', error, info);
    }

    public override render(): React.ReactNode {
        if (this.state.hasError) {
            return (
                <div role="alert" className={styles.container}>
                    <h2 className={styles.heading}>Something went wrong</h2>
                    <p className={styles.message}>{this.state.message}</p>
                    <button
                        type="button"
                        className={styles.retryBtn}
                        onClick={(): void => {
                            this.setState({hasError: false, message: ''});
                        }}
                    >
                        Try again
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
