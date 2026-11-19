import { useEffect, useRef, type RefObject } from "react";
export const prefersReducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function usePause(target: RefObject<Element | null>, onChange: (running: boolean) => void, stopped: boolean) {
  const running = useRef(false);
  const callback = useRef(onChange);
  useEffect(() => { callback.current = onChange; });
  useEffect(() => {
    const element = target.current;
    if (!element) return;
    let onScreen = false;
    const sync = () => {
      const next = onScreen && !document.hidden && !stopped && !prefersReducedMotion();
      if (next === running.current) return;
      running.current = next;
      callback.current(next);
    };
    const observer = new IntersectionObserver(entries => {
      onScreen = entries.some(entry => entry.isIntersecting);
      sync();
    }, { threshold: 0.2 });
    observer.observe(element);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      if (running.current) { running.current = false; callback.current(false); }
    };
  }, [target, stopped]);
  return running;
}
