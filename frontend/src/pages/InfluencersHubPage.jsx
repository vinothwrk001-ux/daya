import { createElement, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Bell,
  Bookmark,
  Compass,
  Heart,
  Home,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Search,
  Star,
  Store,
  TrendingUp,
  UserPlus,
  Users,
  Video,
  X,
} from "lucide-react";
import { ReelFeed } from "../components/reel/ReelFeed";
import { useAuthStore } from "../context/authStore";
import {
  createReelComment,
  followPublicInfluencer,
  listAffiliateProducts,
  listInfluencers,
  getReelFeed,
  listReelComments,
  recordReelStoreVisit,
  toggleReelLike,
  unfollowPublicInfluencer,
} from "../services/influencerCommerceService";
import { getMyFollowedStores } from "../services/vendorStorefrontService";
import { formatCurrency } from "../utils/formatCurrency";
import { resolveApiAssetUrl } from "../utils/resolveUrl";

const HUB_ITEMS = [
  ["home", "Home", Home],
  ["reels", "Reels", Video],
  ["search", "Search", Search],
  ["explore", "Explore", Compass],
  ["notifications", "Notifications", Bell],
  ["saved", "Saved", Bookmark],
  ["following", "Following", Users],
  ["trending", "Trending", TrendingUp],
];

function compact(value = 0) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value || 0));
}

function influencerName(row = {}) {
  return row.name || row.displayName || row.userId?.name || row.username || "Creator";
}

function influencerAvatar(row = {}) {
  return resolveApiAssetUrl(row.profilePicture || row.profileImage || row.avatarUrl || row.userId?.avatarUrl || "");
}

function influencerSlug(row = {}) {
  const profile = row?.influencerId && typeof row.influencerId === "object" ? row.influencerId : row;
  return profile?.storeSlug || row?.storeSlug || profile?.storefront?.slug || row?.storefront?.slug || "";
}

function influencerHref(row = {}) {
  const slug = influencerSlug(row);
  return slug ? `/influencer/${slug}` : "/influencers";
}

function influencerId(row = {}) {
  const profile = row?.influencerId && typeof row.influencerId === "object" ? row.influencerId : row;
  return String(profile?._id || row?._id || row?.id || "");
}

function productImage(row = {}) {
  return resolveApiAssetUrl(row.image || row.thumbnail || row.images?.[0]?.url || "");
}

function normalizeInfluencers(payload) {
  const rows = Array.isArray(payload?.data?.items) ? payload.data.items : Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.items) ? payload.items : [];
  return rows;
}

export function InfluencersHubPage() {
  const params = useParams();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const section = params.section || "home";
  const [creators, setCreators] = useState([]);
  const [reels, setReels] = useState([]);
  const [products, setProducts] = useState([]);
  const [followedStores, setFollowedStores] = useState([]);
  const [savedIds, setSavedIds] = useState({});
  const [likedIds, setLikedIds] = useState({});
  const [followedIds, setFollowedIds] = useState({});
  const [followBusy, setFollowBusy] = useState({});
  const [loginPrompt, setLoginPrompt] = useState(false);
  const [commentReel, setCommentReel] = useState(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [creatorRes, reelRes, productRes, followedRes] = await Promise.allSettled([
          listInfluencers({ search: query, limit: 24, followingOnly: section === "following" ? "true" : undefined }),
          getReelFeed({ tab: section === "trending" ? "trending" : "for_you", limit: 12 }),
          listAffiliateProducts({ search: query, limit: 12 }),
          getMyFollowedStores({ limit: 12 }),
        ]);
        if (cancelled) return;
        if (creatorRes.status === "fulfilled") {
          const rows = normalizeInfluencers(creatorRes.value);
          setCreators(rows);
          setFollowedIds((current) => rows.reduce((next, creator) => ({ ...next, [influencerId(creator)]: Boolean(creator.isFollowing) }), current));
        }
        if (reelRes.status === "fulfilled") {
          const rows = reelRes.value?.data?.items || reelRes.value?.data || [];
          setReels(rows);
          setFollowedIds((current) => rows.reduce((next, reel) => {
            const creator = reel.influencerId && typeof reel.influencerId === "object" ? reel.influencerId : {};
            return creator._id ? { ...next, [String(creator._id)]: Boolean(creator.isFollowing) } : next;
          }, current));
          setLikedIds((current) => rows.reduce((next, reel) => ({ ...next, [reel._id]: Boolean(reel.engagement?.viewer?.liked) }), current));
          setSavedIds((current) => rows.reduce((next, reel) => ({ ...next, [reel._id]: Boolean(reel.engagement?.viewer?.saved) }), current));
        }
        if (productRes.status === "fulfilled") setProducts(productRes.value?.data?.items || productRes.value?.data || []);
        if (followedRes.status === "fulfilled") setFollowedStores(followedRes.value?.data?.followers || followedRes.value?.data?.items || followedRes.value?.data || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [query, section]);

  const suggestedCreators = useMemo(() => creators.slice(0, 6), [creators]);
  const trendingCreators = useMemo(() => [...creators].sort((a, b) => Number(b.followers || 0) - Number(a.followers || 0)).slice(0, 12), [creators]);
  const showSuggestionsPanel = section === "home";

  async function toggleFollow(creatorLike) {
    const creatorId = influencerId(creatorLike);
    const slug = influencerSlug(creatorLike);
    if (!creatorId || !slug) return;
    if (!isAuthenticated) {
      setLoginPrompt(true);
      return;
    }
    const wasFollowing = Boolean(followedIds[creatorId]);
    if (wasFollowing && !window.confirm(`Do you want to unfollow ${influencerName(creatorLike)}?`)) return;
    setFollowBusy((current) => ({ ...current, [creatorId]: true }));
    setFollowedIds((current) => ({ ...current, [creatorId]: !wasFollowing }));
    updateCreatorFollowerCount(creatorId, wasFollowing ? -1 : 1);
    try {
      const response = wasFollowing ? await unfollowPublicInfluencer(slug) : await followPublicInfluencer(slug);
      const nextFollowing = Boolean(response?.data?.following);
      const nextFollowers = response?.data?.followers;
      setFollowedIds((current) => ({ ...current, [creatorId]: nextFollowing }));
      if (nextFollowers !== undefined) setCreatorFollowerCount(creatorId, nextFollowers);
    } catch (err) {
      setFollowedIds((current) => ({ ...current, [creatorId]: wasFollowing }));
      updateCreatorFollowerCount(creatorId, wasFollowing ? 1 : -1);
      if (err?.response?.status === 401) setLoginPrompt(true);
    } finally {
      setFollowBusy((current) => ({ ...current, [creatorId]: false }));
    }
  }

  function updateCreatorFollowerCount(creatorId, delta) {
    setCreators((current) => current.map((creator) => influencerId(creator) === creatorId ? { ...creator, followers: Math.max(0, Number(creator.followers || 0) + delta) } : creator));
    setReels((current) => current.map((reel) => {
      const creator = reel.influencerId && typeof reel.influencerId === "object" ? reel.influencerId : null;
      if (!creator || String(creator._id) !== creatorId) return reel;
      return { ...reel, influencerId: { ...creator, followers: Math.max(0, Number(creator.followers || 0) + delta) } };
    }));
  }

  function setCreatorFollowerCount(creatorId, followers) {
    setCreators((current) => current.map((creator) => influencerId(creator) === creatorId ? { ...creator, followers } : creator));
    setReels((current) => current.map((reel) => {
      const creator = reel.influencerId && typeof reel.influencerId === "object" ? reel.influencerId : null;
      if (!creator || String(creator._id) !== creatorId) return reel;
      return { ...reel, influencerId: { ...creator, followers } };
    }));
  }

  function toggleSave(id) {
    setSavedIds((current) => ({ ...current, [id]: !current[id] }));
  }

  function updateReelMetrics(reelId, counts = {}) {
    setReels((current) => current.map((reel) => reel._id === reelId ? {
      ...reel,
      metrics: {
        ...(reel.metrics || {}),
        ...(counts || {}),
        bookmarks: counts.saves ?? counts.bookmarks ?? reel.metrics?.bookmarks,
      },
      engagement: {
        ...(reel.engagement || {}),
        counts: { ...(reel.engagement?.counts || {}), ...(counts || {}) },
      },
    } : reel));
    setCommentReel((current) => current?._id === reelId ? {
      ...current,
      metrics: { ...(current.metrics || {}), ...(counts || {}) },
    } : current);
  }

  async function handleLike(reel) {
    if (!reel?._id || reel.synthetic) return;
    if (!isAuthenticated) {
      setLoginPrompt(true);
      return;
    }
    const wasLiked = Boolean(likedIds[reel._id]);
    setLikedIds((current) => ({ ...current, [reel._id]: !wasLiked }));
    updateReelMetrics(reel._id, { likes: Math.max(0, Number(reel.metrics?.likes || 0) + (wasLiked ? -1 : 1)) });
    try {
      const response = await toggleReelLike(reel._id);
      setLikedIds((current) => ({ ...current, [reel._id]: Boolean(response?.data?.liked) }));
      updateReelMetrics(reel._id, response?.data?.counts || {});
    } catch (err) {
      setLikedIds((current) => ({ ...current, [reel._id]: wasLiked }));
      updateReelMetrics(reel._id, { likes: Number(reel.metrics?.likes || 0) });
      if (err?.response?.status === 401) setLoginPrompt(true);
    }
  }

  function openComments(reel) {
    if (!reel?._id || reel.synthetic) return;
    setCommentReel(reel);
  }

  function visitStore(reel, href) {
    if (reel?._id && !reel.synthetic) {
      recordReelStoreVisit(reel._id, { anonymousId: window.localStorage.getItem("anonInfluencerId") || "", source: "home_feed" }).catch(() => null);
    }
    navigate(href);
  }

  return (
    <div className={`mx-auto grid min-h-[calc(100vh-170px)] max-w-[1600px] gap-5 ${showSuggestionsPanel ? "lg:grid-cols-[260px_minmax(0,720px)_350px]" : "lg:grid-cols-[260px_minmax(0,720px)] lg:justify-center"}`}>
      <aside className="sticky top-28 hidden h-[calc(100vh-140px)] rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:block">
        <div className="mb-5 px-2">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-rose-500">Social Commerce</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white">Creaters Hub</h1>
        </div>
        <nav className="space-y-1">
          {HUB_ITEMS.map(([key, label, Icon]) => (
            <button key={key} onClick={() => navigate(key === "home" ? "/influencers" : `/influencers/${key}`)} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold ${section === key || (!params.section && key === "home") ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"}`}>
              {createElement(Icon, { className: "h-5 w-5" })}
              {label}
            </button>
          ))}
          <div className="relative">
            <button onClick={() => setMoreOpen((open) => !open)} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800">
              <MoreHorizontal className="h-5 w-5" />
              More
            </button>
            {moreOpen ? <MoreMenu /> : null}
          </div>
        </nav>
      </aside>

      <main className="min-w-0">
        <MobileHubNav section={section} navigate={navigate} />
        {section === "reels" ? (
          <ReelFeed />
        ) : (
          <HubContent
            section={section}
            loading={loading}
            query={query}
            setQuery={setQuery}
            creators={section === "trending" ? trendingCreators : creators}
            reels={reels}
            products={products}
            followedStores={followedStores}
            followedIds={followedIds}
            savedIds={savedIds}
            likedIds={likedIds}
            onFollow={toggleFollow}
            followBusy={followBusy}
            onSave={toggleSave}
            onLike={handleLike}
            onComment={openComments}
            onVisitStore={visitStore}
          />
        )}
      </main>

      {showSuggestionsPanel ? (
        <aside className="sticky top-28 hidden h-[calc(100vh-140px)] overflow-y-auto rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:block">
          <h2 className="text-lg font-black text-slate-950 dark:text-white">Suggested Creators</h2>
          <div className="mt-4 space-y-3">
            {suggestedCreators.map((creator) => <CreatorMini key={creator._id || creator.id || creator.username} creator={creator} followed={followedIds[influencerId(creator)]} busy={followBusy[influencerId(creator)]} onFollow={() => toggleFollow(creator)} />)}
          </div>
          <h2 className="mt-7 text-lg font-black text-slate-950 dark:text-white">Trending Products</h2>
          <div className="mt-4 space-y-3">
            {products.slice(0, 5).map((product) => <ProductMini key={product._id || product.id} product={product} />)}
          </div>
        </aside>
      ) : null}
      {loginPrompt ? <LoginPromptModal onClose={() => setLoginPrompt(false)} /> : null}
      {commentReel ? (
        <HomeCommentsModal
          reel={commentReel}
          isAuthenticated={isAuthenticated}
          onClose={() => setCommentReel(null)}
          onLoginRequired={() => setLoginPrompt(true)}
          onCommentCreated={(counts) => updateReelMetrics(commentReel._id, counts || {})}
        />
      ) : null}
    </div>
  );
}

function MobileHubNav({ section, navigate }) {
  return (
    <div className="mb-4 flex gap-2 overflow-x-auto lg:hidden">
      {HUB_ITEMS.map(([key, label, Icon]) => (
        <button key={key} onClick={() => navigate(key === "home" ? "/influencers" : `/influencers/${key}`)} className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${section === key || (!section && key === "home") ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300"}`}>
          {createElement(Icon, { className: "h-4 w-4" })}
          {label}
        </button>
      ))}
    </div>
  );
}

function MoreMenu() {
  const rows = ["Settings", "Your Activity", "Saved Posts", "Saved Reels", "Saved Products", "Saved Collections", "Following", "Recently Viewed", "Switch Appearance", "Report Problem", "Logout"];
  return (
    <div className="absolute bottom-0 left-full z-20 ml-2 w-64 rounded-3xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
      {rows.map((row) => <button key={row} className="block w-full rounded-2xl px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">{row}</button>)}
    </div>
  );
}

function LoginPromptModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Login required">
      <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black text-slate-950 dark:text-white">Join to follow creators</h2>
          <button onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">Log in or create an account to follow influencers, save content, and build your creator feed.</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Link to="/login" className="rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-black text-white dark:bg-white dark:text-slate-950">Login</Link>
          <Link to="/register" className="rounded-2xl border border-slate-200 px-4 py-3 text-center text-sm font-black text-slate-700 dark:border-slate-700 dark:text-slate-200">Register</Link>
        </div>
      </div>
    </div>
  );
}

function HomeCommentsModal({ reel, isAuthenticated, onClose, onLoginRequired, onCommentCreated }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listReelComments(reel._id, { limit: 30 })
      .then((response) => {
        if (!cancelled) setComments(response?.data?.items || []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [reel._id]);

  async function submitComment() {
    if (!text.trim()) return;
    if (!isAuthenticated) {
      onLoginRequired?.();
      return;
    }
    setBusy(true);
    try {
      const response = await createReelComment(reel._id, { text });
      const comment = response?.data?.comment;
      if (comment) setComments((current) => [comment, ...current]);
      setText("");
      onCommentCreated?.(response?.data?.engagement?.counts);
    } finally {
      setBusy(false);
    }
  }

  function userLabel(user = {}) {
    return user?.name || user?.email?.split?.("@")?.[0] || "User";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Comments">
      <div className="flex max-h-[86vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900 sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
          <div>
            <h2 className="font-black text-slate-950 dark:text-white">Comments</h2>
            <p className="text-xs font-bold text-slate-500">{compact(reel.metrics?.comments || comments.length)} comments</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close comments"><X className="h-4 w-4" /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {loading ? <div className="text-sm font-bold text-slate-500">Loading comments...</div> : null}
          {!loading && !comments.length ? <div className="text-sm font-bold text-slate-500">No comments yet.</div> : null}
          {comments.map((comment) => (
            <div key={comment._id} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950">
              <p className="text-sm font-black text-slate-950 dark:text-white">@{userLabel(comment.userId)}</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{comment.text}</p>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-200 p-4 dark:border-slate-800">
          <div className="flex gap-2">
            <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Add a comment..." className="min-w-0 flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
            <button type="button" disabled={busy || !text.trim()} onClick={submitComment} className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-white disabled:opacity-50 dark:bg-white dark:text-slate-950" aria-label="Post comment"><MessageCircle className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HubContent({ section, loading, query, setQuery, creators, reels, products, followedStores, followedIds, savedIds, likedIds, followBusy = {}, onFollow, onSave, onLike, onComment, onVisitStore }) {
  if (section === "search") {
    return (
      <FeedShell title="Search" subtitle="Find influencers, products, collections, stores, hashtags, campaigns, and categories.">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search creators, products, stores, hashtags" className="w-full rounded-3xl border border-slate-200 bg-white px-12 py-4 text-sm outline-none focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-950 dark:text-white" />
        </div>
        <CreatorGrid creators={creators} followedIds={followedIds} followBusy={followBusy} onFollow={onFollow} />
      </FeedShell>
    );
  }

  if (section === "explore") {
    return (
      <FeedShell title="Explore" subtitle="A Pinterest-style mix of creators, reels, products, campaigns, and collections.">
        <MasonryGrid creators={creators} reels={reels} products={products} />
      </FeedShell>
    );
  }

  if (section === "notifications") {
    return <FeedShell title="Notifications" subtitle="Creator updates, product recommendations, campaign content, follows, likes, and comments."><NotificationList /></FeedShell>;
  }

  if (section === "saved") {
    return (
      <FeedShell title="Saved" subtitle="Saved posts, reels, products, collections, influencers, and campaigns.">
        <PostFeed reels={reels.filter((row) => savedIds[row._id])} creators={creators} products={products} followedIds={followedIds} followBusy={followBusy} savedIds={savedIds} likedIds={likedIds} onFollow={onFollow} onSave={onSave} onLike={onLike} onComment={onComment} onVisitStore={onVisitStore} empty="No saved content yet." />
      </FeedShell>
    );
  }

  if (section === "following") {
    return (
      <FeedShell title="Following" subtitle="Followed influencers, followed collections, followed stores, and followed topics.">
        <CreatorGrid creators={creators.filter((row) => followedIds[influencerId(row)])} followedIds={followedIds} followBusy={followBusy} onFollow={onFollow} empty="Follow creators to build your social commerce feed." />
        <FollowedStores stores={followedStores} />
      </FeedShell>
    );
  }

  if (section === "trending") {
    return (
      <FeedShell title="Trending" subtitle="Creators, reels, products, collections, and campaigns ranked by engagement and revenue signals.">
        <CreatorGrid creators={creators} followedIds={followedIds} followBusy={followBusy} onFollow={onFollow} />
        <PostFeed reels={reels} creators={creators} products={products} followedIds={followedIds} followBusy={followBusy} savedIds={savedIds} likedIds={likedIds} onFollow={onFollow} onSave={onSave} onLike={onLike} onComment={onComment} onVisitStore={onVisitStore} />
      </FeedShell>
    );
  }

  return (
    <FeedShell title="Home" subtitle="Stories, creator posts, reels, product showcases, campaign promotions, and storefront updates.">
      <Stories creators={creators} />
      {loading ? <div className="rounded-3xl bg-white p-8 text-sm font-bold text-slate-500 dark:bg-slate-900">Loading creator feed...</div> : null}
      <PostFeed reels={reels} creators={creators} products={products} followedIds={followedIds} followBusy={followBusy} savedIds={savedIds} likedIds={likedIds} onFollow={onFollow} onSave={onSave} onLike={onLike} onComment={onComment} onVisitStore={onVisitStore} />
    </FeedShell>
  );
}

function FeedShell({ title, subtitle, children }) {
  return <div className="space-y-5"><div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h1 className="text-2xl font-black text-slate-950 dark:text-white">{title}</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{subtitle}</p></div>{children}</div>;
}

function Stories({ creators = [] }) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex gap-4 overflow-x-auto">
        {creators.slice(0, 12).map((creator) => (
          <Link key={creator._id || creator.id || creator.storeSlug || creator.username} to={influencerHref(creator)} className="w-20 shrink-0 text-center">
            <span className="mx-auto block h-16 w-16 rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-indigo-500 p-0.5"><span className="block h-full w-full overflow-hidden rounded-full bg-white p-0.5 dark:bg-slate-950">{influencerAvatar(creator) ? <img src={influencerAvatar(creator)} alt="" className="h-full w-full rounded-full object-cover" /> : null}</span></span>
            <span className="mt-2 block truncate text-xs font-bold text-slate-700 dark:text-slate-200">{creator.storeSlug || influencerName(creator)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function PostFeed({ reels = [], creators = [], products = [], followedIds, followBusy = {}, savedIds, likedIds = {}, onFollow, onSave, onLike, onComment, onVisitStore, empty = "No creator content found." }) {
  const mixed = reels.length ? reels : products.slice(0, 4).map((product) => ({ _id: product._id, products: [product], title: product.name, caption: "Creator product pick", metrics: {}, synthetic: true }));
  if (!mixed.length) return <div className="rounded-3xl bg-white p-8 text-center text-sm font-bold text-slate-500 dark:bg-slate-900">{empty}</div>;
  return (
    <section className="space-y-5">
      {mixed.map((post, index) => {
        const creator = post.influencerId && typeof post.influencerId === "object" ? post.influencerId : creators[index % Math.max(creators.length, 1)] || {};
        const id = post._id || `${index}`;
        const creatorId = influencerId(creator);
        const profileHref = influencerHref(creator);
        return (
          <article key={id} className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3 p-4">
              <Link to={profileHref} className="flex min-w-0 items-center gap-3">
                <span className="h-11 w-11 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">{influencerAvatar(creator) ? <img src={influencerAvatar(creator)} alt="" className="h-full w-full object-cover" /> : null}</span>
                <span className="min-w-0"><span className="block truncate text-sm font-black text-slate-950 dark:text-white">{influencerName(creator)}</span><span className="text-xs text-slate-500">{creator.category || creator.categories?.[0] || "Creator commerce"}</span></span>
              </Link>
              <button onClick={() => onFollow(creator)} disabled={followBusy[creatorId]} className={`rounded-full px-4 py-2 text-xs font-black ${followedIds[creatorId] ? "border border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200" : "bg-slate-950 text-white dark:bg-white dark:text-slate-950"}`}>{followBusy[creatorId] ? (followedIds[creatorId] ? "Unfollowing..." : "Following...") : followedIds[creatorId] ? "Following" : "Follow"}</button>
            </div>
            {post.videoUrl ? <video src={resolveApiAssetUrl(post.videoUrl)} poster={resolveApiAssetUrl(post.thumbnailUrl)} className="max-h-[680px] w-full bg-black object-cover" controls playsInline preload="metadata" /> : <ProductShowcase product={post.products?.[0]} />}
            <div className="space-y-3 p-4">
              <div className="flex items-center gap-4">
                <button type="button" onClick={() => onLike?.(post)} className={`inline-flex items-center gap-2 text-sm font-bold ${likedIds[id] ? "text-rose-600" : "text-slate-700 dark:text-slate-200"}`}><Heart className={`h-5 w-5 ${likedIds[id] ? "fill-current" : ""}`} /> {compact(post.metrics?.likes || 0)}</button>
                <button type="button" onClick={() => onComment?.(post)} className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200"><MessageCircle className="h-5 w-5" /> {compact(post.metrics?.comments || 0)}</button>
                <button type="button" onClick={() => onVisitStore?.(post, profileHref)} className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200"><Store className="h-5 w-5" /> Visit Store</button>
                <button onClick={() => onSave(id)} className="ml-auto text-slate-700 dark:text-slate-200"><Bookmark className={`h-5 w-5 ${savedIds[id] ? "fill-current" : ""}`} /></button>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-200"><Link to={profileHref} className="font-bold">{creator.storeSlug || influencerName(creator)}</Link> {post.caption || post.title || "Creator commerce update"}</p>
              {post.products?.length ? <div className="flex gap-2 overflow-x-auto">{post.products.slice(0, 4).map((product) => <ProductChip key={product._id || product.id} product={product} />)}</div> : null}
            </div>
          </article>
        );
      })}
    </section>
  );
}

function ProductShowcase({ product }) {
  return <div className="flex aspect-square items-center justify-center bg-slate-100 dark:bg-slate-950">{product ? <img src={productImage(product)} alt="" className="h-full w-full object-cover" /> : <Video className="h-10 w-10 text-slate-400" />}</div>;
}

function ProductChip({ product }) {
  return <Link to={`/product/${product._id || product.id}`} className="flex min-w-[220px] items-center gap-3 rounded-2xl bg-slate-50 p-2 dark:bg-slate-950"><img src={productImage(product)} alt="" className="h-12 w-12 rounded-xl object-cover" /><span className="min-w-0"><span className="block truncate text-sm font-black text-slate-950 dark:text-white">{product.name}</span><span className="text-xs font-bold text-rose-600">{formatCurrency(product.discountPrice || product.price || 0)}</span></span></Link>;
}

function CreatorGrid({ creators = [], followedIds, followBusy = {}, onFollow, empty = "No creators found." }) {
  if (!creators.length) return <div className="rounded-3xl bg-white p-8 text-center text-sm font-bold text-slate-500 dark:bg-slate-900">{empty}</div>;
  return <section className="grid gap-4 sm:grid-cols-2">{creators.map((creator) => <CreatorCard key={creator._id || creator.id || creator.username} creator={creator} followed={followedIds[influencerId(creator)]} busy={followBusy[influencerId(creator)]} onFollow={() => onFollow(creator)} />)}</section>;
}

function CreatorCard({ creator, followed, busy, onFollow }) {
  return (
    <article className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <Link to={influencerHref(creator)} className="flex items-center gap-3">
        <div className="h-16 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">{influencerAvatar(creator) ? <img src={influencerAvatar(creator)} alt="" className="h-full w-full object-cover" /> : null}</div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-black text-slate-950 dark:text-white">{influencerName(creator)}</h3>
          <p className="text-xs text-slate-500">@{creator.username || "creator"} · {compact(creator.followers || 0)} followers</p>
        </div>
      </Link>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button onClick={onFollow} disabled={busy} className={`rounded-2xl px-4 py-2 text-sm font-black ${followed ? "border border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200" : "bg-slate-950 text-white dark:bg-white dark:text-slate-950"}`}>{busy ? (followed ? "Unfollowing..." : "Following...") : followed ? "Following" : "Follow"}</button>
        <Link to={influencerHref(creator)} className="rounded-2xl border border-slate-200 px-4 py-2 text-center text-sm font-black text-slate-700 dark:border-slate-700 dark:text-slate-200">Profile</Link>
      </div>
    </article>
  );
}

function CreatorMini({ creator, followed, busy, onFollow }) {
  return (
    <div className="flex items-center gap-3">
      <Link to={influencerHref(creator)} className="h-11 w-11 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        {influencerAvatar(creator) ? <img src={influencerAvatar(creator)} alt="" className="h-full w-full object-cover" /> : null}
      </Link>
      <Link to={influencerHref(creator)} className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-slate-950 dark:text-white">{influencerName(creator)}</p>
        <p className="text-xs text-slate-500">{compact(creator.followers || 0)} followers</p>
      </Link>
      <button onClick={onFollow} disabled={busy} className="text-xs font-black text-indigo-600">{busy ? (followed ? "Unfollowing..." : "Following...") : followed ? "Following" : "Follow"}</button>
    </div>
  );
}

function ProductMini({ product }) {
  return <Link to={`/product/${product._id || product.id}`} className="flex items-center gap-3"><img src={productImage(product)} alt="" className="h-12 w-12 rounded-xl object-cover" /><span className="min-w-0"><span className="block truncate text-sm font-black text-slate-950 dark:text-white">{product.name}</span><span className="text-xs font-bold text-rose-600">{formatCurrency(product.discountPrice || product.price || 0)}</span></span></Link>;
}

function MasonryGrid({ creators = [], reels = [], products = [] }) {
  const cells = [...reels.slice(0, 8), ...products.slice(0, 8), ...creators.slice(0, 8)];
  return (
    <section className="columns-2 gap-3 md:columns-3">
      {cells.map((item, index) => {
        const content = (
          <>
            {item.videoUrl ? <video src={resolveApiAssetUrl(item.videoUrl)} className="w-full bg-black object-cover" muted loop playsInline /> : <img src={productImage(item) || influencerAvatar(item)} alt="" className="min-h-36 w-full object-cover" />}
            <div className="p-3 text-sm font-black text-slate-950 dark:text-white">{item.name || item.title || item.storeSlug || "Explore"}</div>
          </>
        );
        const href = influencerSlug(item) ? influencerHref(item) : "";
        return href ? (
          <Link key={item._id || item.id || index} to={href} className="mb-3 block break-inside-avoid overflow-hidden rounded-3xl bg-white shadow-sm dark:bg-slate-900">{content}</Link>
        ) : (
          <div key={item._id || item.id || index} className="mb-3 break-inside-avoid overflow-hidden rounded-3xl bg-white shadow-sm dark:bg-slate-900">{content}</div>
        );
      })}
    </section>
  );
}

function NotificationList() {
  const rows = ["New campaign reel from a creator you follow", "A saved product is trending", "Recommended creator posted a product showcase", "Storefront update from followed store"];
  return <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">{rows.map((row) => <div key={row} className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-b-0 dark:border-slate-800"><Bell className="h-5 w-5 text-indigo-500" /><span className="text-sm font-bold text-slate-700 dark:text-slate-200">{row}</span></div>)}</section>;
}

function FollowedStores({ stores = [] }) {
  if (!stores.length) return null;
  return <section className="mt-5 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h2 className="font-black text-slate-950 dark:text-white">Followed Stores</h2><div className="mt-3 grid gap-3">{stores.map((store) => <Link key={store.storeSlug || store._id || store.id} to={`/vendor/${store.storeSlug}`} className="text-sm font-bold text-slate-700 dark:text-slate-200">{store.shopName || store.companyName || store.name || "Store"}</Link>)}</div></section>;
}
