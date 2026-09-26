import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

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

// Root-relative links (`href="/docs/"`) must follow the deploy base when the site lives under a subpath.
const rebaseLinks = () => ({
  name: "rebase-links",
  transformIndexHtml: (html: string) =>
    base === "/" ? html : html.replace(/(<a\b[^>]*?\shref=")\/(?!\/)/g, `$1${base}`),
});

export default defineConfig({
  base,
  plugins: [rebaseLinks()],
  build: {
    rollupOptions: {
      input: {
        main: page("./index.html"),
        ...Object.fromEntries(docs.map((p) => [`docs/${p}`, page(`./docs/${p}.html`)])),
      },
    },
  },
});
