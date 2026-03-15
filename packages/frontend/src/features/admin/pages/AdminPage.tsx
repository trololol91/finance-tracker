import React from 'react';
import {AdminErrorBoundary} from '@features/admin/components/AdminErrorBoundary.js';
import {UserRoleTable} from '@features/admin/components/UserRoleTable.js';
import {PluginManager} from '@features/admin/components/PluginManager.js';
import styles from '@features/admin/pages/AdminPage.module.css';

const AdminPage = (): React.JSX.Element => {
    return (
        <main className={styles.page}>
            <header className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Admin</h1>
            </header>

            <AdminErrorBoundary>
                <section className={styles.section} aria-labelledby="user-management-heading">
                    <h2 id="user-management-heading" className={styles.sectionHeading}>
                        User Management
                    </h2>
                    <UserRoleTable />
                </section>

                <section className={styles.section} aria-labelledby="plugin-management-heading">
                    <h2 id="plugin-management-heading" className={styles.sectionHeading}>
                        Plugin Management
                    </h2>
                    <PluginManager />
                </section>
            </AdminErrorBoundary>
        </main>
    );
};

export default AdminPage;
