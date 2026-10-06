import "@fontsource/noto-sans/400.css";
import "@fontsource/noto-sans/400-italic.css";
import "@fontsource/noto-sans/500.css";
import "@fontsource/noto-sans/600.css";
import "@fontsource/noto-sans/700.css";
import "@fontsource/noto-sans-mono/400.css";
import "@fontsource/noto-sans-mono/500.css";
import "./style.css";
import { animate, inView, stagger } from "motion";
import { setupTheme } from "./theme";

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
// `html.lite` (set by the inline head script) means phones, touch devices or
// reduced motion: no smooth scroll, blur filters, word reveals or auto-rotation.
const root = document.documentElement;
const lite = reduced || root.classList.contains("lite");
root.classList.toggle("lite", lite);
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
      if (!lite && v.closest(".slide")?.classList.contains("on"))
        v.play().catch(() => { v.controls = true; });
    }
  });
}

setupTheme(lite, syncMedia);
syncMedia();

/* ── topbar ───────────────────────────────────────────────────────────── */
{
  const bar = document.getElementById("topbar");
  const solid = () => bar?.classList.toggle("solid", scrollY > 8);
  addEventListener("scroll", solid, { passive: true });
  solid();
}

/* ── feature rotation: one slide at a time, auto-advancing ────────────── */
{
  const CAPTIONS = [
    {
      h: "A folder is a space.",
      p: "The sidebar is your directory tree — every note is a plain <code>.md</code> file, named after its first heading.",
    },
    {
      h: "Search everything.",
      p: "<kbd>⌘</kbd><kbd>P</kbd> opens a palette over note titles and bodies. Empty, it jumps back to what you edited last.",
    },
    {
      h: "Focus mode.",
      p: "<kbd>⌘</kbd><kbd>\\</kbd> hides the sidebar. Just you and the text, until you press it again.",
    },
    {
      h: "Light, dark or system.",
      p: "Two monochrome themes, no accent color fighting your text. <kbd>⌘</kbd><kbd>⇧</kbd><kbd>L</kbd> cycles, or it follows the system.",
    },
  ];
  const show = document.getElementById("show");
  const slides = [...(show?.querySelectorAll<HTMLElement>(".slide") ?? [])];
  const capH = document.getElementById("cap-h");
  const capP = document.getElementById("cap-p");
  const dotsEl = document.getElementById("dots");
  if (show && slides.length && capH && capP && dotsEl) {
    const INTERVAL = 5200;
    show.style.setProperty("--rot", `${INTERVAL}ms`);
    const dots = slides.map((_, i) => {
      const d = document.createElement("button");
      d.className = "dot";
      d.type = "button";
      d.setAttribute("aria-label", CAPTIONS[i]?.h ?? `Slide ${i + 1}`);
      d.addEventListener("click", () => { activate(i); play(); });
      dotsEl.appendChild(d);
      return d;
    });
    dots[0]?.classList.add("on");

    let cur = 0;
    let timer = 0;
    const activate = (i: number) => {
      cur = i;
      slides.forEach((s, j) => {
        const on = j === i;
        s.classList.toggle("on", on);
        const v = s.querySelector<HTMLVideoElement>("video");
        if (v) {
          if (on && !lite) v.play().catch(() => { v.controls = true; });
          else v.pause();
        }
      });
      dots.forEach((d, j) => d.classList.toggle("on", j === i));
      const cap = CAPTIONS[i];
      if (cap) {
        capH.textContent = cap.h;
        capP.innerHTML = cap.p;
        if (!lite)
          animate([capH, capP], { opacity: [0, 1], y: [6, 0] }, { duration: 0.45, ease: [0.22, 1, 0.36, 1] });
      }
    };
    const play = () => {
      show.classList.remove("paused");
      if (lite) return;
      clearInterval(timer);
      show.classList.add("live");
      timer = setInterval(() => activate((cur + 1) % slides.length), INTERVAL);
    };
    const pause = () => {
      clearInterval(timer);
      timer = 0;
      show.classList.add("paused");
    };
    show.addEventListener("pointerenter", pause);
    show.addEventListener("pointerleave", play);
    show.addEventListener("focusin", pause);
    show.addEventListener("focusout", play);
    document.addEventListener("visibilitychange", () => (document.hidden ? pause() : play()));
    play();
  }
}

/* ── latest release badge + direct download links ─────────────────────── */
const platform = /Mac|iPhone|iPad/i.test(navigator.userAgent)
  ? "mac"
  : /Win/i.test(navigator.userAgent)
    ? "win"
    : /Linux|X11/i.test(navigator.userAgent)
      ? "linux"
      : null;

/* primary hero button: direct asset for the detected platform */
{
  const dl = document.getElementById("dl-main") as HTMLAnchorElement | null;
  const preferred: Record<string, { key: string; name: string }> = {
    mac: { key: "mac-arm", name: "macOS" },
    win: { key: "win-exe", name: "Windows" },
    linux: { key: "linux-appimage", name: "Linux" },
  };
  if (dl && platform && preferred[platform]) {
    dl.dataset.asset = preferred[platform].key;
    dl.textContent = `Download for ${preferred[platform].name}`;
  }
}

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
      "linux-deb-arm64": /_arm64\.deb$/,
      "linux-rpm": /\.x86_64\.rpm$/,
      "linux-rpm-arm64": /\.aarch64\.rpm$/,
      "linux-appimage": /linux-x86_64\.AppImage$/,
      "linux-appimage-arm64": /linux-aarch64\.AppImage$/,
      "win-exe": /windows-x86_64\.exe$/,
      "win-zip": /windows-x86_64\.zip$/,
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

/* ── download dialog (data-open) + build pickers ──────────────────────── */
{
  document.querySelectorAll<HTMLElement>("[data-open]").forEach((b) => {
    const dialog = document.getElementById(b.dataset.open!) as HTMLDialogElement | null;
    if (!dialog) return;
    b.addEventListener("click", (e) => {
      e.preventDefault();
      dialog.showModal();
    });
  });
  document.querySelectorAll<HTMLDialogElement>(".dl-dialog").forEach((dialog) => {
    dialog.querySelector(".dl-close")?.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) dialog.close();
    });
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
if (!lite) {
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
    },
    { margin: "0px 0px -15% 0px" },
  );
}

/* ── magnetic buttons ─────────────────────────────────────────────────── */
if (!lite && matchMedia("(pointer: fine)").matches) {
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

/* ── videos on lite: poster + tap to play ─────────────────────────────── */
if (lite) {
  document.querySelectorAll<HTMLVideoElement>(".clip video").forEach((v) => {
    v.removeAttribute("autoplay");
    v.controls = true;
  });
}

const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = String(new Date().getFullYear());
