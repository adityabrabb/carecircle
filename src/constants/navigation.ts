/**
 * Navigation.
 *
 * Purpose: the main sections of the app, in the order they appear in
 * the navigation bar.
 */

export interface NavItem {
   href: string;
   label: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
   { href: '/home', label: 'Today' },
   { href: '/overview', label: 'Overview' },
   { href: '/medicines', label: 'Medicines' },
   { href: '/appointments', label: 'Appointments' },
   { href: '/health', label: 'Health' },
   { href: '/records', label: 'Records' },
   { href: '/circle', label: 'Circle' },
   { href: '/settings', label: 'Settings' },
];
