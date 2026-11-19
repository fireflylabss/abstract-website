import { DotCut } from "./engine";
import { FONT_VAR, PALETTES } from "./scenes";

export function mountDotCut(host: HTMLElement) {
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const fine = matchMedia("(pointer: fine)");
  const control = host.parentElement?.querySelector<HTMLButtonElement>("[data-dot-pause]");
  const styles = getComputedStyle(host);
  const family = styles.getPropertyValue(FONT_VAR).trim() || "system-ui, sans-serif";
  PALETTES.forEach((pair, index) => {
    pair[0] = styles.getPropertyValue(`--field-${index + 1}-ink`).trim() || pair[0];
    pair[1] = styles.getPropertyValue(`--field-${index + 1}-ground`).trim() || pair[1];
  });
  let engine: DotCut | null = null;
  let onScreen = false;
  let disposed = false;
  let still = false;
  let paused = false;
  const sync = () => {
    if (!engine?.ok) return;
    if (control) {
      control.hidden = motion.matches || document.documentElement.classList.contains("lite");
      control.setAttribute("aria-pressed", String(paused));
      control.setAttribute("aria-label", paused ? "Play hero animation" : "Pause hero animation");
    }
    if (motion.matches || document.documentElement.classList.contains("lite")) {
      engine.stop();
      if (!still) {
        engine.destroy();
        engine = new DotCut(host, family);
        engine.renderStill();
        still = true;
      }
    } else {
      still = false;
      if (onScreen && !document.hidden && !paused) engine.start();
      else engine.stop();
    }
  };
  const observer = new IntersectionObserver(entries => {
    onScreen = entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.2);
    sync();
  }, { threshold: 0.2 });
  observer.observe(host);
  document.addEventListener("visibilitychange", sync);
  motion.addEventListener("change", sync);
  const onToggle = () => {
    paused = !paused;
    sync();
  };
  control?.addEventListener("click", onToggle);
  const onMove = (event: PointerEvent) => {
    if (!fine.matches || motion.matches || still || paused || !engine) return;
    const rect = host.getBoundingClientRect();
    engine.setPointer(engine.toCell(event.clientX - rect.left, event.clientY - rect.top));
  };
  const onLeave = () => engine?.setPointer(null);
  host.addEventListener("pointermove", onMove);
  host.addEventListener("pointerleave", onLeave);
  const build = () => {
    if (disposed) return;
    engine = new DotCut(host, family);
    sync();
  };
  document.fonts.ready.then(build);
  return () => {
    disposed = true;
    observer.disconnect();
    document.removeEventListener("visibilitychange", sync);
    motion.removeEventListener("change", sync);
    control?.removeEventListener("click", onToggle);
    host.removeEventListener("pointermove", onMove);
    host.removeEventListener("pointerleave", onLeave);
    engine?.destroy();
    engine = null;
  };
}
