import { HeadContent, Link, Outlet, Scripts, createRootRoute, useNavigate, useRouterState } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import {
  Barcode,
  BookOpenCheck,
  Newspaper,
  X,
  Menu,
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
import { ScanUtility } from '../components/scan-utility'
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
    <html data-theme="light" lang="en" suppressHydrationWarning>
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
              "(function(){var t=localStorage.getItem('gityarn-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t;})();",
          }}
        />
      </head>
      <body>
        <PwaRegistration />
        <AppShell>{children || <Outlet />}</AppShell>
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
        <Scripts />
      </body>
    </html>
  )
}

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const navigate = useNavigate()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
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

  const isAuthenticated = Boolean(authUser)

  const signOut = async () => {
    await fetch('/api/auth/sign-out', { method: 'POST' })
    setAuthUser(null)
    setProfileOpen(false)
    setMobileSidebarOpen(false)
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
      {mobileSidebarOpen ? (
        <button
          aria-label="Close navigation"
          className="sidebar-backdrop"
          onClick={() => setMobileSidebarOpen(false)}
          type="button"
        />
      ) : null}
      <aside
        className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileSidebarOpen ? 'mobile-open' : ''}`}
        data-collapsed={sidebarCollapsed ? 'true' : 'false'}
      >
        <div className="sidebar-brand">
          <Link className="brand" to="/">
            <Package2 aria-hidden="true" size={18} />
            <span>GIT Yarn</span>
          </Link>
          <button
            aria-label="Close navigation"
            className="icon-button mobile-only"
            onClick={() => setMobileSidebarOpen(false)}
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <Link
            activeProps={{ className: 'active' }}
            className="nav-item"
            onClick={() => setMobileSidebarOpen(false)}
            to="/dashboard"
          >
            <Newspaper aria-hidden="true" size={18} />
            <span className="nav-label">Discover</span>
          </Link>
          <Link
            activeProps={{ className: 'active' }}
            className="nav-item"
            onClick={() => setMobileSidebarOpen(false)}
            to="/inventory"
          >
            <BookOpenCheck aria-hidden="true" size={18} />
            <span className="nav-label">Inventory</span>
          </Link>
          <Link
            activeProps={{ className: 'active' }}
            className="nav-item"
            onClick={() => setMobileSidebarOpen(false)}
            to="/catalog"
          >
            <Barcode aria-hidden="true" size={18} />
            <span className="nav-label">Yarn Catalog</span>
          </Link>
          <Link
            activeProps={{ className: 'active' }}
            className="nav-item"
            onClick={() => setMobileSidebarOpen(false)}
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
                <Link className="profile-menu-item" onClick={() => setProfileOpen(false)} to="/account-settings">
                  <Settings size={14} /> Account Settings
                </Link>
                {authUser?.role === 'admin' ? (
                  <Link className="profile-menu-item" onClick={() => setProfileOpen(false)} to="/admin">
                    <Shield size={14} /> Admin Panel
                  </Link>
                ) : null}
                <button className="profile-menu-item danger" onClick={signOut} type="button">
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            ) : null}
          </div>
          <ThemeToggle />
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
          <button
            aria-label="Toggle navigation"
            className="icon-button mobile-only workspace-menu-button"
            onClick={() => setMobileSidebarOpen((current) => !current)}
            type="button"
          >
            <Menu size={18} />
          </button>
          {children}
        </main>
        <ScanUtility showFab />
      </div>
    </div>
  )
}
