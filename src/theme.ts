/* Shared theme wiring: all .theme buttons cycle system → light → dark with a
   circular view transition out of the click point. onChange runs inside the
   swap. Preference persists in localStorage.theme; "system" (or absent)
   follows prefers-color-scheme and re-applies on change. */
export type ThemePref = "system" | "light" | "dark";

export function resolveTheme(pref: ThemePref): "light" | "dark" {
  if (pref === "light" || pref === "dark") return pref;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const NEXT: Record<ThemePref, ThemePref> = { system: "light", light: "dark", dark: "system" };

export function setupTheme(reduced: boolean, onChange?: () => void) {
  const root = document.documentElement;
  const metaTheme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  const buttons = document.querySelectorAll<HTMLButtonElement>(".theme");
  const mql = matchMedia("(prefers-color-scheme: dark)");

  const currentPref = (): ThemePref => {
    const p = root.dataset.themePref;
    return p === "light" || p === "dark" ? p : "system";
  };

  const applyPref = (pref: ThemePref) => {
    const dark = resolveTheme(pref) === "dark";
    root.dataset.themePref = pref;
    root.dataset.theme = dark ? "dark" : "light";
    if (metaTheme) metaTheme.content = dark ? "#16130f" : "#f4f1e8";
    buttons.forEach((b) =>
      b.setAttribute("aria-label", `Theme: ${pref} (click for ${NEXT[pref]})`),
    );
  };

  applyPref(currentPref());

  mql.addEventListener("change", () => {
    if (currentPref() === "system") {
      applyPref("system");
      onChange?.();
    }
  });

  buttons.forEach((btn) =>
    btn.addEventListener("click", (e) => {
      const next = NEXT[currentPref()];
      const swap = () => {
        applyPref(next);
        localStorage.setItem("theme", next);
        onChange?.();
      };
      if (!document.startViewTransition || reduced) {
        swap();
        return;
      }
      let x = e.clientX;
      let y = e.clientY;
      if (!x && !y) {
        const b = btn.getBoundingClientRect();
        x = b.left + b.width / 2;
        y = b.top + b.height / 2;
      }
      const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      const vt = document.startViewTransition(swap);
      vt.ready.then(() =>
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
          {
            duration: 550,
            easing: "cubic-bezier(.2,0,0,1)",
            pseudoElement: "::view-transition-new(root)",
          },
        ),
      );
    }),
  );
}
