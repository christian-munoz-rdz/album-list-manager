import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { login, spotifyLoginUrl } from '../api/client';

export default function Login() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useLocation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const params = new URLSearchParams(location.search);
  const oauthError = params.get('error');

  const redirectAfterLogin = () => {
    const state = location.state as { from?: { pathname: string; search?: string } } | undefined;
    const path = state?.from ? `${state.from.pathname}${state.from.search ?? ''}` : null;
    if (path && path.startsWith('/') && !path.startsWith('//')) {
      navigate(path, { replace: true });
    } else {
      navigate('/dashboard', { replace: true });
    }
  };

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: async (user) => {
      queryClient.setQueryData(['me'], user);
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      redirectAfterLogin();
    },
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    mutation.mutate({ identifier: identifier.trim(), password });
  }

  const errorMsg =
    (mutation.error as { response?: { data?: { error?: string } } } | undefined)
      ?.response?.data?.error ||
    (mutation.isError ? 'Login failed' : null);

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-xl">
        <h1 className="text-2xl font-bold text-white mb-2">Welcome back</h1>
        <p className="text-zinc-400 text-sm mb-6">Log in to Listen Later</p>

        {oauthError && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {oauthError}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-300 mb-1" htmlFor="identifier">
              Username or email
            </label>
            <input
              id="identifier"
              type="text"
              autoComplete="username"
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-white focus:outline-none focus:border-zinc-500"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-300 mb-1" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-white focus:outline-none focus:border-zinc-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {errorMsg && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full rounded-lg bg-white text-black font-semibold py-2 hover:bg-zinc-200 disabled:opacity-60"
          >
            {mutation.isPending ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-zinc-500">
          <div className="h-px bg-zinc-800 flex-1" />
          <span>or</span>
          <div className="h-px bg-zinc-800 flex-1" />
        </div>

        <a
          href={spotifyLoginUrl}
          className="w-full inline-flex items-center justify-center rounded-lg bg-[#1DB954] text-black font-semibold py-2 hover:brightness-95"
        >
          Continue with Spotify
        </a>

        <p className="mt-6 text-sm text-zinc-400 text-center">
          New here?{' '}
          <Link to="/register" className="text-white hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
