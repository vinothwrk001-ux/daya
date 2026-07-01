export function ReelShoppingBadge({ count, onClick }) {
  if (!count) return null;

  const label = count === 1 ? "1 Product" : `${count} Products`;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      aria-label={`Product shopping, ${label}`}
      className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/55 px-3 py-2 text-left text-white shadow-lg backdrop-blur-md transition hover:bg-black/70 active:scale-95"
    >
      <span className="text-base" aria-hidden="true">
        🛒
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-300">Product Shopping</span>
        <span className="text-xs font-black">{label}</span>
      </span>
    </button>
  );
}
