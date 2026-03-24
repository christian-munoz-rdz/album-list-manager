import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  return (
    <nav className="bg-zinc-900 border-b border-zinc-800 px-4 py-3 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <Link to={isAuthenticated ? '/dashboard' : '/'} className="flex items-center gap-2 group">
          <span className="text-2xl">🎵</span>
          <span className="font-bold text-white text-lg group-hover:text-spotify-green transition-colors">
            Listen Later
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {isAuthenticated && user ? (
            <>
              <span className="text-zinc-400 text-sm hidden sm:block">{user.display_name || user.username}</span>
              {user.profile_image && (
                <img
                  src={user.profile_image}
                  alt={user.display_name || user.username}
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-zinc-700"
                />
              )}
              <button
                onClick={logout}
                className="text-zinc-400 hover:text-white text-sm transition-colors px-3 py-1.5 rounded-lg hover:bg-zinc-800"
              >
                Sign out
              </button>
            </>
          ) : (
            <a
              href="/api/auth/spotify"
              className="bg-spotify-green hover:bg-green-400 text-black font-semibold px-4 py-2 rounded-full text-sm transition-colors"
            >
              Sign in with Spotify
            </a>
          )}
        </div>
      </div>
    </nav>
  );
}
