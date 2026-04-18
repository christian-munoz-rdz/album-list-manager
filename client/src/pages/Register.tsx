import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { register, spotifyLoginUrl } from '../api/client';

export default function Register() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');

  const mutation = useMutation({
    mutationFn: register,
    onSuccess: async (user) => {
      queryClient.setQueryData(['me'], user);
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      navigate('/dashboard', { replace: true });
    },
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    mutation.mutate({
      username: username.trim(),
      password,
      email: email.trim() || undefined,
      display_name: displayName.trim() || undefined,
    });
  }

  const errorMsg =
    (mutation.error as { response?: { data?: { error?: string } } } | undefined)
      ?.response?.data?.error ||
    (mutation.isError ? 'Registration failed' : null);

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-xl">
        <h1 className="text-2xl font-bold text-white mb-2">Create your account</h1>
        <p className="text-zinc-400 text-sm mb-6">Start curating album lists</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-300 mb-1" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-white focus:outline-none focus:border-zinc-500"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              minLength={3}
              maxLength={32}
              required
            />
            <p className="text-xs text-zinc-500 mt-1">3–32 chars: letters, numbers, _ . -</p>
          </div>
          <div>
            <label className="block text-sm text-zinc-300 mb-1" htmlFor="email">
              Email <span className="text-zinc-500">(optional)</span>
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-white focus:outline-none focus:border-zinc-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-300 mb-1" htmlFor="display_name">
              Display name <span className="text-zinc-500">(optional)</span>
            </label>
            <input
              id="display_name"
              type="text"
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-white focus:outline-none focus:border-zinc-500"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={255}
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-300 mb-1" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-white focus:outline-none focus:border-zinc-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
            <p className="text-xs text-zinc-500 mt-1">Minimum 8 characters</p>
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
            {mutation.isPending ? 'Creating account…' : 'Create account'}
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
          Already have an account?{' '}
          <Link to="/login" className="text-white hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
