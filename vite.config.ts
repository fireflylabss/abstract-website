import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const page = (p: string) => fileURLToPath(new URL(p, import.meta.url));

const docs = [
  "index",
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
      const isHome = /(^|\/)index\.html$/.test(ctx.filename) && !/\/docs\//.test(ctx.filename);
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

export default defineConfig({
  base,
  plugins: [partials(), rebaseLinks()],
  build: {
    rollupOptions: {
      input: {
        main: page("./index.html"),
        changelog: page("./changelog.html"),
        ...Object.fromEntries(docs.map((p) => [`docs/${p}`, page(`./docs/${p}.html`)])),
      },
    },
  },
});
