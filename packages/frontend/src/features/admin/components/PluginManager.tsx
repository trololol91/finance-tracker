import React, {
    useRef,
    useState
} from 'react';
import {
    useScraperAdminControllerReload,
    useScraperAdminControllerInstall
} from '@/api/admin/admin.js';
import styles from '@features/admin/components/PluginManager.module.css';

interface Feedback {
    type: 'success' | 'error';
    message: string;
}

export const PluginManager = (): React.JSX.Element => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [reloadFeedback, setReloadFeedback] = useState<Feedback | null>(null);
    const [installFeedback, setInstallFeedback] = useState<Feedback | null>(null);

    const reloadMutation = useScraperAdminControllerReload({
        mutation: {
            onSuccess: (data) => {
                setReloadFeedback({
                    type: 'success',
                    message: data.message || 'Plugins reloaded successfully'
                });
            },
            onError: () => {
                setReloadFeedback({type: 'error', message: 'Failed to reload plugins'});
                console.error('[Admin] PluginManager: reload plugins failed');
            }
        }
    });

    const installMutation = useScraperAdminControllerInstall({
        mutation: {
            onSuccess: (data) => {
                setInstallFeedback({
                    type: 'success',
                    message: data.message || `Plugin installed: ${data.bankId}`
                });
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            },
            onError: () => {
                setInstallFeedback({type: 'error', message: 'Failed to install plugin'});
                console.error('[Admin] PluginManager: install plugin failed');
            }
        }
    });

    const handleReload = (): void => {
        setReloadFeedback(null);
        reloadMutation.mutate();
    };

    const handleInstall = (): void => {
        const file = fileInputRef.current?.files?.[0];
        if (!file) {
            setInstallFeedback({type: 'error', message: 'Please select a .zip plugin file'});
            return;
        }
        setInstallFeedback(null);
        installMutation.mutate({data: {file}});
    };

    return (
        <div className={styles.container}>
            <section className={styles.section} aria-label="Reload plugins">
                <p className={styles.sectionTitle}>Reload Plugins</p>
                <div className={styles.row}>
                    <button
                        type="button"
                        className={styles.btn}
                        disabled={reloadMutation.isPending}
                        onClick={handleReload}
                        aria-busy={reloadMutation.isPending}
                    >
                        {reloadMutation.isPending ? 'Reloading…' : 'Reload Plugins'}
                    </button>
                </div>
                {reloadFeedback !== null && (
                    <p
                        aria-live="polite"
                        className={`${styles.feedback} ${
                            reloadFeedback.type === 'success'
                                ? styles.feedbackSuccess
                                : styles.feedbackError
                        }`}
                    >
                        {reloadFeedback.message}
                    </p>
                )}
            </section>

            <section className={styles.section} aria-label="Install plugin">
                <p className={styles.sectionTitle}>Install Plugin</p>
                <div className={styles.row}>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".zip"
                        id="plugin-file-input"
                        className={styles.fileInput}
                        aria-label="Select a .zip plugin file to install"
                    />
                    <button
                        type="button"
                        className={styles.btn}
                        disabled={installMutation.isPending}
                        onClick={handleInstall}
                        aria-busy={installMutation.isPending}
                    >
                        {installMutation.isPending ? 'Installing…' : 'Install Plugin'}
                    </button>
                </div>
                {installFeedback !== null && (
                    <p
                        aria-live="polite"
                        className={`${styles.feedback} ${
                            installFeedback.type === 'success'
                                ? styles.feedbackSuccess
                                : styles.feedbackError
                        }`}
                    >
                        {installFeedback.message}
                    </p>
                )}
            </section>
        </div>
    );
};
