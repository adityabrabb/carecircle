'use client';

/**
 * Main navigation.
 *
 * Purpose: the navigation panel: one large button per section, each
 * with an icon, a label and a short hint. The current section is
 * marked for screen readers and drawn in a solid colour, so nobody has
 * to guess where they are.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavIcon, NavItem } from '@/constants/navigation';

/** Purpose: simple line drawings, one per section, 24 by 24. */
const ICON_PATHS: Record<NavIcon, string> = {
   today:
      'M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4' +
      'M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z',
   overview: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
   medicines:
      'M10.5 3.5a5 5 0 0 1 7 7l-7 7a5 5 0 0 1-7-7zM7 10l7 7',
   appointments:
      'M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 ' +
      '1-1zM4 10h16M8 3v5M16 3v5',
   health:
      'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z' +
      'M7 12h3l1.5-2.5L13 14l1.5-2H17',
   records:
      'M6 3h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v4h4' +
      'M8 12h8M8 16h6',
   circle:
      'M9 11a3 3 0 1 0 0-6a3 3 0 1 0 0 6zM3 20a6 6 0 0 1 12 0M16 11a2.5 2.5 ' +
      '0 1 0 0-5M17 14a5 5 0 0 1 4 5',
   ask:
      'M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 4v-4H5a1 1 0 0 1-1-1V6a1 ' +
      '1 0 0 1 1-1zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.4M12 14.5v.01',
   settings:
      'M4 7h9M17 7h3M15 5v4M4 12h3M11 12h9M9 10v4M4 17h11M19 17h1M17 15v4',
};

/** Purpose: draw one section icon. */
export function NavGlyph({ icon }: { icon: NavIcon }) {
   return (
      <svg
         className="nav-icon"
         width="28"
         height="28"
         viewBox="0 0 24 24"
         fill="none"
         stroke="currentColor"
         strokeWidth="2"
         strokeLinecap="round"
         strokeLinejoin="round"
         aria-hidden="true"
         focusable="false"
      >
         <path d={ICON_PATHS[icon]} />
      </svg>
   );
}

/** Purpose: true when the path is this section or a page inside it. */
function isCurrent(pathname: string, href: string): boolean {
   return pathname === href || pathname.startsWith(`${href}/`);
}

export function MainNav({ items }: { items: readonly NavItem[] }) {
   const pathname = usePathname() ?? '';
   return (
      <nav className="nav" aria-label="Main">
         <p className="nav-title">Go to</p>
         <ul>
            {items.map((item) => (
               <li key={item.href}>
                  <Link
                     href={item.href}
                     aria-current={
                        isCurrent(pathname, item.href) ? 'page' : undefined
                     }
                  >
                     <NavGlyph icon={item.icon} />
                     <span className="nav-text">
                        <span className="nav-label">{item.label}</span>
                        <span className="nav-hint">{item.hint}</span>
                     </span>
                  </Link>
               </li>
            ))}
         </ul>
      </nav>
   );
}
