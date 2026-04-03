import React, {
    useState,
    useRef,
    useCallback
} from 'react';
import {ProfileForm} from '@features/settings/components/ProfileForm.js';
import {NotificationsForm} from '@features/settings/components/NotificationsForm.js';
import {ApiTokens} from '@features/settings/components/ApiTokens.js';
import {SettingsErrorBoundary} from '@features/settings/components/SettingsErrorBoundary.js';
import type {SettingsTab} from '@features/settings/types/settings.types.js';
import styles from '@features/settings/pages/SettingsPage.module.css';

interface TabDef {
    id: SettingsTab;
    label: string;
}

const TABS: TabDef[] = [
    {id: 'profile', label: 'Profile'},
    {id: 'notifications', label: 'Notifications'},
    {id: 'api-tokens', label: 'API Tokens'}
];

export const SettingsPage = (): React.JSX.Element => {
    const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
    const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

    const handleTabKeyDown = useCallback((
        e: React.KeyboardEvent<HTMLButtonElement>,
        currentIndex: number
    ): void => {
        let nextIndex: number | null = null;

        if (e.key === 'ArrowRight') {
            nextIndex = (currentIndex + 1) % TABS.length;
        } else if (e.key === 'ArrowLeft') {
            nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
        } else if (e.key === 'Home') {
            nextIndex = 0;
        } else if (e.key === 'End') {
            nextIndex = TABS.length - 1;
        }

        if (nextIndex !== null) {
            e.preventDefault();
            setActiveTab(TABS[nextIndex].id);
            tabRefs.current[nextIndex]?.focus();
        }
    }, []);

    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <h1 className={styles.title}>Settings</h1>
            </header>

            <div className={styles.layout}>
                <nav className={styles.tabNav} aria-label="Settings sections">
                    <ul className={styles.tabList} role="tablist">
                        {TABS.map((tab, index) => (
                            <li key={tab.id} role="presentation">
                                <button
                                    ref={(el): void => { tabRefs.current[index] = el; }}
                                    id={`tab-${tab.id}`}
                                    role="tab"
                                    aria-selected={activeTab === tab.id}
                                    aria-controls={`panel-${tab.id}`}
                                    tabIndex={activeTab === tab.id ? 0 : -1}
                                    className={`${styles.tabButton} ${activeTab === tab.id ? styles.tabButtonActive : ''}`}
                                    onClick={(): void => { setActiveTab(tab.id); }}
                                    onKeyDown={(e): void => { handleTabKeyDown(e, index); }}
                                >
                                    {tab.label}
                                </button>
                            </li>
                        ))}
                    </ul>
                </nav>

                <div className={styles.content}>
                    <div
                        id="panel-profile"
                        role="tabpanel"
                        aria-labelledby="tab-profile"
                        hidden={activeTab !== 'profile'}
                    >
                        {activeTab === 'profile' && (
                            <SettingsErrorBoundary>
                                <ProfileForm />
                            </SettingsErrorBoundary>
                        )}
                    </div>

                    <div
                        id="panel-notifications"
                        role="tabpanel"
                        aria-labelledby="tab-notifications"
                        hidden={activeTab !== 'notifications'}
                    >
                        {activeTab === 'notifications' && (
                            <SettingsErrorBoundary>
                                <NotificationsForm />
                            </SettingsErrorBoundary>
                        )}
                    </div>

                    <div
                        id="panel-api-tokens"
                        role="tabpanel"
                        aria-labelledby="tab-api-tokens"
                        hidden={activeTab !== 'api-tokens'}
                    >
                        {activeTab === 'api-tokens' && (
                            <SettingsErrorBoundary>
                                <ApiTokens />
                            </SettingsErrorBoundary>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
};
