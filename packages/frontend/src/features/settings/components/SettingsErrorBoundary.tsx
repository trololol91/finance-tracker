import React from 'react';
import styles from '@features/settings/components/SettingsErrorBoundary.module.css';

interface SettingsErrorBoundaryState {
    hasError: boolean;
}

interface SettingsErrorBoundaryProps {
    children: React.ReactNode;
}

export class SettingsErrorBoundary extends React.Component<
    SettingsErrorBoundaryProps,
    SettingsErrorBoundaryState
> {
    constructor(props: SettingsErrorBoundaryProps) {
        super(props);
        this.state = {hasError: false};
    }

    public static getDerivedStateFromError(): SettingsErrorBoundaryState {
        return {hasError: true};
    }

    public componentDidCatch(error: Error, info: React.ErrorInfo): void {
        console.error('[Settings] ErrorBoundary', error, info);
    }

    public render(): React.ReactNode {
        if (this.state.hasError) {
            return (
                <div role="alert" className={styles.container}>
                    <p>Something went wrong in the Settings page.</p>
                    <button
                        type="button"
                        className={styles.retryBtn}
                        onClick={(): void => { this.setState({hasError: false}); }}
                    >
                        Try again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
