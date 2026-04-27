import { HeadContent, Link, Outlet, Scripts, createRootRoute, useNavigate, useRouterState } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import {
  Barcode,
  BookOpenCheck,
  Newspaper,
  LogOut,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Package2,
  Shield,
  ScanLine,
  UserRound,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

import { PwaRegistration } from '../components/pwa-registration'
import { ThemeToggle } from '../components/theme-toggle'
import '../styles.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'GIT Yarn | Get It Together',
      },
      {
        name: 'description',
        content:
          'Inventory yarn, hooks, patterns, and creations with barcode-ready yarn catalog tooling.',
      },
      {
        name: 'theme-color',
        content: '#f8dce6',
      },
    ],
    links: [
      {
        rel: 'manifest',
        href: '/manifest.json',
      },
      {
        rel: 'icon',
        href: '/favicon.ico',
      },
      {
        rel: 'apple-touch-icon',
        href: '/logo192.png',
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com',
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Nunito+Sans:wght@400;600;700&display=swap',
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){var isLocal=location.hostname==='localhost'||location.hostname==='127.0.0.1';if(!isLocal) return;if(!('serviceWorker' in navigator)) return;navigator.serviceWorker.getRegistrations().then(function(rs){rs.forEach(function(r){r.unregister();});});if('caches' in window){caches.keys().then(function(keys){keys.forEach(function(k){caches.delete(k);});});}})();",
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){var t='light';try{t=localStorage.getItem('gityarn-theme')||'';}catch(_){}if(t!=='dark'&&t!=='light'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t;})();",
          }}
        />
      </head>
      <body>
        <PwaRegistration />
        <AppShell>{children || <Outlet />}</AppShell>
        {import.meta.env.DEV ? (
          <TanStackDevtools
            config={{
              position: 'bottom-right',
            }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        ) : null}
        <Scripts />
      </body>
    </html>
  )
}

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const navigate = useNavigate()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [authUser, setAuthUser] = useState<{
    id: string
    displayName: string
    email: string
    role: 'member' | 'admin'
  } | null>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((response) => response.json())
      .then((data: { user: typeof authUser }) => setAuthUser(data.user))
      .catch(() => setAuthUser(null))
  }, [])

  useEffect(() => {
    const current = document.documentElement.dataset.theme
    let nextTheme: 'light' | 'dark' = current === 'dark' ? 'dark' : 'light'
    try {
      const stored = window.localStorage.getItem('gityarn-theme')
      if (stored === 'dark' || stored === 'light') {
        nextTheme = stored
      } else {
        nextTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      }
    } catch {
      nextTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }

    if (document.documentElement.dataset.theme !== nextTheme) {
      document.documentElement.dataset.theme = nextTheme
    }
  }, [pathname])

  const isAuthenticated = Boolean(authUser)

  const signOut = async () => {
    await fetch('/api/auth/sign-out', { method: 'POST' })
    setAuthUser(null)
    setProfileOpen(false)
    await navigate({ to: '/' })
  }

  const isPublicRoute =
    pathname === '/' ||
    pathname === '/auth' ||
    pathname === '/sign-in' ||
    pathname === '/register' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname === '/blog'

  if (isPublicRoute) {
    return (
      <div className="public-layout">
        <header className="public-header">
          <Link className="brand" to="/">
            <Package2 aria-hidden="true" size={18} />
            <span>GIT Yarn</span>
          </Link>
          <div className="hero-actions">
            {isAuthenticated ? (
              <Link className="button button-primary" to="/dashboard">
                Go to Discover
              </Link>
            ) : (
              <>
                <Link className="button" to="/sign-in">
                  Sign In
                </Link>
                <Link className="button button-primary" to="/register">
                  Register
                </Link>
              </>
            )}
          </div>
        </header>
        <main className="public-content">{children}</main>
      </div>
    )
  }

  const layoutStyle = {
    '--sidebar-width': sidebarCollapsed ? '84px' : '260px',
  } as CSSProperties

  return (
    <div className="app-layout" style={layoutStyle}>
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`} data-collapsed={sidebarCollapsed ? 'true' : 'false'}>
        <div className="sidebar-brand">
          <Link className="brand" to="/">
            <Package2 aria-hidden="true" size={18} />
            <span>GIT Yarn</span>
          </Link>
        </div>

        <nav className="sidebar-nav">
          <Link
            activeProps={{ className: 'active' }}
            className="nav-item"
            to="/dashboard"
          >
            <Newspaper aria-hidden="true" size={18} />
            <span className="nav-label">Discover</span>
          </Link>
          <Link
            activeProps={{ className: 'active' }}
            className="nav-item"
            to="/inventory"
          >
            <BookOpenCheck aria-hidden="true" size={18} />
            <span className="nav-label">Inventory</span>
          </Link>
          <Link
            activeProps={{ className: 'active' }}
            className="nav-item"
            to="/catalog"
          >
            <Barcode aria-hidden="true" size={18} />
            <span className="nav-label">Yarn Catalog</span>
          </Link>
          <Link
            activeProps={{ className: 'active' }}
            className="nav-item"
            to="/scan"
          >
            <ScanLine aria-hidden="true" size={18} />
            <span className="nav-label">Barcode Scan</span>
          </Link>
        </nav>

        <div className="sidebar-footer">
          <div className="profile-menu-shell">
            <button
              aria-label="Open profile options"
              className="profile-button"
              onClick={() => setProfileOpen((current) => !current)}
              type="button"
            >
              <UserRound size={16} />
              <span>{authUser?.displayName ?? 'Account'}</span>
            </button>

            {profileOpen ? (
              <div className="profile-menu">
                {authUser ? (
                  <Link
                    className="profile-menu-item"
                    onClick={() => setProfileOpen(false)}
                    params={{ userId: authUser.id }}
                    to="/profile/$userId"
                  >
                    <UserRound size={14} /> My Profile
                  </Link>
                ) : null}
                <Link className="profile-menu-item" onClick={() => setProfileOpen(false)} to="/account-settings">
                  <Settings size={14} /> Account Settings
                </Link>
                {authUser?.role === 'admin' ? (
                  <Link className="profile-menu-item" onClick={() => setProfileOpen(false)} to="/admin">
                    <Shield size={14} /> Admin Panel
                  </Link>
                ) : null}
                <div className="profile-menu-item profile-menu-theme-item">
                  <ThemeToggle />
                </div>
                <button className="profile-menu-item danger" onClick={signOut} type="button">
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </aside>

      <button
        aria-label={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
        className="sidebar-edge-toggle desktop-only"
        onClick={() => setSidebarCollapsed((current) => !current)}
        type="button"
      >
        {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
      </button>

      <div className="workspace">
        <main className="workspace-content">
          {children}
        </main>
        <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
          <Link activeProps={{ className: 'active' }} className="mobile-bottom-item" to="/dashboard">
            <Newspaper size={17} />
            <span>Discover</span>
          </Link>
          <Link activeProps={{ className: 'active' }} className="mobile-bottom-item" to="/inventory">
            <BookOpenCheck size={17} />
            <span>Inventory</span>
          </Link>
          <Link activeProps={{ className: 'active' }} className="mobile-bottom-item" to="/catalog">
            <Barcode size={17} />
            <span>Catalog</span>
          </Link>
          <Link activeProps={{ className: 'active' }} className="mobile-bottom-item" to="/scan">
            <ScanLine size={17} />
            <span>Scan</span>
          </Link>
          <button
            className={`mobile-bottom-item ${pathname === '/account-settings' || pathname.startsWith('/profile/') ? 'active' : ''}`}
            onClick={() => setProfileOpen((current) => !current)}
            type="button"
          >
            <UserRound size={17} />
            <span>Profile</span>
          </button>
        </nav>
        {profileOpen ? (
          <div className="mobile-profile-menu-shell" role="presentation">
            <button aria-label="Close profile menu" className="mobile-profile-backdrop" onClick={() => setProfileOpen(false)} type="button" />
            <div className="profile-menu mobile-profile-menu" role="dialog" aria-modal="true" aria-label="Profile menu">
              {authUser ? (
                <Link
                  className="profile-menu-item"
                  onClick={() => setProfileOpen(false)}
                  params={{ userId: authUser.id }}
                  to="/profile/$userId"
                >
                  <UserRound size={14} /> My Profile
                </Link>
              ) : null}
              <Link className="profile-menu-item" onClick={() => setProfileOpen(false)} to="/account-settings">
                <Settings size={14} /> Account Settings
              </Link>
              {authUser?.role === 'admin' ? (
                <Link className="profile-menu-item" onClick={() => setProfileOpen(false)} to="/admin">
                  <Shield size={14} /> Admin Panel
                </Link>
              ) : null}
              <div className="profile-menu-item profile-menu-theme-item">
                <ThemeToggle />
              </div>
              <button className="profile-menu-item danger" onClick={signOut} type="button">
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
