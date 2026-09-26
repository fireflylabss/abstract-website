import "./style.css";
import "./zoom.css";
import { animate, inView, stagger } from "motion";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { mountZoom } from "./zoom";
import { setupTheme } from "./theme";

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const root = document.documentElement;
const asset = (p: string) => import.meta.env.BASE_URL.replace(/\/$/, "") + p;

/* ── theme + media sync ───────────────────────────────────────────────── */
function syncMedia() {
  const dark = root.dataset.theme === "dark";
  document.querySelectorAll<HTMLVideoElement>("video[data-light]").forEach((v) => {
    const src = asset((dark ? v.dataset.dark : v.dataset.light)!);
    const poster = asset((dark ? v.dataset.posterDark : v.dataset.posterLight) ?? "");
    v.poster = poster;
    v.addEventListener("error", () => { v.controls = true; }, { once: true });
    if (!v.src.endsWith(src)) {
      v.src = src;
      v.load();
      const r = v.getBoundingClientRect();
      if (!reduced && r.bottom > 0 && r.top < innerHeight)
        v.play().catch(() => { v.controls = true; });
    }
  });
}

setupTheme(reduced, syncMedia);
syncMedia();

/* ── scroll-driven zoom stage ─────────────────────────────────────────── */
mountZoom(reduced);

/* ── smooth scroll ────────────────────────────────────────────────────── */
if (!reduced) {
  const lenis = new Lenis({ lerp: 0.1, anchors: { offset: -96 } });
  const raf = (t: number) => {
    lenis.raf(t);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
}

/* ── latest release badge ─────────────────────────────────────────────── */
(async () => {
  try {
    const res = await fetch("https://api.github.com/repos/fireflylabss/abstract/releases/latest", {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return;
    const { tag_name, assets } = (await res.json()) as {
      tag_name?: string;
      assets?: { name: string; browser_download_url: string }[];
    };
    if (tag_name)
      document.querySelectorAll(".ver").forEach((el) => { el.textContent = tag_name; });
    const match = (re: RegExp) => assets?.find((a) => re.test(a.name));
    const wanted: Record<string, RegExp> = {
      "mac-arm": /macos-aarch64\.dmg$/,
      "mac-intel": /macos-x86_64\.dmg$/,
      "linux-tar": /linux-x86_64\.tar\.gz$/,
      "linux-tar-arm64": /linux-aarch64\.tar\.gz$/,
      "linux-deb": /_amd64\.deb$/,
      "linux-rpm": /\.x86_64\.rpm$/,
      "linux-appimage": /linux-x86_64\.AppImage$/,
      "win-exe": /windows-x86_64\.exe$/,
    };
    for (const [key, re] of Object.entries(wanted)) {
      const asset = match(re);
      if (!asset) continue;
      document.querySelectorAll<HTMLAnchorElement>(`a[data-asset="${key}"]`).forEach((a) => {
        a.href = asset.browser_download_url;
        a.setAttribute("download", "");
        a.removeAttribute("target");
        a.removeAttribute("rel");
      });
    }
  } catch {
    /* badges and links keep their fallbacks */
  }
})();

/* ── platform detection for download cards ────────────────────────────── */
{
  const ua = navigator.userAgent;
  const plat = /Mac|iPhone|iPad/i.test(ua) ? "mac" : /Win/i.test(ua) ? "win" : /Linux|X11/i.test(ua) ? "linux" : null;
  const cards = [...document.querySelectorAll<HTMLElement>(".plat.dl")];
  const primary = cards.find((c) => c.dataset.plat === plat);
  if (primary) {
    primary.classList.add("is-you");
    const tag = document.createElement("span");
    tag.className = "plat-detect";
    tag.textContent = "Detected";
    primary.appendChild(tag);
  }
  document.querySelectorAll<HTMLButtonElement>("[data-open]").forEach((b) => {
    const dialog = document.getElementById(b.dataset.open!) as HTMLDialogElement | null;
    if (!dialog) return;
    b.addEventListener("click", () => dialog.showModal());
  });
  document.querySelectorAll<HTMLDialogElement>(".dl-dialog").forEach((dialog) => {
    dialog.querySelector(".dl-close")?.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) dialog.close();
    });
  });
  cards.forEach((card) => {
    card.querySelectorAll<HTMLButtonElement>(".seg [role=radio]").forEach((b) => {
      b.addEventListener("click", () => {
        card.querySelectorAll<HTMLButtonElement>(".seg [role=radio]").forEach((o) => {
          o.setAttribute("aria-checked", String(o === b));
        });
        card.querySelectorAll<HTMLAnchorElement>("a[data-asset].btn").forEach((a) => {
          a.hidden = a.dataset.asset !== b.dataset.for;
        });
      });
    });
  });
}

/* ── active nav link ──────────────────────────────────────────────────── */
{
  const links = [...document.querySelectorAll<HTMLAnchorElement>(".topnav a[href^='#']")];
  const byId = new Map(links.map((a) => [a.hash.slice(1), a]));
  const spy = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const link = byId.get(e.target.id);
        if (!link) continue;
        if (e.isIntersecting) {
          links.forEach((a) => a.removeAttribute("aria-current"));
          link.setAttribute("aria-current", "true");
        }
      }
    },
    { rootMargin: "-40% 0px -55% 0px" },
  );
  byId.forEach((_, id) => {
    const el = document.getElementById(id);
    if (el) spy.observe(el);
  });
}

/* ── split headlines into words ───────────────────────────────────────── */
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

/* ── reveal on view ───────────────────────────────────────────────────── */
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

/* ── magnetic buttons ─────────────────────────────────────────────────── */
if (!reduced && matchMedia("(pointer: fine)").matches) {
  document.querySelectorAll<HTMLElement>(".btn").forEach((btn) => {
    btn.addEventListener("pointermove", (e) => {
      const r = btn.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width - 0.5) * 8;
      const y = ((e.clientY - r.top) / r.height - 0.5) * 8;
      animate(btn, { x, y }, { duration: 0.3 });
    });
    btn.addEventListener("pointerleave", () => {
      animate(btn, { x: 0, y: 0 }, { duration: 0.4 });
    });
  });
}

/* ── videos: only play while visible ──────────────────────────────────── */
if (reduced) {
  document.querySelectorAll<HTMLVideoElement>(".clip video").forEach((v) => {
    v.removeAttribute("autoplay");
    v.controls = true;
  });
} else {
  const playWhenVisible = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const v = e.target as HTMLVideoElement;
        if (e.isIntersecting) v.play().catch(() => { v.controls = true; });
        else v.pause();
      }
    },
    { threshold: 0.2 },
  );
  document.querySelectorAll<HTMLVideoElement>(".clip video").forEach((v) => playWhenVisible.observe(v));
}

document.getElementById("year")!.textContent = String(new Date().getFullYear());
