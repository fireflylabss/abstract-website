import "./style.css";
import { animate, inView, stagger } from "motion";

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const root = document.documentElement;

/* ── theme toggle (light by default) ────────────────────────────────────── */
const themeBtn = document.getElementById("theme")!;
const metaTheme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!;
const applyTheme = (dark: boolean) => {
  root.dataset.theme = dark ? "dark" : "light";
  metaTheme.content = dark ? "#0a0a0a" : "#f6f6f4";
  themeBtn.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
};
applyTheme(root.dataset.theme === "dark");
themeBtn.addEventListener("click", () => {
  const dark = root.dataset.theme !== "dark";
  root.classList.add("switching");
  applyTheme(dark);
  localStorage.setItem("theme", dark ? "dark" : "light");
  setTimeout(() => root.classList.remove("switching"), 400);
});

/* ── split headlines into words ─────────────────────────────────────────── */
function splitWords(el: Element) {
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const frag = document.createDocumentFragment();
      for (const part of (node.textContent ?? "").split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) {
          frag.append(" ");
        } else {
          const w = document.createElement("span");
          w.className = "w";
          w.textContent = part;
          frag.append(w);
        }
      }
      node.parentNode?.replaceChild(frag, node);
    } else {
      [...node.childNodes].forEach(walk);
    }
  };
  [...el.childNodes].forEach(walk);
}
document.querySelectorAll("[data-split]").forEach(splitWords);

/* ── reveal on view ─────────────────────────────────────────────────────── */
if (!reduced) {
  inView(
    "[data-reveal]",
    (el) => {
      animate(el, { opacity: 1, y: 0 }, { duration: 0.9, ease: [0.22, 1, 0.36, 1] });
    },
    { margin: "0px 0px -10% 0px" },
  );

  inView(
    "[data-split]",
    (el) => {
      const words = el.querySelectorAll<HTMLElement>(".w");
      animate(
        words,
        { opacity: 1, y: 0 },
        { duration: 0.8, delay: stagger(0.045), ease: [0.22, 1, 0.36, 1] },
      );
      if (el.classList.contains("big")) {
        words.forEach((w, i) => setTimeout(() => w.classList.add("on"), 300 + i * 70));
      }
    },
    { margin: "0px 0px -15% 0px" },
  );
} else {
  document.querySelectorAll(".big .w").forEach((w) => w.classList.add("on"));
}

/* ── hero shot: subtle tilt ─────────────────────────────────────────────── */
const shot = document.getElementById("hero-shot");
if (shot && !reduced && matchMedia("(pointer: fine)").matches) {
  shot.addEventListener("pointermove", (e) => {
    const r = shot.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    shot.style.transform = `perspective(1400px) rotateX(${-y * 2}deg) rotateY(${x * 2}deg)`;
  });
  shot.addEventListener("pointerleave", () => {
    animate(shot, { transform: "perspective(1400px) rotateX(0deg) rotateY(0deg)" }, { duration: 0.6 });
  });
}

/* ── videos: only play while visible ────────────────────────────────────── */
const playWhenVisible = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      const v = e.target as HTMLVideoElement;
      if (e.isIntersecting) v.play().catch(() => {});
      else v.pause();
    }
  },
  { threshold: 0.2 },
);
document.querySelectorAll<HTMLVideoElement>(".clip video").forEach((v) => playWhenVisible.observe(v));

document.getElementById("year")!.textContent = String(new Date().getFullYear());
