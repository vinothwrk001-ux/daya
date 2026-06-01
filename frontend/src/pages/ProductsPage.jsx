import { useEffect, useMemo, useState, memo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronDown, Heart, ShoppingCart } from "lucide-react";
import { BackButton } from "../components/BackButton";
import { useCategories } from "../hooks/useCategories";
import { getSubcategoriesByCategory } from "../services/subcategoryService";
import * as productService from "../services/productService";
import { formatCurrency } from "../utils/formatCurrency";
import { extractProductId, getAvailableProductVariant } from "../utils/cartState";
import { useCart } from "../hooks/useCart";
import { useCartDrawer } from "../hooks/useCartDrawer";
import { useWishlist } from "../hooks/useWishlist";
import { getCartErrorMessage } from "../utils/cartErrors";


const RESERVED_QUERY_KEYS = new Set([
  "category",
  "categoryId",
  "subCategoryId",
  "search",
  "minPrice",
  "maxPrice",
  "sortBy",
  "sortOrder",
  "page",
]);

function toRangeKeys(key) {
  const capitalized = key.charAt(0).toUpperCase() + key.slice(1);
  return {
    minKey: `min${capitalized}`,
    maxKey: `max${capitalized}`,
  };
}

function getCheckboxValues(searchParams, key) {
  const all = searchParams.getAll(key);
  if (all.length > 1) return all;
  if (all.length === 1) {
    return all[0]
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function buildDynamicQueryParams(searchParams) {
  const dynamic = {};
  for (const [key, value] of searchParams.entries()) {
    if (RESERVED_QUERY_KEYS.has(key)) continue;
    dynamic[key] = dynamic[key] ? `${dynamic[key]},${value}` : value;
  }
  return dynamic;
}

export function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { categories } = useCategories();

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState("");
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [showFilters, setShowFilters] = useState(false);
  const [filterDefs, setFilterDefs] = useState([]);
  const [facetMap, setFacetMap] = useState({});
  const [subcategories, setSubcategories] = useState([]);

  const category = searchParams.get("category") || "";
  const matchedCategory = categories.find(
    (item) => item._id === searchParams.get("categoryId") || item.name === category
  );
  const categoryId = searchParams.get("categoryId") || matchedCategory?._id || "";
  const subCategoryId = searchParams.get("subCategoryId") || "";
  const search = searchParams.get("search") || "";
  const minPrice = searchParams.get("minPrice") || "";
  const maxPrice = searchParams.get("maxPrice") || "";
  const sortBy = searchParams.get("sortBy") || "createdAt";
  const sortOrder = searchParams.get("sortOrder") || "desc";
  const page = parseInt(searchParams.get("page") || "1", 10);

  const dynamicParams = useMemo(() => buildDynamicQueryParams(searchParams), [searchParams]);

  useEffect(() => {
    if (!categoryId) {
      setSubcategories([]);
      return;
    }

    let alive = true;
    (async () => {
      try {
        const response = await getSubcategoriesByCategory(categoryId);
        if (!alive) return;
        setSubcategories(Array.isArray(response?.data) ? response.data : []);
      } catch {
        if (alive) setSubcategories([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [categoryId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const response = await productService.getPublicProductFilters({
          ...(category && { category }),
          ...(categoryId && { categoryId }),
          ...(subCategoryId && { subCategoryId }),
          ...(search && { search }),
          ...(minPrice && { minPrice: Number(minPrice) }),
          ...(maxPrice && { maxPrice: Number(maxPrice) }),
          ...dynamicParams,
        });
        if (!alive) return;
        setFilterDefs(Array.isArray(response?.data?.filters) ? response.data.filters : []);
        const nextFacetMap = Object.fromEntries((response?.data?.facets || []).map((facet) => [facet.key, facet]));
        setFacetMap((prev) => ({ ...prev, ...nextFacetMap }));
      } catch {
        if (alive) setFilterDefs([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [category, categoryId, subCategoryId, search, minPrice, maxPrice, dynamicParams]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const params = {
          page,
          limit: 12,
          ...(category && { category }),
          ...(categoryId && { categoryId }),
          ...(subCategoryId && { subCategoryId }),
          ...(search && { search }),
          ...(minPrice && { minPrice: Number(minPrice) }),
          ...(maxPrice && { maxPrice: Number(maxPrice) }),
          sortBy,
          sortOrder,
          ...dynamicParams,
        };

        const response = await productService.getPublicProducts(params);
        if (!alive) return;
        setProducts(response?.data?.products || []);
        setPagination(response?.data?.pagination || { total: 0, pages: 1 });
        setFacetMap(
          Object.fromEntries(
            (response?.data?.facets || []).map((facet) => [facet.key, facet])
          )
        );
      } catch (err) {
        if (alive) setError(err?.response?.data?.message || "Failed to load products");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [page, category, categoryId, subCategoryId, search, minPrice, maxPrice, sortBy, sortOrder, dynamicParams]);

  function updateParams(mutator) {
    const next = new URLSearchParams(searchParams);
    mutator(next);
    if (!next.get("page")) next.set("page", "1");
    setSearchParams(next);
  }

  function clearDynamicFilters(next) {
    [...next.keys()].forEach((key) => {
      if (!RESERVED_QUERY_KEYS.has(key)) next.delete(key);
    });
  }

  const appliedFilterChips = useMemo(() => {
    const chips = [];
    if (search) chips.push({ key: "search", label: `Search: ${search}` });
    if (category) chips.push({ key: "category", label: `Category: ${category}` });
    const selectedSubcategory = subcategories.find((item) => item._id === subCategoryId);
    if (selectedSubcategory) chips.push({ key: "subCategoryId", label: `Subcategory: ${selectedSubcategory.name}` });
    if (minPrice || maxPrice) chips.push({ key: "price", label: `Price: ${minPrice || 0} - ${maxPrice || "Any"}` });

    for (const def of filterDefs) {
      if (["price", "rating"].includes(def.key)) continue;
      if (def.type === "range") {
        const { minKey, maxKey } = toRangeKeys(def.key);
        const min = searchParams.get(minKey);
        const max = searchParams.get(maxKey);
        if (min || max) chips.push({ key: def.key, label: `${def.name}: ${min || 0} - ${max || "Any"}` });
        continue;
      }

      const values = getCheckboxValues(searchParams, def.key);
      if (values.length) chips.push({ key: def.key, label: `${def.name}: ${values.join(", ")}` });
      const singleValue = searchParams.get(def.key);
      if (!values.length && singleValue) chips.push({ key: def.key, label: `${def.name}: ${singleValue}` });
    }

    return chips;
  }, [category, filterDefs, maxPrice, minPrice, search, searchParams, subCategoryId, subcategories]);

  return (
    <div className="grid gap-4 sm:gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Shop Products</h1>
          <p className="mt-1 text-xs text-slate-600 sm:text-sm">
            Dynamic category filters, shareable URLs, and real-time storefront facets.
          </p>
        </div>
        <BackButton />
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400 sm:text-sm">
          {error}
        </div>
      ) : null}

      {appliedFilterChips.length ? (
        <div className="flex flex-wrap gap-2">
          {appliedFilterChips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() =>
                updateParams((next) => {
                  if (chip.key === "price") {
                    next.delete("minPrice");
                    next.delete("maxPrice");
                  } else if (filterDefs.some((def) => def.key === chip.key && def.type === "range")) {
                    const { minKey, maxKey } = toRangeKeys(chip.key);
                    next.delete(minKey);
                    next.delete(maxKey);
                  } else {
                    next.delete(chip.key);
                  }
                  next.set("page", "1");
                })
              }
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm"
            >
              {chip.label} ×
            </button>
          ))}
          <button
            type="button"
            onClick={() =>
              updateParams((next) => {
                next.delete("search");
                next.delete("category");
                next.delete("categoryId");
                next.delete("subCategoryId");
                next.delete("minPrice");
                next.delete("maxPrice");
                clearDynamicFilters(next);
                next.set("sortBy", "createdAt");
                next.set("sortOrder", "desc");
                next.set("page", "1");
              })
            }
            className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            Clear all
          </button>
        </div>
      ) : null}

      <div className="grid gap-3 sm:gap-4 lg:grid-cols-6">
        <div className="hidden lg:block lg:col-span-1">
          <div className="sticky top-4">
            <FilterSidebar
            categories={categories}
            category={category}
            categoryId={categoryId}
            subCategoryId={subCategoryId}
            subcategories={subcategories}
            search={search}
            minPrice={minPrice}
            maxPrice={maxPrice}
            sortBy={sortBy}
            sortOrder={sortOrder}
            filterDefs={filterDefs}
            facetMap={facetMap}
            searchParams={searchParams}
            onCategoryChange={(nextCategoryId) =>
              updateParams((next) => {
                const selectedCategory = categories.find((item) => item._id === nextCategoryId);
                if (selectedCategory) {
                  next.set("categoryId", selectedCategory._id);
                  next.set("category", selectedCategory.name);
                } else {
                  next.delete("categoryId");
                  next.delete("category");
                }
                next.delete("subCategoryId");
                clearDynamicFilters(next);
                next.set("page", "1");
              })
            }
            onSubcategoryChange={(nextSubCategoryId) =>
              updateParams((next) => {
                if (nextSubCategoryId) next.set("subCategoryId", nextSubCategoryId);
                else next.delete("subCategoryId");
                clearDynamicFilters(next);
                next.set("page", "1");
              })
            }
            onSearchChange={(value) =>
              updateParams((next) => {
                if (value) next.set("search", value);
                else next.delete("search");
                next.set("page", "1");
              })
            }
            onPriceChange={(nextMin, nextMax) =>
              updateParams((next) => {
                if (nextMin !== "" && nextMin !== null && nextMin !== undefined) next.set("minPrice", String(nextMin));
                else next.delete("minPrice");
                if (nextMax !== "" && nextMax !== null && nextMax !== undefined) next.set("maxPrice", String(nextMax));
                else next.delete("maxPrice");
                next.set("page", "1");
              })
            }
            onSortChange={(nextSortBy) =>
              updateParams((next) => {
                next.set("sortBy", nextSortBy);
                next.set("sortOrder", nextSortBy === "createdAt" ? "desc" : "asc");
                next.set("page", "1");
              })
            }
            onFilterChange={(filterKey, value, type) =>
              updateParams((next) => {
                if (type === "checkbox") {
                  if (Array.isArray(value) && value.length) next.set(filterKey, value.join(","));
                  else next.delete(filterKey);
                } else if (type === "range") {
                  const { minKey, maxKey } = toRangeKeys(filterKey);
                  if (value?.min !== "" && value?.min !== undefined) next.set(minKey, String(value.min));
                  else next.delete(minKey);
                  if (value?.max !== "" && value?.max !== undefined) next.set(maxKey, String(value.max));
                  else next.delete(maxKey);
                } else {
                  if (value) next.set(filterKey, value);
                  else next.delete(filterKey);
                }
                next.set("page", "1");
              })
            }
          />
        </div>

        <div className="lg:hidden">
          <button
            onClick={() => setShowFilters((prev) => !prev)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800 sm:text-sm"
          >
            {showFilters ? "Hide Filters" : "Show Filters"}
          </button>
          {showFilters ? (
            <div className="mt-3">
              <FilterSidebar
                categories={categories}
                category={category}
                categoryId={categoryId}
                subCategoryId={subCategoryId}
                subcategories={subcategories}
                search={search}
                minPrice={minPrice}
                maxPrice={maxPrice}
                sortBy={sortBy}
                sortOrder={sortOrder}
                filterDefs={filterDefs}
                facetMap={facetMap}
                searchParams={searchParams}
                onCategoryChange={(value) =>
                  updateParams((next) => {
                    const selectedCategory = categories.find((item) => item._id === value);
                    if (selectedCategory) {
                      next.set("categoryId", selectedCategory._id);
                      next.set("category", selectedCategory.name);
                    } else {
                      next.delete("categoryId");
                      next.delete("category");
                    }
                    next.delete("subCategoryId");
                    clearDynamicFilters(next);
                    next.set("page", "1");
                  })
                }
                onSubcategoryChange={(value) =>
                  updateParams((next) => {
                    if (value) next.set("subCategoryId", value);
                    else next.delete("subCategoryId");
                    clearDynamicFilters(next);
                    next.set("page", "1");
                  })
                }
                onSearchChange={(value) =>
                  updateParams((next) => {
                    if (value) next.set("search", value);
                    else next.delete("search");
                    next.set("page", "1");
                  })
                }
                onPriceChange={(nextMin, nextMax) =>
                  updateParams((next) => {
                    if (nextMin !== "" && nextMin !== null && nextMin !== undefined) next.set("minPrice", String(nextMin));
                    else next.delete("minPrice");
                    if (nextMax !== "" && nextMax !== null && nextMax !== undefined) next.set("maxPrice", String(nextMax));
                    else next.delete("maxPrice");
                    next.set("page", "1");
                  })
                }
                onSortChange={(nextSortBy) =>
                  updateParams((next) => {
                    next.set("sortBy", nextSortBy);
                    next.set("sortOrder", nextSortBy === "createdAt" ? "desc" : "asc");
                    next.set("page", "1");
                  })
                }
                onFilterChange={(filterKey, value, type) =>
                  updateParams((next) => {
                    if (type === "checkbox") {
                      if (Array.isArray(value) && value.length) next.set(filterKey, value.join(","));
                      else next.delete(filterKey);
                    } else if (type === "range") {
                      const { minKey, maxKey } = toRangeKeys(filterKey);
                      if (value?.min !== "" && value?.min !== undefined) next.set(minKey, String(value.min));
                      else next.delete(minKey);
                      if (value?.max !== "" && value?.max !== undefined) next.set(maxKey, String(value.max));
                      else next.delete(maxKey);
                    } else {
                      if (value) next.set(filterKey, value);
                      else next.delete(filterKey);
                    }
                    next.set("page", "1");
                  })
                }
              />
            </div>
          ) : null}
          </div>
        </div>

        <div className="lg:col-span-5">
          {loading && !products.length ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-800 sm:p-8">
              <div className="text-xs text-slate-600 dark:text-slate-400 sm:text-sm">Loading products...</div>
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-800 sm:p-8">
              <div className="text-xs text-slate-600 dark:text-slate-400 sm:text-sm">No products found. Try adjusting your filters.</div>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              <div className="text-xs text-slate-600 dark:text-slate-400 sm:text-sm">
                Showing {products.length} of {pagination.total} products
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 md:grid-cols-3 lg:gap-3 lg:grid-cols-5 xl:grid-cols-6">
                {products.map((product) => (
                  <ProductCard key={product._id} product={product} />
                ))}
              </div>

              {pagination.pages > 1 ? (
                <div className="flex flex-col gap-3 border-t pt-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between sm:pt-6">
                  <div className="text-xs text-slate-600 dark:text-slate-400 sm:text-sm">
                    Page {page} of {pagination.pages}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => updateParams((next) => next.set("page", String(Math.max(1, page - 1))))}
                      disabled={page === 1}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800 sm:text-sm"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => updateParams((next) => next.set("page", String(Math.min(pagination.pages, page + 1))))}
                      disabled={page === pagination.pages}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800 sm:text-sm"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterSidebar({
  categories,
  categoryId,
  subCategoryId,
  subcategories,
  search,
  minPrice,
  maxPrice,
  sortBy,
  filterDefs,
  facetMap,
  searchParams,
  onCategoryChange,
  onSubcategoryChange,
  onSearchChange,
  onPriceChange,
  onSortChange,
  onFilterChange,
}) {
  const [localSearch, setLocalSearch] = useState(search);
  const groupedFilterDefs = useMemo(() => {
    return filterDefs
      .filter((def) => !["price", "rating"].includes(def.key))
      .reduce((acc, def) => {
        const group = def.group || "General";
        if (!acc[group]) acc[group] = [];
        acc[group].push(def);
        return acc;
      }, {});
  }, [filterDefs]);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  return (
    <div className="space-y-3 rounded-xl border border-slate-300 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950 sm:space-y-4 sm:p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 sm:text-base">Filters</h2>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSearchChange(localSearch.trim());
        }}
        className="space-y-2"
      >
        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Search</label>
        <input
          type="text"
          value={localSearch}
          onChange={(event) => setLocalSearch(event.target.value)}
          placeholder="Search products..."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 sm:text-sm"
        />
        <button type="submit" className="w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 sm:text-sm">
          Apply search
        </button>
      </form>

      <div>
        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Category</label>
        <select
          value={categoryId}
          onChange={(event) => onCategoryChange(event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 sm:text-sm"
        >
          <option value="">All Categories</option>
          {categories.map((item) => (
            <option key={item._id} value={item._id}>{item.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Subcategory</label>
        <select
          value={subCategoryId}
          onChange={(event) => onSubcategoryChange(event.target.value)}
          disabled={!categoryId}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 sm:text-sm"
        >
          <option value="">All Subcategories</option>
          {subcategories.map((item) => (
            <option key={item._id} value={item._id}>{item.name}</option>
          ))}
        </select>
      </div>

      <RangeFacetCard
        title="Price"
        min={Number(minPrice || facetMap.price?.min || 0)}
        max={Number(maxPrice || facetMap.price?.max || 100000)}
        floor={Number(facetMap.price?.min || 0)}
        ceiling={Number(facetMap.price?.max || 100000)}
        step={Number(facetMap.price?.step || 100)}
        onApply={onPriceChange}
        formatSuffix=""
      />

      {Object.entries(groupedFilterDefs).map(([groupName, defs]) => (
        <div key={groupName} className="space-y-3">
          <div className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            {groupName}
          </div>
          {defs.map((def) => {
          const facet = facetMap[def.key];
          if (def.type === "range") {
            const { minKey, maxKey } = toRangeKeys(def.key);
            return (
              <RangeFacetCard
                key={def.key}
                title={def.name}
                min={Number(searchParams.get(minKey) || facet?.min || def.rangeConfig?.min || 0)}
                max={Number(searchParams.get(maxKey) || facet?.max || def.rangeConfig?.max || 0)}
                floor={Number(facet?.min ?? def.rangeConfig?.min ?? 0)}
                ceiling={Number(facet?.max ?? def.rangeConfig?.max ?? 100)}
                step={Number(def.rangeConfig?.step || 1)}
                formatSuffix={def.unit || ""}
                onApply={(min, max) => onFilterChange(def.key, { min, max }, "range")}
              />
            );
          }

            if (def.type === "checkbox") {
            const selected = getCheckboxValues(searchParams, def.key);
            return (
              <details key={def.key} open className="rounded-2xl border border-slate-200 px-3 py-3 dark:border-slate-800">
                <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {def.name}
                </summary>
                <div className="mt-3 space-y-2">
                  {(facet?.options || def.options?.map((option) => ({ value: option, count: 0 })) || []).map((option) => (
                    <label key={option.value} className="flex items-center justify-between gap-3 text-sm text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selected.includes(option.value)}
                          onChange={(event) => {
                            const next = event.target.checked
                              ? [...selected, option.value]
                              : selected.filter((item) => item !== option.value);
                            onFilterChange(def.key, next, "checkbox");
                          }}
                        />
                        {option.value}
                      </span>
                      <span className={`text-xs ${option.count === 0 ? "text-slate-300" : "text-slate-400"}`}>{option.count}</span>
                    </label>
                  ))}
                </div>
              </details>
            );
          }

          return (
            <details key={def.key} open className="rounded-2xl border border-slate-200 px-3 py-3 dark:border-slate-800">
              <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900 dark:text-slate-100">
                {def.name}
              </summary>
              <div className="mt-3 grid gap-2">
                <button
                  type="button"
                  onClick={() => onFilterChange(def.key, "", def.type)}
                  className={`rounded-xl border px-3 py-2 text-left text-sm ${
                    !searchParams.get(def.key) ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200"
                  }`}
                >
                  All
                </button>
                {(facet?.options || def.options?.map((option) => ({ value: option, count: 0 })) || []).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onFilterChange(def.key, option.value, def.type)}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm ${
                      searchParams.get(def.key) === option.value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200"
                    }`}
                  >
                    <span>{option.value}</span>
                    <span className="text-xs opacity-70">{option.count}</span>
                  </button>
                ))}
              </div>
            </details>
          );
          })}
        </div>
      ))}

      <div>
        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Sort By</label>
        <select
          value={sortBy}
          onChange={(event) => onSortChange(event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 sm:text-sm"
        >
          <option value="createdAt">Newest</option>
          <option value="price">Price (Low to High)</option>
          <option value="ratings.averageRating">Highest Rated</option>
          <option value="name">Name (A-Z)</option>
        </select>
      </div>
    </div>
  );
}

function RangeFacetCard({ title, min, max, floor, ceiling, step, onApply, formatSuffix = "" }) {
  const [localMin, setLocalMin] = useState(min);
  const [localMax, setLocalMax] = useState(max);

  useEffect(() => {
    setLocalMin(min);
    setLocalMax(max);
  }, [min, max]);

  const safeFloor = Number.isFinite(floor) ? floor : 0;
  const safeCeiling = Number.isFinite(ceiling) && ceiling >= safeFloor ? ceiling : Math.max(safeFloor, 100);

  return (
    <details open className="rounded-2xl border border-slate-200 px-3 py-3 dark:border-slate-800">
      <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </summary>
      <div className="mt-3 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            value={localMin}
            min={safeFloor}
            max={localMax || safeCeiling}
            step={step}
            onChange={(event) => setLocalMin(event.target.value === "" ? "" : Number(event.target.value))}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={localMax}
            min={localMin || safeFloor}
            max={safeCeiling}
            step={step}
            onChange={(event) => setLocalMax(event.target.value === "" ? "" : Number(event.target.value))}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-2">
          <input
            type="range"
            min={safeFloor}
            max={safeCeiling}
            step={step}
            value={localMin === "" ? safeFloor : localMin}
            onChange={(event) => setLocalMin(Number(event.target.value))}
            className="w-full"
          />
          <input
            type="range"
            min={safeFloor}
            max={safeCeiling}
            step={step}
            value={localMax === "" ? safeCeiling : localMax}
            onChange={(event) => setLocalMax(Number(event.target.value))}
            className="w-full"
          />
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{safeFloor}{formatSuffix}</span>
          <span>{safeCeiling}{formatSuffix}</span>
        </div>
        <button
          type="button"
          onClick={() => onApply(localMin, localMax)}
          className="w-full rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          Apply
        </button>
      </div>
    </details>
  );
}

const ProductCard = memo(function ProductCard({ product }) {
  const { cart, addItem: addCartItem } = useCart();
  const { openDrawer, showToast } = useCartDrawer();
  const { addItem: addWishlistItem, removeItem: removeWishlistItem, isInWishlist: checkWishlistStatus } = useWishlist();
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const productId = useMemo(() => extractProductId(product), [product]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const status = await checkWishlistStatus(productId);
        if (active) setIsInWishlist(Boolean(status));
      } catch {
        if (active) setIsInWishlist(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [productId, checkWishlistStatus]);

  const { selectedVariant, hasAvailableVariants, availableStock } = useMemo(
    () => getAvailableProductVariant(product, cart?.items),
    [cart?.items, product]
  );

  const discountPercent = product.discountPrice
    ? Math.round(((product.price - product.discountPrice) / product.price) * 100)
    : 0;

  const handleWishlist = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      if (isInWishlist) {
        await removeWishlistItem(productId);
        setIsInWishlist(false);
      } else {
        await addWishlistItem(productId, selectedVariant?.variantId || "");
        setIsInWishlist(true);
      }
    } catch (err) {
      console.error("Failed to update wishlist:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddToCart = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (isSubmitting || !hasAvailableVariants) return;

    try {
      setIsSubmitting(true);
      const { selectedVariant: nextSelectedVariant } = getAvailableProductVariant(product, cart?.items);
      const variantId = nextSelectedVariant?.variantId || "";
      const added = await addCartItem(productId, 1, variantId);
      if (added) {
        openDrawer(product, nextSelectedVariant || added?.variant || added || null, added?.quantity || 1);
      }
    } catch (err) {
      console.error("Failed to add to cart:", err);
      showToast(getCartErrorMessage(err, "Failed to add item to cart."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Link
      to={`/product/${productId}`}
      className="group/card flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white transition-all duration-200 hover:border-slate-300 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:shadow-slate-950/50"
    >
      <div className="group relative w-full overflow-hidden bg-slate-100 dark:bg-slate-800" style={{ aspectRatio: "3/4" }}>
        {product.images?.[0]?.url ? (
          <img
            src={product.images[0].url}
            alt={product.name}
            className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            onError={(event) => {
              event.target.src = "https://via.placeholder.com/300x300?text=Product";
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-400 text-xs">No Image</div>
        )}
        {discountPercent > 0 ? (
          <div className="absolute top-1.5 right-1.5 transform transition-all duration-200 group-hover:scale-110">
            <div className="flex flex-col items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-2 py-1.5 shadow-lg shadow-orange-500/40">
              <div className="text-xs font-black text-white leading-none">{discountPercent}%</div>
              <div className="text-[9px] font-bold text-white leading-none">OFF</div>
            </div>
          </div>
        ) : null}

        <div className="absolute top-2 right-2 z-10 flex flex-col gap-2 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 ease-out">
          <button
            onClick={handleWishlist}
            disabled={isSubmitting}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm shadow-lg hover:shadow-xl hover:scale-110 active:scale-95 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            title={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
            aria-label={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart
              size={18}
              strokeWidth={1.5}
              className={`transition-all duration-300 ${
                isInWishlist
                  ? "fill-red-500 text-red-500"
                  : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            />
          </button>

          <button
            onClick={handleAddToCart}
            disabled={isSubmitting || !hasAvailableVariants || availableStock <= 0}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl hover:scale-110 active:scale-95 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            title={hasAvailableVariants ? "Add to cart" : "Out of stock"}
            aria-label="Add to cart"
          >
            <ShoppingCart size={18} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-2 sm:p-2.5">
        <div className="flex-1">
          <h3 className="line-clamp-2 text-xs font-medium text-slate-900 dark:text-slate-100 sm:text-xs leading-tight">
            {product.name}
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
            {product.category}
          </p>
          <SellerNameLink seller={product?.sellerId} className="mt-1 text-[11px]" />
        </div>

        {product.ratings?.averageRating > 0 && (
          <div className="flex items-center gap-0.5">
            <span className="text-xs font-semibold text-yellow-500">★ {product.ratings.averageRating.toFixed(1)}</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">({product.ratings.totalReviews})</span>
          </div>
        )}

        <div className="space-y-0.5 border-t border-slate-100 pt-1 dark:border-slate-800">
          {product.discountPrice ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 sm:text-sm">
                {formatCurrency(product.discountPrice)}
              </span>
              <span className="text-[10px] text-slate-500 line-through dark:text-slate-400">
                {formatCurrency(product.price)}
              </span>
            </div>
          ) : (
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 sm:text-sm">
              {formatCurrency(product.price)}
            </span>
          )}
          
          <div className="text-[10px] font-medium">
            {product.stock > 0 ? (
              <span className="text-green-600 dark:text-green-400">In Stock</span>
            ) : (
              <span className="text-red-600 dark:text-red-400">Out of Stock</span>
            )}
          </div>
        </div>

        <button className="mt-auto w-full rounded-md bg-blue-600 px-2 py-1.5 text-center text-[11px] font-semibold text-white transition-all duration-200 hover:bg-blue-700 active:scale-95 dark:hover:bg-blue-500 sm:text-xs">
          View
        </button>
      </div>
    </Link>
  );
});
