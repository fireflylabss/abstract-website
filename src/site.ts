export const repository = "https://github.com/fireflylabss/abstract";
export const releasesUrl = repository + "/releases";
export const latestUrl = releasesUrl + "/latest";
export const apiUrl = "https://api.github.com/repos/fireflylabss/abstract/releases";
export const sitePath = (path: string) =>
  path.startsWith("/") ? import.meta.env.BASE_URL.replace(/\/$/, "") + path : path;

export const docsLinks = [
  ["", "Overview"], ["getting-started", "Getting started"],
  ["spaces-and-notes", "Spaces & notes"], ["markdown", "Markdown"],
  ["links", "Links & backlinks"], ["search", "Search"], ["themes", "Themes"],
  ["keyboard", "Keyboard"], ["install", "Install"], ["build", "Build from source"],
] as const;
