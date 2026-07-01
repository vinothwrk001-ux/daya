import { resolveEffectiveTheme, themeToCssVariables } from "../../../theme/themeManager";
import { applyPreviewTheme } from "../../../theme/themeRenderer";
import {
  ANIMATION_TOKENS,
  COLOR_TOKENS,
  RADIUS_TOKENS,
  SHADOW_TOKENS,
  SPACING_TOKENS,
  TYPOGRAPHY_TOKENS,
} from "../../../theme/tokens";

const INPUT_CLASS =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100";

export function TokenSection({ title, tokens, group, values, onChange }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {tokens.map((token) => {
          const value = values?.[token.key] || "";
          const isColor = group === "colors";
          return (
            <label key={token.key} className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">{token.label}</span>
              <div className="flex items-center gap-2">
                {isColor ? (
                  <input
                    type="color"
                    value={value.startsWith("#") ? value : "#000000"}
                    onChange={(event) => onChange(group, token.key, event.target.value)}
                    className="h-10 w-12 cursor-pointer rounded-lg border border-slate-300"
                  />
                ) : null}
                <input
                  type="text"
                  value={value}
                  onChange={(event) => onChange(group, token.key, event.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function ThemePreviewPanel({ theme, breakpoint = "desktop" }) {
  const effective = resolveEffectiveTheme({ globalTheme: theme }, { breakpoint });
  const vars = themeToCssVariables(effective);

  return (
    <div
      className="overflow-hidden rounded-2xl border border-slate-200"
      style={{
        background: vars["--color-background"],
        color: vars["--color-text-primary"],
        fontFamily: vars["--font-body"],
        maxWidth: breakpoint === "mobile" ? "375px" : breakpoint === "tablet" ? "768px" : "100%",
        margin: breakpoint === "mobile" || breakpoint === "tablet" ? "0 auto" : undefined,
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ background: vars["--color-surface"], borderBottom: `1px solid ${vars["--color-border"]}` }}
      >
        <span className="text-sm font-semibold" style={{ fontFamily: vars["--font-heading"] }}>
          Storefront Preview
        </span>
        <span className="text-xs uppercase tracking-wide" style={{ color: vars["--color-text-secondary"] }}>
          {breakpoint}
        </span>
      </div>

      <div className="space-y-4 p-4">
        <div
          className="rounded-xl p-6"
          style={{
            background: `linear-gradient(135deg, ${vars["--color-primary"]}, ${vars["--color-secondary"]})`,
            borderRadius: vars["--radius-container"],
          }}
        >
          <h2 className="text-xl font-bold text-white" style={{ fontFamily: vars["--font-heading"] }}>
            Hero Section
          </h2>
          <p className="mt-2 text-sm text-white/80">Dynamic theme preview updates instantly.</p>
          <button
            type="button"
            className="mt-4 px-5 py-2 text-sm font-semibold text-white"
            style={{
              background: vars["--color-accent"],
              borderRadius: vars["--radius-button"],
              boxShadow: vars["--shadow-button"],
            }}
          >
            Shop Now
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {["Product Card", "Category Card"].map((label) => (
            <div
              key={label}
              className="p-4 transition"
              style={{
                background: vars["--color-card"],
                border: `1px solid ${vars["--color-border"]}`,
                borderRadius: vars["--radius-card"],
                boxShadow: vars["--shadow-card"],
              }}
            >
              <div
                className="mb-3 h-24 rounded-lg"
                style={{ background: vars["--color-surface"], borderRadius: vars["--radius-input"] }}
              />
              <p className="text-sm font-semibold">{label}</p>
              <p className="text-xs" style={{ color: vars["--color-text-secondary"] }}>
                Themed component preview
              </p>
              <p className="mt-2 text-sm font-bold" style={{ color: vars["--color-primary"] }}>
                ₹1,999
              </p>
            </div>
          ))}
        </div>

        <div
          className="rounded-xl p-4"
          style={{
            background: vars["--color-surface"],
            border: `1px solid ${vars["--color-border"]}`,
            borderRadius: vars["--radius-card"],
          }}
        >
          <label className="mb-1 block text-xs font-medium">Email input</label>
          <input
            readOnly
            value="customer@example.com"
            className="w-full text-sm outline-none"
            style={{
              background: vars["--color-background"],
              border: `1px solid ${vars["--color-border"]}`,
              borderRadius: vars["--radius-input"],
              padding: vars["--input-padding"],
              color: vars["--color-text-primary"],
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function GlobalThemeEditor({ globalTheme, onChange, onPreview }) {
  const handleChange = (group, key, value) => {
    const next = {
      ...globalTheme,
      [group]: {
        ...(globalTheme?.[group] || {}),
        [key]: value,
      },
    };
    onChange(next);
    onPreview?.(next);
  };

  return (
    <div className="space-y-4">
      <TokenSection title="Color Tokens" group="colors" tokens={COLOR_TOKENS} values={globalTheme?.colors} onChange={handleChange} />
      <TokenSection title="Typography Tokens" group="typography" tokens={TYPOGRAPHY_TOKENS} values={globalTheme?.typography} onChange={handleChange} />
      <TokenSection title="Spacing Tokens" group="spacing" tokens={SPACING_TOKENS} values={globalTheme?.spacing} onChange={handleChange} />
      <TokenSection title="Radius Tokens" group="radius" tokens={RADIUS_TOKENS} values={globalTheme?.radius} onChange={handleChange} />
      <TokenSection title="Shadow Tokens" group="shadows" tokens={SHADOW_TOKENS} values={globalTheme?.shadows} onChange={handleChange} />
      <TokenSection title="Animation Tokens" group="animation" tokens={ANIMATION_TOKENS} values={globalTheme?.animation} onChange={handleChange} />
    </div>
  );
}

export { applyPreviewTheme };
