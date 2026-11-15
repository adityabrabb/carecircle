/**
 * Navigation.
 *
 * Purpose: the main sections of the app, in the order they appear in
 * the navigation panel, each with an icon name and a one-line hint so
 * a first-time visitor knows what is behind it.
 */

export type NavIcon =
   | 'today'
   | 'overview'
   | 'medicines'
   | 'appointments'
   | 'health'
   | 'records'
   | 'circle'
   | 'ask'
   | 'settings';

export interface NavItem {
   href: string;
   label: string;
   hint: string;
   icon: NavIcon;
}

export const NAV_ITEMS: readonly NavItem[] = [
   { href: '/home', label: 'Today', hint: 'Doses due now', icon: 'today' },
   {
      href: '/overview',
      label: 'Overview',
      hint: 'Key numbers, timeline',
      icon: 'overview',
   },
   {
      href: '/medicines',
      label: 'Medicines',
      hint: 'Pills, refills, scan',
      icon: 'medicines',
   },
   {
      href: '/appointments',
      label: 'Appointments',
      hint: 'Doctor visits',
      icon: 'appointments',
   },
   {
      href: '/health',
      label: 'Health',
      hint: 'Readings and mood',
      icon: 'health',
   },
   {
      href: '/records',
      label: 'Records',
      hint: 'Reports and papers',
      icon: 'records',
   },
   {
      href: '/circle',
      label: 'Circle',
      hint: 'Family and caretaker',
      icon: 'circle',
   },
   { href: '/ask', label: 'Ask', hint: 'Ask the record', icon: 'ask' },
   {
      href: '/settings',
      label: 'Settings',
      hint: 'Sharing and routine',
      icon: 'settings',
   },
];
