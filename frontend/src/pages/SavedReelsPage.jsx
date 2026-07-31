import { useEffect, useState } from "react";
import { ReelCard } from "../components/reels/ReelComponents";
import { listSavedReels } from "../services/reelService";
import { SEO } from "../components/SEO/SEO";

export function SavedReelsPage() {
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await listSavedReels();
        setReels(data.reels || []);
      } catch {
        setReels([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <>
      <SEO title="Saved Reels | Daya Creatives" robots="noindex,nofollow" />
      <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
      <h1 className="text-2xl font-black text-slate-900 dark:text-white">Saved Reels</h1>
      <p className="mt-1 text-sm text-slate-500">Your bookmarked short videos.</p>

      {loading ? (
        <div className="py-12 text-center text-sm text-slate-500">Loading saved reels...</div>
      ) : null}

      {!loading && !reels.length ? (
        <div className="mt-8 rounded-3xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700">
          No saved reels yet.
        </div>
      ) : null}

      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {reels.map((reel) => (
          <ReelCard key={reel._id} reel={reel} layout="card" />
        ))}
      </div>
    </div>
    </>
  );
}
