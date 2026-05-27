import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { ReelFeed } from "../components/reel/ReelFeed";
import { listAffiliateProducts, listInfluencers, getReelFeed } from "../services/influencerCommerceService";
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
  const section = params.section || "home";
  const [creators, setCreators] = useState([]);
  const [reels, setReels] = useState([]);
  const [products, setProducts] = useState([]);
  const [followedStores, setFollowedStores] = useState([]);
  const [savedIds, setSavedIds] = useState({});
  const [followedIds, setFollowedIds] = useState({});
  const [moreOpen, setMoreOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [creatorRes, reelRes, productRes, followedRes] = await Promise.allSettled([
          listInfluencers({ search: query, limit: 24 }),
          getReelFeed({ tab: section === "trending" ? "trending" : "for_you", limit: 12 }),
          listAffiliateProducts({ search: query, limit: 12 }),
          getMyFollowedStores({ limit: 12 }),
        ]);
        if (cancelled) return;
        if (creatorRes.status === "fulfilled") setCreators(normalizeInfluencers(creatorRes.value));
        if (reelRes.status === "fulfilled") setReels(reelRes.value?.data?.items || reelRes.value?.data || []);
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

  function toggleFollow(id) {
    setFollowedIds((current) => ({ ...current, [id]: !current[id] }));
  }

  function toggleSave(id) {
    setSavedIds((current) => ({ ...current, [id]: !current[id] }));
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
              <Icon className="h-5 w-5" />
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
            onFollow={toggleFollow}
            onSave={toggleSave}
          />
        )}
      </main>

      {showSuggestionsPanel ? (
        <aside className="sticky top-28 hidden h-[calc(100vh-140px)] overflow-y-auto rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:block">
          <h2 className="text-lg font-black text-slate-950 dark:text-white">Suggested Creators</h2>
          <div className="mt-4 space-y-3">
            {suggestedCreators.map((creator) => <CreatorMini key={creator._id || creator.id || creator.username} creator={creator} followed={followedIds[creator._id || creator.id]} onFollow={() => toggleFollow(creator._id || creator.id)} />)}
          </div>
          <h2 className="mt-7 text-lg font-black text-slate-950 dark:text-white">Trending Products</h2>
          <div className="mt-4 space-y-3">
            {products.slice(0, 5).map((product) => <ProductMini key={product._id || product.id} product={product} />)}
          </div>
        </aside>
      ) : null}
    </div>
  );
}

function MobileHubNav({ section, navigate }) {
  return (
    <div className="mb-4 flex gap-2 overflow-x-auto lg:hidden">
      {HUB_ITEMS.map(([key, label, Icon]) => (
        <button key={key} onClick={() => navigate(key === "home" ? "/influencers" : `/influencers/${key}`)} className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${section === key || (!section && key === "home") ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300"}`}>
          <Icon className="h-4 w-4" />
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

function HubContent({ section, loading, query, setQuery, creators, reels, products, followedStores, followedIds, savedIds, onFollow, onSave }) {
  if (section === "search") {
    return (
      <FeedShell title="Search" subtitle="Find influencers, products, collections, stores, hashtags, campaigns, and categories.">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search creators, products, stores, hashtags" className="w-full rounded-3xl border border-slate-200 bg-white px-12 py-4 text-sm outline-none focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-950 dark:text-white" />
        </div>
        <CreatorGrid creators={creators} followedIds={followedIds} onFollow={onFollow} />
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
        <PostFeed reels={reels.filter((row) => savedIds[row._id])} creators={creators} products={products} followedIds={followedIds} savedIds={savedIds} onFollow={onFollow} onSave={onSave} empty="No saved content yet." />
      </FeedShell>
    );
  }

  if (section === "following") {
    return (
      <FeedShell title="Following" subtitle="Followed influencers, followed collections, followed stores, and followed topics.">
        <CreatorGrid creators={creators.filter((row) => followedIds[row._id || row.id])} followedIds={followedIds} onFollow={onFollow} empty="Follow creators to build your social commerce feed." />
        <FollowedStores stores={followedStores} />
      </FeedShell>
    );
  }

  if (section === "trending") {
    return (
      <FeedShell title="Trending" subtitle="Creators, reels, products, collections, and campaigns ranked by engagement and revenue signals.">
        <CreatorGrid creators={creators} followedIds={followedIds} onFollow={onFollow} />
        <PostFeed reels={reels} creators={creators} products={products} followedIds={followedIds} savedIds={savedIds} onFollow={onFollow} onSave={onSave} />
      </FeedShell>
    );
  }

  return (
    <FeedShell title="Home" subtitle="Stories, creator posts, reels, product showcases, campaign promotions, and storefront updates.">
      <Stories creators={creators} />
      {loading ? <div className="rounded-3xl bg-white p-8 text-sm font-bold text-slate-500 dark:bg-slate-900">Loading creator feed...</div> : null}
      <PostFeed reels={reels} creators={creators} products={products} followedIds={followedIds} savedIds={savedIds} onFollow={onFollow} onSave={onSave} />
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
          <button key={creator._id || creator.id || creator.username} className="w-20 shrink-0 text-center">
            <span className="mx-auto block h-16 w-16 rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-indigo-500 p-0.5"><span className="block h-full w-full overflow-hidden rounded-full bg-white p-0.5 dark:bg-slate-950">{influencerAvatar(creator) ? <img src={influencerAvatar(creator)} alt="" className="h-full w-full rounded-full object-cover" /> : null}</span></span>
            <span className="mt-2 block truncate text-xs font-bold text-slate-700 dark:text-slate-200">{creator.username || influencerName(creator)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function PostFeed({ reels = [], creators = [], products = [], followedIds, savedIds, onFollow, onSave, empty = "No creator content found." }) {
  const mixed = reels.length ? reels : products.slice(0, 4).map((product) => ({ _id: product._id, products: [product], title: product.name, caption: "Creator product pick", metrics: {}, synthetic: true }));
  if (!mixed.length) return <div className="rounded-3xl bg-white p-8 text-center text-sm font-bold text-slate-500 dark:bg-slate-900">{empty}</div>;
  return (
    <section className="space-y-5">
      {mixed.map((post, index) => {
        const creator = creators[index % Math.max(creators.length, 1)] || {};
        const id = post._id || `${index}`;
        return (
          <article key={id} className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3 p-4">
              <Link to={`/influencer/${creator.username || creator._id || ""}`} className="flex min-w-0 items-center gap-3">
                <span className="h-11 w-11 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">{influencerAvatar(creator) ? <img src={influencerAvatar(creator)} alt="" className="h-full w-full object-cover" /> : null}</span>
                <span className="min-w-0"><span className="block truncate text-sm font-black text-slate-950 dark:text-white">{influencerName(creator)}</span><span className="text-xs text-slate-500">{creator.category || creator.categories?.[0] || "Creator commerce"}</span></span>
              </Link>
              <button onClick={() => onFollow(creator._id || creator.id || id)} className="rounded-full border border-slate-200 px-4 py-2 text-xs font-black text-slate-700 dark:border-slate-700 dark:text-slate-200">{followedIds[creator._id || creator.id || id] ? "Following" : "Follow"}</button>
            </div>
            {post.videoUrl ? <video src={resolveApiAssetUrl(post.videoUrl)} poster={resolveApiAssetUrl(post.thumbnailUrl)} className="max-h-[680px] w-full bg-black object-cover" controls playsInline preload="metadata" /> : <ProductShowcase product={post.products?.[0]} />}
            <div className="space-y-3 p-4">
              <div className="flex items-center gap-4">
                <button className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200"><Heart className="h-5 w-5" /> {compact(post.metrics?.likes || 0)}</button>
                <button className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200"><MessageCircle className="h-5 w-5" /> {compact(post.metrics?.comments || 0)}</button>
                <button className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200"><Store className="h-5 w-5" /> Visit Store</button>
                <button onClick={() => onSave(id)} className="ml-auto text-slate-700 dark:text-slate-200"><Bookmark className={`h-5 w-5 ${savedIds[id] ? "fill-current" : ""}`} /></button>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-200"><b>{creator.username || influencerName(creator)}</b> {post.caption || post.title || "Creator commerce update"}</p>
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

function CreatorGrid({ creators = [], followedIds, onFollow, empty = "No creators found." }) {
  if (!creators.length) return <div className="rounded-3xl bg-white p-8 text-center text-sm font-bold text-slate-500 dark:bg-slate-900">{empty}</div>;
  return <section className="grid gap-4 sm:grid-cols-2">{creators.map((creator) => <CreatorCard key={creator._id || creator.id || creator.username} creator={creator} followed={followedIds[creator._id || creator.id]} onFollow={() => onFollow(creator._id || creator.id)} />)}</section>;
}

function CreatorCard({ creator, followed, onFollow }) {
  return (
    <article className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <div className="h-16 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">{influencerAvatar(creator) ? <img src={influencerAvatar(creator)} alt="" className="h-full w-full object-cover" /> : null}</div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-black text-slate-950 dark:text-white">{influencerName(creator)}</h3>
          <p className="text-xs text-slate-500">@{creator.username || "creator"} · {compact(creator.followers || 0)} followers</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button onClick={onFollow} className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white dark:bg-white dark:text-slate-950">{followed ? "Following" : "Follow"}</button>
        <Link to={`/influencer/${creator.username || creator._id || creator.id}`} className="rounded-2xl border border-slate-200 px-4 py-2 text-center text-sm font-black text-slate-700 dark:border-slate-700 dark:text-slate-200">Profile</Link>
      </div>
    </article>
  );
}

function CreatorMini({ creator, followed, onFollow }) {
  return <div className="flex items-center gap-3"><div className="h-11 w-11 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">{influencerAvatar(creator) ? <img src={influencerAvatar(creator)} alt="" className="h-full w-full object-cover" /> : null}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-slate-950 dark:text-white">{influencerName(creator)}</p><p className="text-xs text-slate-500">{compact(creator.followers || 0)} followers</p></div><button onClick={onFollow} className="text-xs font-black text-indigo-600">{followed ? "Following" : "Follow"}</button></div>;
}

function ProductMini({ product }) {
  return <Link to={`/product/${product._id || product.id}`} className="flex items-center gap-3"><img src={productImage(product)} alt="" className="h-12 w-12 rounded-xl object-cover" /><span className="min-w-0"><span className="block truncate text-sm font-black text-slate-950 dark:text-white">{product.name}</span><span className="text-xs font-bold text-rose-600">{formatCurrency(product.discountPrice || product.price || 0)}</span></span></Link>;
}

function MasonryGrid({ creators = [], reels = [], products = [] }) {
  const cells = [...reels.slice(0, 8), ...products.slice(0, 8), ...creators.slice(0, 8)];
  return <section className="columns-2 gap-3 md:columns-3">{cells.map((item, index) => <div key={item._id || item.id || index} className="mb-3 break-inside-avoid overflow-hidden rounded-3xl bg-white shadow-sm dark:bg-slate-900">{item.videoUrl ? <video src={resolveApiAssetUrl(item.videoUrl)} className="w-full bg-black object-cover" muted loop playsInline /> : <img src={productImage(item) || influencerAvatar(item)} alt="" className="min-h-36 w-full object-cover" />}<div className="p-3 text-sm font-black text-slate-950 dark:text-white">{item.name || item.title || item.username || "Explore"}</div></div>)}</section>;
}

function NotificationList() {
  const rows = ["New campaign reel from a creator you follow", "A saved product is trending", "Recommended creator posted a product showcase", "Storefront update from followed store"];
  return <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">{rows.map((row) => <div key={row} className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-b-0 dark:border-slate-800"><Bell className="h-5 w-5 text-indigo-500" /><span className="text-sm font-bold text-slate-700 dark:text-slate-200">{row}</span></div>)}</section>;
}

function FollowedStores({ stores = [] }) {
  if (!stores.length) return null;
  return <section className="mt-5 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h2 className="font-black text-slate-950 dark:text-white">Followed Stores</h2><div className="mt-3 grid gap-3">{stores.map((store) => <Link key={store.storeSlug || store._id || store.id} to={`/vendor/${store.storeSlug}`} className="text-sm font-bold text-slate-700 dark:text-slate-200">{store.shopName || store.companyName || store.name || "Store"}</Link>)}</div></section>;
}
