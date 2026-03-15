import React from 'react';
import {Outlet} from 'react-router-dom';
import {Sidebar} from '@components/layout/Sidebar/Sidebar.js';
import styles from '@components/layout/AppShell/AppShell.module.css';

export const AppShell = (): React.JSX.Element => {
    return (
        <div className={styles.shell}>
            <Sidebar />
            <main className={styles.main}>
                <Outlet />
            </main>
        </div>
    );
};
