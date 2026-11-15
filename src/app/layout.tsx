/**
 * Root layout.
 *
 * Purpose: the frame around every page: skip link, top bar with the
 * signed-in member, main navigation, and the text-size preference.
 */
import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { setTextSize, signOut } from '@/app/actions/auth';
import { Logo } from '@/components/Logo';
import { NAV_ITEMS } from '@/constants/navigation';
import { t } from '@/i18n/strings';
import { getContext } from '@/services/session';
import './globals.css';

export const metadata: Metadata = {
   title: {
      default: 'CareCircle',
      template: '%s | CareCircle',
   },
   description:
      'Elder-owned care: medicines, appointments, health and a family ' +
      'circle that helps without taking over.',
   manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
   width: 'device-width',
   initialScale: 1,
   themeColor: '#14532d',
};

const TEXT_SIZE_COOKIE = 'cc_text';

export default async function RootLayout({
   children,
}: {
   children: ReactNode;
}) {
   const context = await getContext();
   const jar = await cookies();
   const large = jar.get(TEXT_SIZE_COOKIE)?.value === 'large';
   const language = context?.profile.language ?? 'en';

   return (
      <html lang={language} className={large ? 'text-large' : undefined}>
         <body>
            <a className="skip-link" href="#main">
               Skip to main content
            </a>
            <header className="topbar">
               <div className="topbar-inner">
                  <Link className="brand" href={context ? '/home' : '/'}>
                     <Logo />
                     CareCircle
                  </Link>
                  <form action={setTextSize}>
                     <input
                        type="hidden"
                        name="size"
                        value={large ? 'normal' : 'large'}
                     />
                     <button className="btn quiet small-btn" type="submit">
                        {t(language, large ? 'normalText' : 'largerText')}
                     </button>
                  </form>
                  {context ? (
                     <div className="topbar-who row">
                        <span>
                           {context.member.name} ({context.member.role})
                           <br />
                           Caring for {context.profile.elderName}
                        </span>
                        <form action={signOut}>
                           <button
                              className="btn quiet small-btn"
                              type="submit"
                           >
                              Sign out
                           </button>
                        </form>
                     </div>
                  ) : null}
               </div>
            </header>
            {context ? (
               <nav className="nav" aria-label="Main">
                  <ul>
                     {NAV_ITEMS.map((item) => (
                        <li key={item.href}>
                           <Link href={item.href}>{item.label}</Link>
                        </li>
                     ))}
                  </ul>
               </nav>
            ) : null}
            <main id="main" tabIndex={-1}>
               {children}
            </main>
            <footer className="footer">
               CareCircle helps you keep track. It does not give medical
               advice. Always follow your doctor.
            </footer>
         </body>
      </html>
   );
}
