import React from 'react';

interface State {
    hasError: boolean;
    message: string;
}

interface Props {
    children: React.ReactNode;
}

export class AccountsErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {hasError: false, message: ''};
    }

    public static getDerivedStateFromError(error: unknown): State {
        const message = error instanceof Error ? error.message : 'An unexpected error occurred';
        return {hasError: true, message};
    }

    public override componentDidCatch(error: unknown, info: React.ErrorInfo): void {
        console.error('[Accounts] ErrorBoundary', error, info);
    }

    public override render(): React.ReactNode {
        if (this.state.hasError) {
            return (
                <div role="alert" style={{padding: '2rem', textAlign: 'center'}}>
                    <h2 style={{color: 'var(--color-danger)'}}>Something went wrong</h2>
                    <p style={{color: 'var(--color-text-secondary)', marginTop: '0.5rem'}}>
                        {this.state.message}
                    </p>
                    <button
                        type="button"
                        onClick={(): void => { this.setState({hasError: false, message: ''}); }}
                        style={{
                            marginTop: '1rem',
                            padding: '0.5rem 1rem',
                            background: 'var(--color-primary)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer'
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
