import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuthStore } from "../context/authStore";
import { api } from "../services/api";

export function LocationSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [, setSelectedLocation] = useState("Layout Road, Kadampadi, Tamil Nadu");

  const [isDetecting, setIsDetecting] = useState(false);
  const [detectError, setDetectError] = useState("");

  const [popularLocations, setPopularLocations] = useState([]);
  const [popularLoading, setPopularLoading] = useState(false);
  const [popularError, setPopularError] = useState("");

  const user = useAuthStore((s) => s.user);
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const lastActiveRef = useRef(null);

  const closePanel = () => {
    setIsOpen(false);
    setSearchQuery("");
    setDetectError("");
  };


  useEffect(() => {
    if (!isOpen) return;
    lastActiveRef.current = document.activeElement;
    const t = window.setTimeout(() => inputRef.current?.focus?.(), 0);
    return () => window.clearTimeout(t);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closePanel();
        return;
      }

      if (e.key !== "Tab") return;

      const root = dialogRef.current;
      if (!root) return;

      const focusable = root.querySelectorAll(
        [
          'a[href]',
          'button:not([disabled])',
          'textarea:not([disabled])',
          'input:not([disabled])',
          'select:not([disabled])',
          '[tabindex]:not([tabindex="-1"])',
        ].join(",")
      );

      const list = Array.from(focusable).filter(
        (el) => el && el.offsetParent !== null && !el.hasAttribute("disabled")
      );

      if (list.length === 0) {
        e.preventDefault();
        root.focus();
        return;
      }

      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || active === root) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) return;
    const el = lastActiveRef.current;
    if (el && typeof el.focus === "function") {
      el.focus();
    }
  }, [isOpen]);

  const formatPlace = (parts) => {
    const city = parts?.city || parts?.town || parts?.village || parts?.suburb || parts?.county || "";
    const state = parts?.state || parts?.region || "";
    const country = parts?.country || "";
    return [city, state, country].filter(Boolean).join(", ");
  };

  const reverseGeocode = async ({ latitude, longitude }) => {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("zoom", "10");
    url.searchParams.set("addressdetails", "1");

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });
    if (!res.ok) throw new Error("reverse_geocode_failed");
    const data = await res.json();
    const formatted = formatPlace(data?.address);
    if (!formatted) throw new Error("reverse_geocode_empty");
    return formatted;
  };

  const handleUseCurrentLocation = async () => {
    setDetectError("");

    if (!("geolocation" in navigator)) {
      setDetectError("Unable to fetch location");
      return;
    }

    setIsDetecting(true);
    try {
      const coords = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) =>
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            }),
          (err) => reject(err),
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
        );
      });

      const formatted = await reverseGeocode(coords);

      setSelectedLocation(formatted);
      closePanel();
    } catch (err) {
      const code = err?.code;
      if (code === 1) setDetectError("Location access denied");
      else setDetectError("Unable to fetch location");
    } finally {
      setIsDetecting(false);
    }
  };

  const commonLocations = [
    "Kadampadi, Tamil Nadu",
    "Chennai, Tamil Nadu",
    "Bangalore, Karnataka",
    "Hyderabad, Telangana",
    "Delhi, National Capital Region",
  ];

  const handleLocationSelect = (location) => {
    setSelectedLocation(location);
    closePanel();
  };

  const filteredPopular = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return popularLocations;
    return popularLocations.filter((loc) => String(loc).toLowerCase().includes(q));
  }, [popularLocations, searchQuery]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const loadPopular = async () => {
      setPopularError("");
      setPopularLoading(true);
      try {
        const res = await api.get("/locations/popular");
        const payload = res?.data;
        const locations = Array.isArray(payload) ? payload : payload?.locations;
        const normalized = Array.isArray(locations)
          ? locations.map((x) => String(x)).filter(Boolean)
          : [];
        if (!cancelled) setPopularLocations(normalized);
      } catch {
        if (!cancelled) {
          setPopularLocations([]);
          setPopularError("Unable to load popular locations");
        }
      } finally {
        if (!cancelled) setPopularLoading(false);
      }
    };

    loadPopular();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  return (
    <>
      {typeof document !== "undefined"
        ? createPortal(
            <div
              className={`fixed inset-0 z-[9999] ${isOpen ? "" : "pointer-events-none"}`}
              aria-hidden={!isOpen}
            >
              <div
                className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${
                  isOpen ? "opacity-100" : "opacity-0"
                }`}
                onMouseDown={closePanel}
                aria-hidden="true"
              />

              <div className="absolute inset-0 flex items-end justify-center p-0 sm:items-center sm:p-4">
                <div
                  ref={dialogRef}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="select-location-title"
                  tabIndex={-1}
                  onMouseDown={(e) => e.stopPropagation()}
                  className={`w-full max-w-md rounded-t-3xl bg-white shadow-2xl ring-1 ring-black/5 transition-all duration-200 ease-out dark:bg-slate-800 dark:ring-white/10 sm:rounded-2xl ${
                    isOpen ? "translate-y-0 scale-100 opacity-100" : "translate-y-1 scale-95 opacity-0"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 dark:border-slate-700 sm:px-5">
                    <div className="min-w-0">
                      <h2 id="select-location-title" className="text-lg font-semibold text-slate-900 dark:text-white">
                        Select Location
                      </h2>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        Search or choose from saved and popular locations.
                      </p>
                    </div>
                    <button
                      onClick={closePanel}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                      aria-label="Close"
                      type="button"
                    >
                      <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                        <path strokeLinecap="round" d="M5 5l10 10M15 5 5 15" />
                      </svg>
                    </button>
                  </div>

                  <div className="max-h-[75vh] overflow-y-auto px-4 py-4 sm:px-5">
                    <div className="space-y-5">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true">
                          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <circle cx="9" cy="9" r="5.5" />
                            <path strokeLinecap="round" d="m14 14 3.5 3.5" />
                          </svg>
                        </span>
                        <input
                          ref={inputRef}
                          type="text"
                          placeholder="Search by area, city"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                        />
                      </div>

                      <button
                        onClick={handleUseCurrentLocation}
                        disabled={isDetecting}
                        className="w-full rounded-xl border border-transparent p-3 text-left transition hover:border-blue-100 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-70 dark:hover:bg-slate-700"
                        type="button"
                      >
                        <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10" aria-hidden="true">
                            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="currentColor">
                              <path d="M12 2a6 6 0 0 0-6 6c0 4.7 6 12 6 12s6-7.3 6-12a6 6 0 0 0-6-6Zm0 8.5A2.5 2.5 0 1 1 12 5.5a2.5 2.5 0 0 1 0 5Z" />
                            </svg>
                          </span>
                          <span className="font-medium">
                            {isDetecting ? "Detecting location..." : "Use Current Location"}
                          </span>
                        </div>
                        {detectError ? (
                          <div className="mt-2 text-sm text-red-600 dark:text-red-400">{detectError}</div>
                        ) : null}
                      </button>

                      <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
                        <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Saved Addresses</h3>
                        {!user ? (
                          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm dark:border-slate-600 dark:bg-slate-900/30">
                            <button
                              onClick={() => (window.location.href = "/login")}
                              className="w-full text-left text-blue-600 hover:underline dark:text-blue-400"
                              type="button"
                            >
                              Login to save addresses
                            </button>
                          </div>
                        ) : (
                          <div className="text-sm text-slate-500 dark:text-slate-400">No saved addresses</div>
                        )}
                      </div>

                      <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
                        <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Popular Locations</h3>

                        {popularLoading ? (
                          <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            Loading popular locations...
                          </div>
                        ) : popularError ? (
                          <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {popularError}
                          </div>
                        ) : filteredPopular.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-900/30 dark:text-slate-300">
                            No popular locations available right now.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {filteredPopular.map((location) => (
                              <button
                                key={location}
                                onClick={() => handleLocationSelect(location)}
                                className="w-full rounded-xl p-3 text-left text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-300 dark:hover:bg-slate-700"
                                type="button"
                              >
                                {location}
                              </button>
                            ))}
                          </div>
                        )}

                        {!popularLoading && filteredPopular.length === 0 ? (
                          <div className="mt-4">
                            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                              Suggested
                            </div>
                            <div className="space-y-2">
                              {commonLocations.map((location) => (
                                <button
                                  key={location}
                                  onClick={() => handleLocationSelect(location)}
                                  className="w-full rounded-xl p-3 text-left text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-300 dark:hover:bg-slate-700"
                                  type="button"
                                >
                                  {location}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-4 dark:border-slate-700 sm:px-5">
                    <button
                      type="button"
                      onClick={closePanel}
                      className="rounded-xl px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={closePanel}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
