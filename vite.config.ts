import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { dirname, relative, sep } from "node:path";

const page = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const root = page("./");

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

// Shared chrome: `<!-- @name -->` markers are filled from src/partials so every page stays in sync.
const partials = () => ({
  name: "partials",
  transformIndexHtml: {
    order: "pre" as const,
    handler: (html: string, ctx: { filename: string }) => {
      const isHome = ctx.filename === page("./index.html");
      const route = "/" + relative(root, dirname(ctx.filename)).split(sep).join("/");
      const self = route === "/" ? route : `${route}/`;
      return html.replace(/<!-- @(head|topbar|footer|docs-nav) -->/g, (_, name: string) => {
        const part = readFileSync(page(`./src/partials/${name}.html`), "utf8").trim();
        const marked = part.replace(`href="${self}"`, `href="${self}" aria-current="page"`);
        return isHome ? marked.replace(/href="\/#/g, 'href="#') : marked;
      });
    },
  },
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
  plugins: [partials(), rebaseLinks(), absoluteMeta(), legacyRedirects()],
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
