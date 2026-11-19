import { useEffect, useRef } from "react";
import { usePause } from "./runtime/use-pause";
import { DotCut } from "./engine";
import { FONT_VAR } from "./scenes";

export default function DotCutCard({ paused, lite }: { paused: boolean; lite: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const engine = useRef<DotCut | null>(null);
  const running = usePause(box, run => run ? engine.current?.start() : engine.current?.stop(), paused || lite);
  const settled = useRef(lite);
  settled.current = lite;

  useEffect(() => {
    const host = box.current;
    if (!host) return;
    let cancelled = false;
    const family = getComputedStyle(host).getPropertyValue(FONT_VAR).trim() || "system-ui";
    const build = () => {
      if (cancelled) return;
      const next = new DotCut(host, family);
      engine.current = next;
      if (!next.ok) return;
      next.renderStill();
      if (!settled.current && running.current) next.start();
    };
    const first = family.split(",")[0].replace(/["']/g, "").trim();
    if (document.fonts?.load) void document.fonts.load(`600 1em "${first}"`).then(build, build);
    else build();
    const onMove = (event: PointerEvent) => {
      const current = engine.current;
      if (!current || settled.current || !matchMedia("(pointer: fine)").matches) return;
      const rect = host.getBoundingClientRect();
      current.setPointer(current.toCell(event.clientX - rect.left, event.clientY - rect.top));
    };
    const onLeave = () => engine.current?.setPointer(null);
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    return () => {
      cancelled = true;
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      engine.current?.destroy();
      engine.current = null;
    };
  }, [running]);
  useEffect(() => {
    if (lite) {
      engine.current?.stop();
      engine.current?.setPointer(null);
      engine.current?.renderStill();
    }
  }, [lite]);
  return <div ref={box} className="dot-field" role="img"
    aria-label="Abstract: touching circles with A, markdown symbols and geometric patterns cut out of the field." />;
}
