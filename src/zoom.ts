/* Scroll-driven camera over an HTML replica of the abstract window.
   The section is tall; the stage is sticky; scroll progress (in viewport heights)
   drives a camera {zoom, focal point, screen anchor} through a timeline of holds and moves. */

type Cam = { z: number; fx: number; fy: number; ax: number; ay: number; part?: string; free?: boolean };
type Seg = { a: number; b: number; A: Cam; B: Cam };

export type Stop = { id: string; part: string; h: string; p: string; z: number; free?: boolean };

export const STOPS: Stop[] = [
  { id: "p", part: "p", z: 1.9, h: "Markdown that renders as you type.", p: "Bold, italic, code and links render inline. The syntax only shows up while your cursor is on it." },
  { id: "tasks", part: "tasks", z: 2.2, h: "Tasks you can click.", p: "Checkboxes toggle with a click and stay plain <code>- [x]</code> in the file. Code blocks get syntax highlighting." },
  { id: "wl", part: "ul", z: 2.4, h: "Links, both ways.", p: "<code>[[note]]</code> links with autocomplete. <kbd>⌘</kbd>-click follows one, and a backlinks panel lists every note that points here." },
  { id: "sb", part: "sb", z: 1.9, free: true, h: "A folder is a space.", p: "The sidebar is your directory tree and <kbd>⌘</kbd><kbd>O</kbd> switches spaces. Every note saves itself, named after its first heading." },
];

const WW = 1200, WH = 760;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function mountZoom(isStatic: boolean) {
  const $ = (id: string) => document.getElementById(id);
  const els = [$("zoom"), $("stage"), $("world"), $("hero"), $("stops"), $("outro"), $("hint")];
  if (els.some((e) => !e)) return;
  const [section, stage, world, hero, stopsEl, outro, hint] = els as HTMLElement[];
  const staticEl = $("static");

  const parts = [...world.querySelectorAll<HTMLElement>("[data-part]")];
  const targets = new Map<string, HTMLElement>();
  world.querySelectorAll<HTMLElement>("[data-id]").forEach((el) => targets.set(el.dataset.id!, el));

  const shade = document.createElement("div");
  shade.className = "stop-shade";
  stage.insertBefore(shade, stopsEl);

  const panels = STOPS.map((s) => {
    const d = document.createElement("div");
    d.className = "stop";
    d.innerHTML = `<h2>${s.h}</h2><p>${s.p}</p>`;
    stopsEl.appendChild(d);
    return d;
  });

  if (staticEl) {
    STOPS.forEach((s) => {
      const a = document.createElement("article");
      a.innerHTML = `<h3>${s.h}</h3><p>${s.p}</p>`;
      staticEl.appendChild(a);
    });
  }

  if (isStatic) return;

  /* ── geometry in world points ── */
  type Box = { x: number; y: number; w: number; h: number };
  const rects = new Map<string, Box>();
  function measure() {
    world.style.transform = "none";
    const wr = world.getBoundingClientRect();
    targets.forEach((el, id) => {
      const r = el.getBoundingClientRect();
      rects.set(id, { x: r.left - wr.left, y: r.top - wr.top, w: r.width, h: r.height });
    });
  }

  let W = 0, H = 0, sectionTop = 0, timeline: Seg[] = [], total = 0, stopCenters: number[] = [], mobile = false;

  function layout() {
    W = stage.clientWidth;
    H = stage.clientHeight;
    sectionTop = section.offsetTop;
    mobile = W <= 860;

    // Overview: the window sits to the right of the hero copy (below it on mobile).
    let box: Box;
    if (mobile) {
      const top = Math.min(H * 0.6, hero.offsetTop + hero.offsetHeight + 24);
      box = { x: 16, y: top, w: W - 32, h: H - top - 16 };
    } else {
      const left = Math.max(24, W / 2 - 520) + Math.min(W * 0.44, 460) + 48;
      box = { x: left, y: 96, w: W - left - Math.max(24, W * 0.04), h: H - 160 };
    }
    const z0 = Math.min(box.w / WW, box.h / WH);
    const S0: Cam = { z: z0, fx: WW / 2, fy: WH / 2, ax: box.x + box.w / 2, ay: box.y + box.h / 2 };

    // Close-ups: the target is centered right of the caption column.
    const stops: Cam[] = STOPS.map((s) => {
      const r = rects.get(s.id)!;
      // Zoom scales with the viewport (authored for ~1300px wide) and never reveals the page behind the window.
      let z = s.z * (mobile ? Math.max(0.9, W / 700) : W / 1300);
      z = Math.max(z, W / WW, H / WH);
      // Wide blocks are left-aligned text: focus on their leading part.
      const fx = r.x + Math.min(r.w, 420) / 2, fy = r.y + Math.min(r.h, 320) / 2;
      const col = Math.max(24, W / 2 - 520) + Math.min(W * 0.34, 380) + 64;
      const ax = mobile ? W / 2 : col + (W - col) / 2;
      const ay = mobile ? H * 0.36 : H / 2;
      return { z, fx, fy, ax, ay, part: s.part, free: s.free };
    });

    const zE = Math.min((W * (mobile ? 0.92 : 0.7)) / WW, (H * 0.56) / WH);
    const SE: Cam = { z: zE, fx: WW / 2, fy: WH / 2, ax: W / 2, ay: H * 0.64 };

    timeline = [];
    stopCenters = [];
    let u = 0;
    const hold = (S: Cam, d: number) => { timeline.push({ a: u, b: u + d, A: S, B: S }); u += d; };
    const move = (A: Cam, B: Cam, d: number) => { timeline.push({ a: u, b: u + d, A, B }); u += d; };
    hold(S0, 0.35);
    move(S0, stops[0], 0.9);
    stops.forEach((S, i) => {
      stopCenters.push(u + 0.3);
      hold(S, 0.6);
      if (i < stops.length - 1) move(S, stops[i + 1], 0.5);
    });
    move(stops[stops.length - 1], SE, 0.9);
    hold(SE, 0.5);
    total = u;
    section.style.height = `${total * H + H}px`;
  }

  function clampOffsets(z: number, ox: number, oy: number) {
    // Once the window is larger than the viewport, keep its edges outside it.
    if (WW * z >= W) ox = clamp(ox, W - WW * z, 0);
    if (WH * z >= H) oy = clamp(oy, H - WH * z, 0);
    return [ox, oy];
  }

  function camera(u: number) {
    const seg = timeline.find((s) => u <= s.b) ?? timeline[timeline.length - 1];
    const { A, B } = seg;
    if (A === B) {
      const [ox, oy] = A.part && !A.free ? clampOffsets(A.z, A.ax - A.fx * A.z, A.ay - A.fy * A.z) : [A.ax - A.fx * A.z, A.ay - A.fy * A.z];
      return { z: A.z, ox, oy, fy: A.fy, w: A.part ? 1 : 0, part: A.part };
    }
    const t = ease(clamp((u - seg.a) / (seg.b - seg.a)));
    // Pivot on the closer shot's focal point so the zoom reads as a straight camera path.
    const P = B.z >= A.z ? B : A;
    const sAx = A.ax + (P.fx - A.fx) * A.z, sAy = A.ay + (P.fy - A.fy) * A.z;
    const sBx = B.ax + (P.fx - B.fx) * B.z, sBy = B.ay + (P.fy - B.fy) * B.z;
    const z = Math.exp(lerp(Math.log(A.z), Math.log(B.z), t));
    let ox = lerp(sAx, sBx, t) - P.fx * z;
    let oy = lerp(sAy, sBy, t) - P.fy * z;
    if (A.part && B.part && !A.free && !B.free) [ox, oy] = clampOffsets(z, ox, oy);
    const w = A.part && B.part ? 1 : A.part ? 1 - t : B.part ? t : 0;
    return { z, ox, oy, fy: lerp(A.fy, B.fy, t), w, part: t < 0.5 ? A.part : B.part };
  }

  function render() {
    ticking = false;
    const u = clamp((scrollY - sectionTop) / H, 0, total);
    const cam = camera(u);
    world.style.transform = `translate3d(${cam.ox}px, ${cam.oy}px, 0) scale(${cam.z})`;

    // Hero copy drifts up and blurs away faster than the window.
    const hp = clamp(u / 0.9);
    const hf = clamp((u - 0.1) / 0.55);
    hero.style.opacity = String(1 - hf);
    hero.style.transform = `${mobile ? "" : "translateY(-50%) "}translateY(${-hp * 160}px)`;
    hero.style.filter = hf > 0 ? `blur(${hf * 8}px)` : "";
    hero.style.visibility = hp >= 1 ? "hidden" : "";
    hint.style.opacity = String(1 - clamp(u / 0.25));

    // Captions fade in around their stop and drift against the camera.
    let shadeOpacity = 0;
    panels.forEach((p, i) => {
      const d = u - stopCenters[i];
      const o = 1 - clamp((Math.abs(d) - 0.22) / 0.26);
      shadeOpacity = Math.max(shadeOpacity, o);
      p.style.opacity = String(o);
      p.style.visibility = o <= 0 ? "hidden" : "visible";
      if (o <= 0) return;
      const dd = mobile ? clamp(d, -0.5, 0.5) : d;
      p.style.transform = mobile ? `translateY(${-dd * 40}px)` : `translateY(-50%) translateY(${-d * 120}px)`;
      p.style.filter = o < 1 ? `blur(${(1 - o) * 10}px)` : "";
      (p.firstElementChild as HTMLElement).style.transform = `translateY(${-dd * (mobile ? 24 : 60)}px)`;
      (p.lastElementChild as HTMLElement).style.transform = `translateY(${dd * (mobile ? 8 : 24)}px)`;
    });
    shade.style.opacity = String(shadeOpacity);

    // Depth of field: everything but the described part dims and blurs.
    parts.forEach((el) => {
      const focus = el.dataset.part === cam.part;
      const k = focus ? 0 : cam.w;
      el.style.opacity = String(1 - k * 0.55);
      el.style.filter = k > 0.01 ? `blur(${k * 1.2}px)` : "";
    });

    const oe = clamp((u - (total - 0.75)) / 0.35);
    outro.style.opacity = String(oe);
    outro.style.transform = `translateY(${(1 - oe) * 40}px)`;
    outro.style.filter = oe > 0 && oe < 1 ? `blur(${(1 - oe) * 8}px)` : "";
  }

  let ticking = false;
  const request = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(render);
    }
  };
  const init = () => { measure(); layout(); render(); };
  addEventListener("scroll", request, { passive: true });
  let frame = 0;
  addEventListener("resize", () => {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = 0; init(); });
  });
  document.fonts?.ready.then(init);
  init();
}
