import { Link, useLocation } from 'react-router-dom';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const reduceMotion = useReducedMotion();
  const isDashboard = pathname === '/dashboard' || pathname.startsWith('/lists/');
  const isSearch = pathname === '/charts';

  const linkBase =
    'relative z-0 px-4 py-1.5 rounded-full text-sm font-medium inline-flex items-center justify-center';

  return (
    <nav className="bg-zinc-900 border-b border-zinc-800 px-4 py-3 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-2xl" aria-hidden>
            🎵
          </span>
          <span className="font-bold text-white text-lg">Listen Later</span>
        </div>

        <div className="flex-1 flex justify-center min-w-0">
          <LayoutGroup>
            <div
              className="inline-flex rounded-full bg-zinc-800/90 p-1 border border-zinc-700/80"
              role="tablist"
              aria-label="Main"
            >
              {reduceMotion ? (
                <>
                  <Link
                    to="/dashboard"
                    role="tab"
                    aria-selected={isDashboard}
                    className={`${linkBase} transition-colors ${
                      isDashboard
                        ? 'bg-zinc-600 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/charts"
                    role="tab"
                    aria-selected={isSearch}
                    className={`${linkBase} transition-colors ${
                      isSearch
                        ? 'bg-zinc-600 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Search
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/dashboard"
                    role="tab"
                    aria-selected={isDashboard}
                    className={`${linkBase} ${
                      isDashboard ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {isDashboard && (
                      <motion.span
                        layoutId="nav-main-tab"
                        className="absolute inset-0 rounded-full bg-zinc-600 shadow-sm"
                        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                        style={{ zIndex: 0 }}
                      />
                    )}
                    <span className="relative z-[1]">Dashboard</span>
                  </Link>
                  <Link
                    to="/charts"
                    role="tab"
                    aria-selected={isSearch}
                    className={`${linkBase} ${
                      isSearch ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {isSearch && (
                      <motion.span
                        layoutId="nav-main-tab"
                        className="absolute inset-0 rounded-full bg-zinc-600 shadow-sm"
                        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                        style={{ zIndex: 0 }}
                      />
                    )}
                    <span className="relative z-[1]">Search</span>
                  </Link>
                </>
              )}
            </div>
          </LayoutGroup>
        </div>

        {user && (
          <span className="text-zinc-400 text-sm hidden sm:block truncate max-w-[12rem] shrink-0 text-right">
            {user.display_name || user.username}
          </span>
        )}
      </div>
    </nav>
  );
}
