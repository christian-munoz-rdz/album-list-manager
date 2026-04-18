import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createApiToken, deleteApiToken, getApiTokens } from '../api/client';

function formatDate(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function Settings() {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState('');
  const [revealedToken, setRevealedToken] = useState<string | null>(null);

  const { data: tokens, isLoading } = useQuery({
    queryKey: ['api-tokens'],
    queryFn: getApiTokens,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createApiToken(label.trim() ? { label: label.trim() } : undefined),
    onSuccess: (data) => {
      setRevealedToken(data.token);
      setLabel('');
      queryClient.invalidateQueries({ queryKey: ['api-tokens'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteApiToken,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-tokens'] });
    },
  });

  const copyToken = async () => {
    if (!revealedToken) return;
    try {
      await navigator.clipboard.writeText(revealedToken);
    } catch {
      window.alert('Could not copy. Select the token and copy manually.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-white mb-2">Settings</h1>
      <p className="text-zinc-500 text-sm mb-10">
        Connect the RYM Chart Exporter extension to your account.
      </p>

      <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-white mb-2">Chrome extension</h2>
        <p className="text-zinc-400 text-sm mb-4 leading-relaxed">
          Install the extension, open its options page, and use <strong>Connect account</strong> while you are
          signed into this site (use the same host as your API URL, e.g.{' '}
          <code className="text-zinc-300 bg-zinc-800 px-1 rounded">http://localhost:3000/api</code>
          ), or paste an API token below. Set your target list ID from a list URL (
          <code className="text-zinc-300 bg-zinc-800 px-1 rounded">/lists/&lt;uuid&gt;</code>
          ). Grant host access when the browser prompts the extension.
        </p>

        {revealedToken && (
          <div className="mb-6 p-4 rounded-xl bg-amber-950/50 border border-amber-800/80">
            <p className="text-amber-200 text-sm font-medium mb-2">Copy this token now — it will not be shown again.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <code className="flex-1 text-xs text-amber-100 break-all bg-zinc-950/80 p-3 rounded-lg border border-zinc-800">
                {revealedToken}
              </code>
              <button
                type="button"
                onClick={copyToken}
                className="shrink-0 bg-amber-700 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg"
              >
                Copy
              </button>
            </div>
            <button
              type="button"
              onClick={() => setRevealedToken(null)}
              className="mt-3 text-sm text-zinc-400 hover:text-zinc-200"
            >
              I’ve saved it — dismiss
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional)"
            className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-spotify-green/50"
            maxLength={255}
          />
          <button
            type="button"
            disabled={createMutation.isPending}
            onClick={() => createMutation.mutate()}
            className="bg-spotify-green hover:bg-green-400 text-black font-semibold px-5 py-2 rounded-lg text-sm disabled:opacity-60"
          >
            {createMutation.isPending ? 'Creating…' : 'Generate token'}
          </button>
        </div>
        {createMutation.isError && (
          <p className="text-red-400 text-sm mb-4">Could not create token. Try again.</p>
        )}

        <h3 className="text-sm font-medium text-zinc-300 mb-2">Active tokens</h3>
        {isLoading && <p className="text-zinc-500 text-sm">Loading…</p>}
        {!isLoading && (!tokens || tokens.length === 0) && (
          <p className="text-zinc-500 text-sm">No tokens yet.</p>
        )}
        {tokens && tokens.length > 0 && (
          <ul className="space-y-2">
            {tokens.map((t) => (
              <li
                key={t.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-3 border-b border-zinc-800 last:border-0"
              >
                <div>
                  <span className="text-zinc-200 text-sm">{t.label || 'Unlabeled'}</span>
                  <p className="text-zinc-500 text-xs mt-0.5">
                    Created {formatDate(t.created_at)}
                    {t.last_used_at && ` · Last used ${formatDate(t.last_used_at)}`}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (window.confirm('Revoke this token? The extension will stop working until you create a new one.')) {
                      deleteMutation.mutate(t.id);
                    }
                  }}
                  className="text-sm text-red-400 hover:text-red-300 self-start sm:self-center"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
        {deleteMutation.isError && (
          <p className="text-red-400 text-sm mt-2">Could not revoke token.</p>
        )}
      </section>
    </div>
  );
}
