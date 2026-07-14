import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { ReelsFeed } from "../components/reels/ReelsFeed";
import { ReelsErrorBoundary } from "../components/reels/ReelsErrorBoundary";
import { useAuthStore } from "../context/authStore";
import { showError } from "../services/notificationService";
import {
  getReel,
  likeReel,
  listReels,
  saveReel,
  unlikeReel,
  unsaveReel,
} from "../services/reelService";

export function ReelsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const sort = searchParams.get("sort") || "trending";
  const focusReelId = searchParams.get("reel");

  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadReels = useCallback(
    async (nextPage = 1, append = false) => {
      setLoading(true);
      try {
        const data = await listReels({ sort, page: nextPage, limit: 8 });
        if (!data || typeof data !== "object") throw new Error("Invalid API response");
        
        let items = (data.reels || []).filter((reel) => reel && reel._id && reel.videoUrl);

        if (nextPage === 1 && focusReelId && !items.some((reel) => String(reel._id) === focusReelId)) {
          try {
            const focused = await getReel(focusReelId);
            if (focused && focused._id && focused.videoUrl) items = [focused, ...items];
          } catch {
            // Ignore missing focus reel
          }
        }

        setReels((current) => (append ? [...current, ...items] : items));
        setHasMore(nextPage < (data.pagination?.pages || 1));
        setPage(nextPage);
      } catch (error) {
        console.error("Reels load error:", error);
        showError(error?.response?.data?.message || "Failed to load reels");
      } finally {
        setLoading(false);
      }
    },
    [focusReelId, sort]
  );

  useEffect(() => {
    loadReels(1, false);
  }, [loadReels]);

  useEffect(() => {
    document.body.classList.add("reels-immersive");
    return () => document.body.classList.remove("reels-immersive");
  }, []);

  async function handleLike(reel) {
    if (!reel || !reel._id) return;
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    try {
      const result = reel.liked ? await unlikeReel(reel._id) : await likeReel(reel._id);
      if (result && typeof result.liked === "boolean") {
        setReels((current) =>
          current.map((item) =>
            item._id === reel._id ? { ...item, liked: result.liked, likesCount: result.likesCount || 0 } : item
          )
        );
      }
    } catch (error) {
      console.error("Like error:", error);
      showError(error?.response?.data?.message || "Unable to update like");
    }
  }

  async function handleSave(reel) {
    if (!reel || !reel._id) return;
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    try {
      const result = reel.saved ? await unsaveReel(reel._id) : await saveReel(reel._id);
      if (result && typeof result.saved === "boolean") {
        setReels((current) =>
          current.map((item) =>
            item._id === reel._id ? { ...item, saved: result.saved, savesCount: result.savesCount || 0 } : item
          )
        );
      }
    } catch (error) {
      console.error("Save error:", error);
      showError(error?.response?.data?.message || "Unable to update save");
    }
  }

  return (
    <ReelsErrorBoundary>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm">
        <div className="pointer-events-none absolute left-0 right-0 top-0 z-50 flex items-center justify-between px-4 py-3">
          <Link
            to="/"
            className="pointer-events-auto hidden items-center gap-1 rounded-full bg-black/30 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md md:inline-flex"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="pointer-events-auto ml-auto flex gap-2 overflow-x-auto">
            {["trending", "latest", "popular", "recommended"].map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => navigate(`/reels?sort=${key}${focusReelId ? `&reel=${focusReelId}` : ""}`)}
                className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
                  sort === key ? "bg-red-600 text-white" : "bg-black/30 text-zinc-300 backdrop-blur-md"
                }`}
              >
                {key}
              </button>
            ))}
          </div>
        </div>

        <ReelsFeed
          reels={reels}
          loading={loading}
          hasMore={hasMore}
          onLoadMore={() => loadReels(page + 1, true)}
          onReelsUpdate={setReels}
          onLike={handleLike}
          onSave={handleSave}
        />
      </div>
    </ReelsErrorBoundary>
  );
}
