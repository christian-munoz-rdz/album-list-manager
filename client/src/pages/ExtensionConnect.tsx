import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createApiToken } from '../api/client';

function isAllowedExtensionRedirectUri(redirectUri: string): boolean {
  try {
    const u = new URL(redirectUri);
    if (u.protocol !== 'https:') return false;
    if (!u.hostname.endsWith('.chromiumapp.org')) return false;
    return true;
  } catch {
    return false;
  }
}

export default function ExtensionConnect() {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = searchParams.get('redirect_uri');
    if (!raw || !raw.trim()) {
      setError('Missing redirect_uri. Open this page from the extension’s “Connect account” action.');
      return;
    }

    let redirectUri: string;
    try {
      redirectUri = decodeURIComponent(raw.trim());
    } catch {
      setError('Invalid redirect_uri.');
      return;
    }

    if (!isAllowedExtensionRedirectUri(redirectUri)) {
      setError('Invalid redirect destination. Only Chrome extension redirect URLs are allowed.');
      return;
    }

    let cancelled = false;
    setError(null);

    void (async () => {
      try {
        const data = await createApiToken({ label: 'Chrome extension' });
        if (cancelled) return;
        const dest = new URL(redirectUri);
        dest.hash = `access_token=${encodeURIComponent(data.token)}&token_type=Bearer`;
        window.location.replace(dest.toString());
      } catch {
        if (!cancelled) {
          setError('Could not create API token. Try again or generate one from Settings.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <div className="max-w-lg mx-auto px-4 py-16">
      <h1 className="text-xl font-semibold text-white mb-2">Connecting extension</h1>
      {!error && (
        <p className="text-zinc-400 text-sm">Creating a token and returning to the extension…</p>
      )}
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );
}
