import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

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

// Shared chrome: `<!-- @topbar -->` / `<!-- @footer -->` are filled from src/partials so every page stays in sync.
const partials = () => ({
  name: "partials",
  transformIndexHtml: {
    order: "pre" as const,
    handler: (html: string, ctx: { filename: string }) => {
      const isHome = ctx.filename === page("./index.html");
      return html.replace(/<!-- @(topbar|footer) -->/g, (_, name: string) => {
        const part = readFileSync(page(`./src/partials/${name}.html`), "utf8");
        return isHome ? part.replace(/href="\/#/g, 'href="#') : part;
      });
    },
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
  plugins: [partials(), rebaseLinks(), legacyRedirects()],
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
