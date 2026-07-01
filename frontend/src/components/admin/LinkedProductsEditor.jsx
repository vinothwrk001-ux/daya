import { useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, Star, X } from "lucide-react";
import { listProducts } from "../../services/adminApi";
import { REEL_MAX_LINKED_PRODUCTS } from "../../utils/reelProducts";

function normalizeLinkedItem(item) {
  const product = item.product || item;
  const productId = item.productId || product._id || item.value;
  return {
    productId: String(productId),
    sortOrder: item.sortOrder ?? 0,
    featured: Boolean(item.featured),
    active: item.active !== false,
    name: product.name || item.label || "Product",
    sku: product.sku || "",
    price: product.salePrice ?? product.price ?? 0,
    image: product.images?.[0]?.url || product.images?.[0] || null,
    category: typeof product.category === "object" ? product.category?.name : product.category || "",
  };
}

export function LinkedProductsEditor({ value = [], onChange, disabled = false }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const containerRef = useRef(null);

  const items = useMemo(() => value.map(normalizeLinkedItem), [value]);

  useEffect(() => {
    let active = true;
    const timeoutId = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await listProducts({ search: searchTerm, limit: 20 });
        const products = response?.data?.products || response?.products || [];
        if (!active) return;
        setOptions(
          products.map((product) => ({
            productId: String(product._id),
            name: product.name,
            sku: product.sku || "",
            price: product.salePrice ?? product.price ?? 0,
            image: product.images?.[0]?.url || product.images?.[0] || null,
            category: typeof product.category === "object" ? product.category?.name : product.category || "",
          }))
        );
      } catch {
        if (active) setOptions([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [searchTerm]);

  const selectedIds = new Set(items.map((item) => item.productId));
  const availableOptions = options.filter((option) => !selectedIds.has(option.productId));

  function emit(nextItems) {
    onChange(
      nextItems.map((item, index) => ({
        productId: item.productId,
        sortOrder: index,
        featured: Boolean(item.featured),
        active: item.active !== false,
        product: {
          _id: item.productId,
          name: item.name,
          sku: item.sku,
          price: item.price,
          images: item.image ? [{ url: item.image }] : [],
          category: item.category,
        },
      }))
    );
  }

  function addProduct(option) {
    if (disabled || items.length >= REEL_MAX_LINKED_PRODUCTS) return;
    emit([
      ...items,
      {
        ...option,
        sortOrder: items.length,
        featured: items.length === 0,
        active: true,
      },
    ]);
    setSearchTerm("");
  }

  function removeProduct(productId) {
    if (disabled) return;
    const next = items.filter((item) => item.productId !== productId);
    if (next.length && !next.some((item) => item.featured)) {
      next[0].featured = true;
    }
    emit(next);
  }

  function toggleFeatured(productId) {
    if (disabled) return;
    emit(items.map((item) => ({ ...item, featured: item.productId === productId })));
  }

  function handleDrop(targetIndex) {
    if (dragIndex == null || dragIndex === targetIndex) {
      setDragIndex(null);
      return;
    }
    const next = [...items];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    emit(next);
    setDragIndex(null);
  }

  return (
    <div ref={containerRef} className="space-y-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">Linked Products</p>
          <p className="text-xs text-slate-500">Search by name, SKU, product ID, or category.</p>
        </div>
        <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700 dark:bg-orange-950 dark:text-orange-300">
          Selected ({items.length}/{REEL_MAX_LINKED_PRODUCTS})
        </span>
      </div>

      <input
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
        placeholder="Search products..."
        disabled={disabled}
        className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
      />

      {loading ? <p className="text-xs text-slate-500">Searching products...</p> : null}

      {availableOptions.length ? (
        <div className="max-h-44 space-y-2 overflow-y-auto rounded-xl border border-dashed border-slate-200 p-2 dark:border-slate-700">
          {availableOptions.map((option) => (
            <button
              key={option.productId}
              type="button"
              disabled={disabled || items.length >= REEL_MAX_LINKED_PRODUCTS}
              onClick={() => addProduct(option)}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-900"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded border border-slate-300 text-xs dark:border-slate-600">
                +
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{option.name}</p>
                <p className="text-xs text-slate-500">
                  {option.sku || option.productId}
                  {option.category ? ` · ${option.category}` : ""}
                </p>
              </div>
            </button>
          ))}
        </div>
      ) : null}

      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={item.productId}
            draggable={!disabled}
            onDragStart={() => setDragIndex(index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => handleDrop(index)}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
          >
            <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-slate-400" />
            {item.image ? (
              <img src={item.image} alt="" className="h-12 w-12 rounded-lg object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-xs dark:bg-slate-800">
                IMG
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{item.name}</p>
              <p className="text-xs text-slate-500">{item.sku || item.productId}</p>
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={() => toggleFeatured(item.productId)}
              className={`rounded-full p-2 ${item.featured ? "bg-amber-100 text-amber-700" : "text-slate-400 hover:bg-slate-100"}`}
              title="Mark featured"
            >
              <Star className={`h-4 w-4 ${item.featured ? "fill-current" : ""}`} />
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => removeProduct(item.productId)}
              className="rounded-full p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {items.length ? (
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Preview</p>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-2 text-white">
            <span>🛒</span>
            <span className="text-xs font-bold">
              {items.length} Product{items.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">No linked products yet.</p>
      )}
    </div>
  );
}
