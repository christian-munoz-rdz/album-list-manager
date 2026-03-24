export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black" />
        <div className="absolute inset-0 bg-gradient-to-r from-spotify-green/5 via-transparent to-transparent" />
        <div className="relative max-w-6xl mx-auto px-4 py-24 sm:py-36 text-center">
          <div className="inline-flex items-center gap-2 bg-zinc-800/60 border border-zinc-700 rounded-full px-4 py-1.5 text-sm text-zinc-400 mb-8">
            <span className="w-2 h-2 bg-spotify-green rounded-full animate-pulse" />
            Powered by Spotify
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold text-white mb-6 leading-tight">
            Curate Albums You Want{' '}
            <span className="text-spotify-green">to Listen To</span>
          </h1>
          <p className="text-zinc-400 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Build personal listening queues, organise albums into themed lists, and share your curation with friends. Never forget a great album recommendation again.
          </p>
          <a
            href="/api/auth/spotify"
            className="inline-flex items-center gap-3 bg-spotify-green hover:bg-green-400 text-black font-bold px-8 py-4 rounded-full text-lg transition-all duration-200 shadow-lg shadow-spotify-green/20 hover:shadow-spotify-green/40 hover:scale-105"
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current" aria-hidden="true">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
            Sign in with Spotify
          </a>
          <p className="text-zinc-600 text-sm mt-4">Free to use · No credit card required</p>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="max-w-6xl mx-auto px-4 py-20">
        <h2 className="text-center text-zinc-500 text-sm font-semibold uppercase tracking-widest mb-12">
          Everything you need to track your listening
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <FeatureCard
            icon="📋"
            title="Create Lists"
            description="Organise albums into custom lists — by mood, genre, era, or any theme you like. Keep your backlog structured and easy to navigate."
          />
          <FeatureCard
            icon="🔍"
            title="Add Albums"
            description="Search Spotify's full catalogue instantly. Add any album to your lists with a single click and see rich metadata including genres and top tracks."
          />
          <FeatureCard
            icon="🔗"
            title="Share with Friends"
            description="Make lists public and share a link with anyone. Friends can browse your curation and save albums to their own lists, even without signing in."
          />
        </div>
      </div>

      {/* Secondary CTA */}
      <div className="border-t border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 py-16 text-center">
          <p className="text-zinc-400 mb-6 text-lg">Ready to start curating?</p>
          <a
            href="/api/auth/spotify"
            className="inline-flex items-center gap-2 border border-spotify-green text-spotify-green hover:bg-spotify-green hover:text-black font-semibold px-6 py-3 rounded-full text-sm transition-all duration-200"
          >
            Get started for free
          </a>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 transition-colors">
      <div className="text-3xl mb-4">{icon}</div>
      <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>
      <p className="text-zinc-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
