import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { logout as apiLogout } from '../api/client';

export default function Navbar() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const logoutMutation = useMutation({
    mutationFn: apiLogout,
    onSuccess: async () => {
      queryClient.setQueryData(['me'], null);
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.removeQueries({ queryKey: ['lists'] });
      navigate('/login', { replace: true });
    },
    onError: (err) => {
      console.error('Logout failed:', err);
      window.alert('Could not log out. Please try again.');
    },
  });
  const reduceMotion = useReducedMotion();
  const isDashboard = pathname === '/dashboard' || pathname.startsWith('/lists/');
  const isSearch = pathname === '/search';
  const isCharts = pathname === '/charts';

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
            <div className="inline-flex rounded-full bg-zinc-800/90 p-1 border border-zinc-700/80">
              {reduceMotion ? (
                <>
                  <Link
                    to="/dashboard"
                    aria-current={isDashboard ? 'page' : undefined}
                    className={`${linkBase} transition-colors ${
                      isDashboard
                        ? 'bg-zinc-600 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/search"
                    aria-current={isSearch ? 'page' : undefined}
                    className={`${linkBase} transition-colors ${
                      isSearch
                        ? 'bg-zinc-600 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Search
                  </Link>
                  <Link
                    to="/charts"
                    aria-current={isCharts ? 'page' : undefined}
                    className={`${linkBase} transition-colors ${
                      isCharts
                        ? 'bg-zinc-600 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Charts
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/dashboard"
                    aria-current={isDashboard ? 'page' : undefined}
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
                    to="/search"
                    aria-current={isSearch ? 'page' : undefined}
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
                  <Link
                    to="/charts"
                    aria-current={isCharts ? 'page' : undefined}
                    className={`${linkBase} ${
                      isCharts ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {isCharts && (
                      <motion.span
                        layoutId="nav-main-tab"
                        className="absolute inset-0 rounded-full bg-zinc-600 shadow-sm"
                        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                        style={{ zIndex: 0 }}
                      />
                    )}
                    <span className="relative z-[1]">Charts</span>
                  </Link>
                </>
              )}
            </div>
          </LayoutGroup>
        </div>

        {user ? (
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-zinc-400 text-sm hidden sm:block truncate max-w-[12rem] text-right">
              {user.display_name || user.username}
            </span>
            <button
              type="button"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="text-sm text-zinc-300 hover:text-white border border-zinc-700 hover:border-zinc-500 rounded-full px-3 py-1 disabled:opacity-60"
            >
              {logoutMutation.isPending ? 'Logging out…' : 'Log out'}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/login"
              className="text-sm text-zinc-300 hover:text-white px-3 py-1 rounded-full"
            >
              Log in
            </Link>
            <Link
              to="/register"
              className="text-sm bg-white text-black font-medium px-3 py-1 rounded-full hover:bg-zinc-200"
            >
              Sign up
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
