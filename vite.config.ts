import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const page = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Every page is `<route>/index.html` so URLs stay extension-less on any static host.
const docs = [
  "getting-started",
  "spaces-and-notes",
  "markdown",
  "links",
  "search",
  "themes",
  "keyboard",
  "install",
  "build",
];

const base = process.env.BASE_PATH || "/";

const themePrepaint = () => ({
  name: "theme-prepaint",
  transformIndexHtml: () => [{
    tag: "script",
    injectTo: "head-prepend" as const,
    children: `(() => { let p = "system"; try { const t = localStorage.getItem("theme"); if (t === "dark" || t === "light") p = t; } catch {} document.documentElement.dataset.themePref = p; document.documentElement.dataset.theme = (p === "dark" || (p === "system" && matchMedia("(prefers-color-scheme: dark)").matches)) ? "dark" : "light"; })();`,
  }],
});

// Crawlers need absolute Open Graph URLs; the deploy workflow passes the site origin.
const site = process.env.SITE_URL?.replace(/\/$/, "");
const absoluteMeta = () => ({
  name: "absolute-meta",
  transformIndexHtml: {
    order: "pre" as const,
    handler: (html: string) =>
      site ? html.replace(/(<meta property="og:(?:image|url)" content=")\/(?!\/)/g, `$1${site}/`) : html,
  },
});

// Root-relative links (`href="/docs/"`) must follow the deploy base when the site lives under a subpath.
const rebaseLinks = () => ({
  name: "rebase-links",
  transformIndexHtml: (html: string) =>
    base === "/" ? html : html.replace(/(<a\b[^>]*?\shref=")\/(?!\/)/g, `$1${base}`),
});

// Old `<route>.html` URLs keep working through a meta-refresh stub.
const legacyRedirects = () => ({
  name: "legacy-redirects",
  generateBundle(this: { emitFile(f: { type: "asset"; fileName: string; source: string }): void }) {
    for (const route of ["changelog", ...docs.map((p) => `docs/${p}`)]) {
      const to = `${base}${route}/`;
      this.emitFile({
        type: "asset",
        fileName: `${route}.html`,
        source: `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${to}"><link rel="canonical" href="${to}"><a href="${to}">${to}</a>`,
      });
    }
  },
});

export default defineConfig({
  base,
  resolve: { alias: { "@": page("./src") } },
  plugins: [react(), tailwindcss(), themePrepaint(), rebaseLinks(), absoluteMeta(), legacyRedirects()],
  build: {
    rollupOptions: {
      input: {
        main: page("./index.html"),
        changelog: page("./changelog/index.html"),
        "docs/index": page("./docs/index.html"),
        ...Object.fromEntries(docs.map((p) => [`docs/${p}`, page(`./docs/${p}/index.html`)])),
      },
    },
  },
});
