import "@fontsource/noto-sans/400.css";
import "@fontsource/noto-sans/400-italic.css";
import "@fontsource/noto-sans/500.css";
import "@fontsource/noto-sans/600.css";
import "@fontsource/noto-sans/700.css";
import "@fontsource/noto-sans-mono/400.css";
import "@fontsource/noto-sans-mono/500.css";
import "./style.css";
import "./changelog.css";
import { setupTheme } from "./theme";

const lite = document.documentElement.classList.contains("lite");
setupTheme(lite);

const bar = document.getElementById("topbar");
const solid = () => bar?.classList.toggle("solid", scrollY > 8);
addEventListener("scroll", solid, { passive: true });
solid();
document.getElementById("year")!.textContent = String(new Date().getFullYear());

/* ── minimal safe markdown renderer ───────────────────────────────────── */
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const inline = (s: string) =>
  esc(s)
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s<]+)/g,
      (_, text: string | undefined, url: string | undefined, bare: string | undefined) => {
        const href = url ?? bare!;
        return `<a href="${href}" target="_blank" rel="noreferrer">${text ?? href}</a>`;
      },
    )
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");

function md(src: string): string {
  const out: string[] = [];
  let list: string[] | null = null;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${para.map(inline).join(" ")}</p>`);
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      out.push(`<ul>${list.map((i) => `<li>${inline(i)}</li>`).join("")}</ul>`);
      list = null;
    }
  };
  for (const raw of src.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*]\s+(.*)/);
    const heading = line.match(/^(#{2,3})\s+(.*)/);
    if (bullet) {
      flushPara();
      (list ??= []).push(bullet[1]);
    } else if (heading) {
      flushPara();
      flushList();
      const level = heading[1].length === 2 ? "h3" : "h4";
      out.push(`<${level}>${inline(heading[2])}</${level}>`);
    } else if (!line.trim()) {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return out.join("\n");
}

/* ── releases ─────────────────────────────────────────────────────────── */
type Release = {
  tag_name: string;
  name: string | null;
  html_url: string;
  published_at: string | null;
  prerelease: boolean;
  draft: boolean;
  body: string | null;
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric" }) : "";

(async () => {
  const box = document.getElementById("releases")!;
  try {
    const res = await fetch("https://api.github.com/repos/fireflylabss/abstract/releases?per_page=30", {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) throw new Error(String(res.status));
    const releases = ((await res.json()) as Release[]).filter((r) => !r.draft);
    if (!releases.length) {
      box.innerHTML = `<p class="rel-loading">No releases yet — watch
        <a href="https://github.com/fireflylabss/abstract/releases" target="_blank" rel="noreferrer">GitHub Releases</a>.</p>`;
      return;
    }
    let latestSeen = false;
    box.innerHTML = releases
      .map((r) => {
        let badge = "";
        if (r.prerelease) badge = '<span class="rel-badge">Pre-release</span>';
        else if (!latestSeen) {
          latestSeen = true;
          badge = '<span class="rel-badge latest">Latest</span>';
        }
        const title = r.name?.trim() || r.tag_name;
        const body = r.body?.trim()
          ? md(r.body)
          : '<p class="rel-empty">No notes for this release.</p>';
        return `<article class="rel" id="${esc(r.tag_name)}">
  <header class="rel-head">
    <h2><a href="${esc(r.html_url)}" target="_blank" rel="noreferrer">${esc(title)}</a>${badge}</h2>
    <time datetime="${esc(r.published_at ?? "")}">${fmtDate(r.published_at)}</time>
  </header>
  <div class="rel-body">${body}</div>
</article>`;
      })
      .join("\n");
  } catch {
    box.innerHTML = `<p class="rel-loading">Couldn't load releases —
      <a href="https://github.com/fireflylabss/abstract/releases" target="_blank" rel="noreferrer">see them on GitHub</a>.</p>`;
  }
})();
