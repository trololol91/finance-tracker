import React from 'react';
import {
    NavLink,
    Link
} from 'react-router-dom';
import {LogOut} from 'lucide-react';
import {useAuth} from '@features/auth/hooks/useAuth.js';
import {
    NAV_ITEMS,
    SETTINGS_NAV_ITEMS
} from '@config/navConfig.js';
import {
    APP_NAME,
    APP_ROUTES
} from '@config/constants.js';
import styles from '@components/layout/Sidebar/Sidebar.module.css';

const getLinkClassName = ({isActive}: {isActive: boolean}): string =>
    isActive
        ? `${styles.navLink} ${styles.navLinkActive}`
        : styles.navLink;

export const Sidebar = (): React.JSX.Element => {
    const {user, logout} = useAuth();

    const visibleSettingsItems = SETTINGS_NAV_ITEMS.filter(
        (item) => item.adminOnly !== true || user?.role === 'ADMIN'
    );

    const displayName =
        user !== null
            ? `${user.firstName} ${user.lastName}`.trim() || user.email
            : '';

    return (
        <aside className={styles.sidebar} aria-label="Main navigation">
            <Link to={APP_ROUTES.DASHBOARD} className={styles.logo}>
                {APP_NAME}
            </Link>

            <nav className={styles.nav} aria-label="Primary navigation">
                <ul className={styles.navList} role="list">
                    {NAV_ITEMS.map((item) => {
                        const Icon = item.icon;
                        return (
                            <li key={item.to}>
                                <NavLink
                                    to={item.to}
                                    className={getLinkClassName}
                                    aria-current={undefined}
                                >
                                    <Icon
                                        className={styles.navIcon}
                                        aria-hidden="true"
                                        size={16}
                                    />
                                    {item.label}
                                </NavLink>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            {visibleSettingsItems.length > 0 && (
                <section
                    className={styles.settingsSection}
                    aria-label="Settings navigation"
                >
                    <div className={styles.divider} aria-hidden="true" />
                    <p className={styles.sectionLabel}>Settings</p>
                    <ul className={styles.navList} role="list">
                        {visibleSettingsItems.map((item) => {
                            const Icon = item.icon;
                            return (
                                <li key={item.to}>
                                    <NavLink
                                        to={item.to}
                                        className={getLinkClassName}
                                        aria-current={undefined}
                                    >
                                        <Icon
                                            className={styles.navIcon}
                                            aria-hidden="true"
                                            size={16}
                                        />
                                        {item.label}
                                    </NavLink>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            )}

            <footer className={styles.footer}>
                {user !== null && (
                    <div aria-label={`Signed in as ${user.email}`}>
                        <p className={styles.userName}>{displayName}</p>
                        <p className={styles.userEmail}>{user.email}</p>
                    </div>
                )}
                <button
                    type="button"
                    className={styles.logoutBtn}
                    onClick={logout}
                    aria-label="Log out"
                >
                    <LogOut size={14} aria-hidden="true" />
                    Log out
                </button>
            </footer>
        </aside>
    );
};
