import "@fontsource/noto-sans/400.css";
import "@fontsource/noto-sans/400-italic.css";
import "@fontsource/noto-sans/500.css";
import "@fontsource/noto-sans/600.css";
import "@fontsource/noto-sans/700.css";
import "@fontsource/noto-sans-mono/400.css";
import "@fontsource/noto-sans-mono/500.css";
import "./style.css";
import "./docs.css";
import { setupTheme } from "./theme";

const lite = document.documentElement.classList.contains("lite");
setupTheme(lite);

const bar = document.getElementById("topbar");
const solid = () => bar?.classList.toggle("solid", scrollY > 8);
addEventListener("scroll", solid, { passive: true });
solid();

const year = document.getElementById("year");
if (year) year.textContent = String(new Date().getFullYear());

/* ── on-this-page TOC ─────────────────────────────────────────────────── */
{
  const container = document.querySelector<HTMLElement>(".docs");
  const body = document.querySelector<HTMLElement>(".docs-body");
  if (container && body) {
    const heads = [...body.querySelectorAll<HTMLHeadingElement>("h2")];
    if (heads.length >= 2) {
      const slug = (t: string) =>
        t.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
      heads.forEach((h) => {
        if (!h.id) h.id = slug(h.textContent ?? "");
      });
      const toc = document.createElement("nav");
      toc.className = "toc";
      toc.setAttribute("aria-label", "On this page");
      toc.innerHTML = `<p class="toc-heading label">On this page</p><ol>${heads
        .map((h) => `<li><a href="#${h.id}">${h.textContent}</a></li>`)
        .join("")}</ol>`;
      container.appendChild(toc);

      const links = [...toc.querySelectorAll<HTMLAnchorElement>("a")];
      const spy = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            const i = heads.indexOf(e.target as HTMLHeadingElement);
            if (i < 0 || !e.isIntersecting) continue;
            links.forEach((a) => a.removeAttribute("aria-current"));
            links[i].setAttribute("aria-current", "true");
          }
        },
        { rootMargin: "-96px 0px -70% 0px" },
      );
      heads.forEach((h) => spy.observe(h));
    }
  }
}
