# Quartz migration exceptions

- `src/brand.css`: the explicitly retained electric-blue brand pair for the Dot cut hero and currentColor logo.
- `src/dot-cut/scenes.ts`: the installed visual's palette and fixed scene parameters.
- `src/dot-cut/engine.ts:368`: computed RGB interpolation between scene palette colors, not a site UI color.
- `src/site.css`: the required 1344/620 hero and the real media's aspect ratios are content geometry. Responsive breakpoints and viewport-relative layout are not component styling tokens.

Docs navigation is composed from Quartz Item links, with a Collapsible mobile navigation section and a Collapsible on-this-page section. No sidebar component was invented.
