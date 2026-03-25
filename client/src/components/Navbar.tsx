import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { user } = useAuth();
  return (
    <nav className="bg-zinc-900 border-b border-zinc-800 px-4 py-3 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2 group">
          <span className="text-2xl">🎵</span>
          <span className="font-bold text-white text-lg group-hover:text-spotify-green transition-colors">
            Listen Later
          </span>
        </Link>
        {user && (
          <div className="flex items-center gap-4">
            <Link
              to="/charts"
              className="text-zinc-400 hover:text-spotify-green text-sm font-medium transition-colors hidden sm:block"
            >
              Charts
            </Link>
            <span className="text-zinc-400 text-sm hidden sm:block">
              {user.display_name || user.username}
            </span>
          </div>
        )}
      </div>
    </nav>
  );
}
