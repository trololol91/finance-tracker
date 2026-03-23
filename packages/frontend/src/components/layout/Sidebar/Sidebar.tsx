import React, {
    useState, useCallback, useEffect
} from 'react';
import {
    NavLink,
    Link,
    useLocation
} from 'react-router-dom';
import {
    LogOut, Menu, X
} from 'lucide-react';
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
    const location = useLocation();

    // Track which path the drawer was opened on — auto-closes on navigation
    const [openedAtPath, setOpenedAtPath] = useState<string | null>(null);
    const isOpen = openedAtPath !== null && openedAtPath === location.pathname;

    const close = useCallback(() => { setOpenedAtPath(null); }, []);
    const toggle = useCallback(() => {
        setOpenedAtPath((p) => (p === null ? location.pathname : null));
    }, [location.pathname]);

    // Lock body scroll while drawer is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        }
        return (): void => { document.body.style.overflow = ''; };
    }, [isOpen]);

    const visibleSettingsItems = SETTINGS_NAV_ITEMS.filter(
        (item) => item.adminOnly !== true || user?.role === 'ADMIN'
    );

    const displayName =
        user !== null
            ? `${user.firstName} ${user.lastName}`.trim() || user.email
            : '';

    return (
        <>
            <div className={styles.mobileBar}>
                <Link
                    to={APP_ROUTES.DASHBOARD}
                    className={styles.mobileLogo}
                    onClick={close}
                >
                    {APP_NAME}
                </Link>
                <button
                    type="button"
                    className={styles.hamburger}
                    onClick={toggle}
                    aria-label={isOpen ? 'Close menu' : 'Open menu'}
                    aria-expanded={isOpen}
                    aria-controls="main-sidebar"
                >
                    {isOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
                </button>
            </div>

            {isOpen && (
                <div
                    className={styles.overlay}
                    onClick={close}
                    aria-hidden="true"
                />
            )}

            <aside
                id="main-sidebar"
                className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''}`}
                aria-label="Main navigation"
            >
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
                                        onClick={close}
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
                                            onClick={close}
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
        </>
    );
};
