import type {LucideIcon} from 'lucide-react';
import {
    LayoutDashboard,
    ArrowLeftRight,
    Wallet,
    Tag,
    RefreshCw,
    Settings,
    ShieldCheck
} from 'lucide-react';
import {APP_ROUTES} from '@config/constants';

export interface NavItem {
    label: string;
    to: string;
    icon: LucideIcon;
    adminOnly?: true;
}

export const NAV_ITEMS: NavItem[] = [
    {
        label: 'Dashboard',
        to: APP_ROUTES.DASHBOARD,
        icon: LayoutDashboard
    },
    {
        label: 'Transactions',
        to: APP_ROUTES.TRANSACTIONS,
        icon: ArrowLeftRight
    },
    {
        label: 'Accounts',
        to: APP_ROUTES.ACCOUNTS,
        icon: Wallet
    },
    {
        label: 'Categories',
        to: APP_ROUTES.CATEGORIES,
        icon: Tag
    },
    {
        label: 'Scraper / Sync',
        to: APP_ROUTES.SCRAPER,
        icon: RefreshCw
    }
];

export const SETTINGS_NAV_ITEMS: NavItem[] = [
    {
        label: 'Settings',
        to: APP_ROUTES.SETTINGS,
        icon: Settings
    },
    {
        label: 'Admin',
        to: APP_ROUTES.ADMIN,
        icon: ShieldCheck,
        adminOnly: true
    }
];
