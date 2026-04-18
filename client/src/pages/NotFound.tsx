import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function NotFound() {
  const { user, isLoading } = useAuth();

  return (
    <div className="max-w-6xl mx-auto px-4 py-20 text-center">
      <p className="text-zinc-500 text-sm mb-2">404</p>
      <h1 className="text-2xl font-bold text-white mb-2">Page not found</h1>
      <p className="text-zinc-400 mb-8 max-w-md mx-auto">
        The page you’re looking for doesn’t exist or the link may be wrong.
      </p>
      {isLoading ? (
        <p className="text-zinc-500 text-sm">Loading…</p>
      ) : user ? (
        <Link to="/dashboard" className="text-spotify-green hover:text-green-400 text-sm font-medium transition-colors">
          Go to your lists
        </Link>
      ) : (
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 justify-center items-center text-sm">
          <Link to="/login" className="text-spotify-green hover:text-green-400 font-medium transition-colors">
            Sign in
          </Link>
          <span className="text-zinc-600 hidden sm:inline">·</span>
          <Link to="/register" className="text-zinc-400 hover:text-white transition-colors">
            Create an account
          </Link>
        </div>
      )}
    </div>
  );
}
