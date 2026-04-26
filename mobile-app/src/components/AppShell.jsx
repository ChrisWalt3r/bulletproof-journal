import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  IoBarChartOutline,
  IoBookOutline,
  IoCalendarOutline,
  IoHomeOutline,
  IoImagesOutline,
  IoListOutline,
  IoMenu,
  IoSettingsOutline,
} from 'react-icons/io5';
import { useAccount } from '../context/AccountContext.jsx';
import { APP_NAME } from '../config/env.js';

const navItems = [
  {
    label: 'Home',
    to: '/home',
    icon: IoHomeOutline,
    match: (pathname) => pathname.startsWith('/home'),
  },
  {
    label: 'Criteria',
    to: '/criteria',
    icon: IoListOutline,
    match: (pathname) => pathname.startsWith('/criteria'),
  },
  {
    label: 'Journal',
    to: '/journal',
    icon: IoBookOutline,
    match: (pathname) => pathname.startsWith('/journal'),
  },
  {
    label: 'Calendar',
    to: '/calendar',
    icon: IoCalendarOutline,
    match: (pathname) => pathname.startsWith('/calendar'),
  },
  {
    label: 'Evaluation Review',
    to: '/execution-review',
    icon: IoImagesOutline,
    match: (pathname) => pathname.startsWith('/execution-review'),
  },
  {
    label: 'Equity Curve',
    to: '/account-growth',
    icon: IoBarChartOutline,
    match: (pathname) => pathname.startsWith('/account-growth'),
  },
  {
    label: 'Settings',
    to: '/settings',
    icon: IoSettingsOutline,
    match: (pathname) =>
      pathname.startsWith('/settings') || pathname.startsWith('/accounts/'),
  },
];

const readMobilePreference = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.matchMedia('(max-width: 1024px)').matches;
};

export default function AppShell() {
  const location = useLocation();
  const { currentAccount } = useAccount();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(readMobilePreference);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(max-width: 1024px)');
    const syncViewportState = (event) => {
      const nextIsMobile = event.matches;
      setIsMobile(nextIsMobile);

      if (!nextIsMobile) {
        setMobileMenuOpen(false);
        setSidebarCollapsed(false);
      }
    };

    syncViewportState(mediaQuery);
    mediaQuery.addEventListener('change', syncViewportState);

    return () => {
      mediaQuery.removeEventListener('change', syncViewportState);
    };
  }, []);

  const activeItem = useMemo(
    () => navItems.find((item) => item.match(location.pathname)) || navItems[0],
    [location.pathname]
  );
  const sidebarCompact = !isMobile && sidebarCollapsed;

  return (
    <div
      className={[
        'shell',
        sidebarCompact ? 'shell--sidebar-collapsed' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <aside
        className={[
          'shell__sidebar',
          sidebarCompact ? 'shell__sidebar--collapsed' : '',
          mobileMenuOpen ? 'shell__sidebar--mobile-open' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="shell__brand">
          <div className="shell__brand-mark">BJ</div>
          {!sidebarCompact ? (
            <div>
              <strong>{APP_NAME}</strong>
              <span>Trading journal workspace</span>
            </div>
          ) : null}
        </div>

        <nav className="shell__nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.match(location.pathname);

            return (
              <Link
                key={item.to}
                className={`shell__nav-link ${isActive ? 'is-active' : ''}`}
                to={item.to}
              >
                <Icon size={20} />
                {!sidebarCompact ? <span>{item.label}</span> : null}
              </Link>
            );
          })}
        </nav>

        <div className="shell__sidebar-footer">
          {currentAccount ? (
            <div
              className="shell__account-chip"
              style={{ '--account-color': currentAccount.color || '#4a90e2' }}
            >
              <span className="shell__account-dot" />
              {!sidebarCompact ? <span>{currentAccount.name}</span> : null}
            </div>
          ) : null}
        </div>
      </aside>

      {mobileMenuOpen ? (
        <button
          type="button"
          className="shell__backdrop"
          aria-label="Close sidebar"
          onClick={() => setMobileMenuOpen(false)}
        />
      ) : null}

      <div className="shell__content">
        <header className="shell__topbar">
          <div className="shell__topbar-left">
            <button
              type="button"
              className="icon-button shell__menu-button"
              onClick={() => {
                if (isMobile) {
                  setMobileMenuOpen((value) => !value);
                  return;
                }

                setSidebarCollapsed((value) => !value);
              }}
              aria-label="Toggle navigation"
            >
              <IoMenu size={22} />
            </button>
            <div>
              <span className="shell__active-label">{activeItem.label}</span>
              <strong>{currentAccount?.name || 'No active account selected'}</strong>
            </div>
          </div>

          <div className="shell__topbar-right">
            <span className="status-pill">Responsive Web</span>
          </div>
        </header>

        <main className="shell__main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
