import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode, type MouseEvent } from "react";

export const reducedQuery = "(prefers-reduced-motion: reduce)";
export const deviceQuery = "(max-width: 860px), (hover: none) and (pointer: coarse)";
export function useMedia(query: string) {
  return useSyncExternalStore(
    callback => {
      const media = matchMedia(query);
      media.addEventListener("change", callback);
      return () => media.removeEventListener("change", callback);
    },
    () => matchMedia(query).matches,
    () => false,
  );
}

type Preference = "system" | "light" | "dark";
const nextPreference = { system: "light", light: "dark", dark: "system" } as const;
function savedPreference(): Preference {
  try {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch { /* Storage can be unavailable in private browsing. */ }
  return "system";
}
const Modes = createContext({
  lite: false, reduced: false, dark: false, preference: "system" as Preference,
  toggleTheme: (_event: MouseEvent<HTMLButtonElement>) => {},
});

export function ModeProvider({ children }: { children: ReactNode }) {
  const reduced = useMedia(reducedQuery);
  const device = useMedia(deviceQuery);
  const systemDark = useMedia("(prefers-color-scheme: dark)");
  const [preference, setPreference] = useState(savedPreference);
  const lite = reduced || device;
  const dark = preference === "dark" || (preference === "system" && systemDark);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.dataset.themePref = preference;
    document.documentElement.classList.toggle("lite", lite);
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.content = getComputedStyle(document.body).backgroundColor;
  }, [dark, preference, lite]);
  const toggleTheme = (event: MouseEvent<HTMLButtonElement>) => {
    const next = nextPreference[preference];
    const apply = () => {
      const nextDark = next === "dark" || (next === "system" && systemDark);
      document.documentElement.dataset.theme = nextDark ? "dark" : "light";
      document.documentElement.dataset.themePref = next;
      setPreference(next);
      try { localStorage.setItem("theme", next); } catch { /* Keep the session preference. */ }
    };
    if (lite || !document.startViewTransition) { apply(); return; }
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX || bounds.left + bounds.width / 2;
    const y = event.clientY || bounds.top + bounds.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const transition = document.startViewTransition(apply);
    void transition.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: parseFloat(getComputedStyle(document.body).getPropertyValue("--dur-slow")),
          easing: "ease-out", pseudoElement: "::view-transition-new(root)" },
      );
    }).catch(() => {});
  };
  return <Modes.Provider value={{ lite, reduced, dark, preference, toggleTheme }}>{children}</Modes.Provider>;
}

export const useModes = () => useContext(Modes);
