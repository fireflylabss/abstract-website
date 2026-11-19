import { act, cleanup, fireEvent, render, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ModeProvider, useModes, deviceQuery, reducedQuery } from "../src/modes";
import { assetUrl, preferredPlatform, useReleases, type Release } from "../src/releases";
import { ReleaseList } from "../src/changelog-page";
import { releaseMarkdown } from "../src/markdown";
import { allDocs } from "../src/docs-page";
import { Content, safeHref, textContent } from "../src/content";
import { FeatureCarousel } from "../src/home";
import { docsLinks } from "../src/site";
import { Button } from "../src/components/quartz/ui/button";

class Media extends EventTarget {
  matches = false;
  change(value: boolean) { this.matches = value; this.dispatchEvent(new Event("change")); }
}
const medias = new Map<string, Media>();
const media = (query: string) => {
  if (!medias.has(query)) medias.set(query, new Media());
  return medias.get(query)!;
};
beforeEach(() => {
  medias.clear(); localStorage.clear();
  vi.stubGlobal("matchMedia", (query: string) => media(query));
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const release: Release = { tag_name: "v1", name: "Version 1", html_url: "https://github.com/fireflylabss/abstract/releases/tag/v1", published_at: null, prerelease: false, draft: false, body: "## Changes\n- **Fast** notes\n- [Details](https://example.com)" };

it("follows the system, persists choices, and uses current Lite state for theme transitions", async () => {
  const transition = vi.fn((swap: () => void) => { swap(); return { ready: Promise.resolve() }; });
  Object.defineProperty(document, "startViewTransition", { configurable: true, value: transition });
  document.documentElement.animate = vi.fn();
  function Probe() { const mode = useModes(); return <Button onClick={mode.toggleTheme}>{mode.preference}</Button>; }
  const view = render(<ModeProvider><Probe /></ModeProvider>);
  expect(document.documentElement.dataset.theme).toBe("light");
  act(() => media("(prefers-color-scheme: dark)").change(true));
  expect(document.documentElement.dataset.theme).toBe("dark");
  act(() => media(deviceQuery).change(true));
  fireEvent.click(view.getByRole("button"));
  expect(transition).not.toHaveBeenCalled();
  expect(localStorage.getItem("theme")).toBe("light");
  act(() => media(deviceQuery).change(false));
  await act(async () => fireEvent.click(view.getByRole("button")));
  expect(transition).toHaveBeenCalledOnce();
  expect(document.documentElement.dataset.theme).toBe("dark");
  act(() => media(reducedQuery).change(true));
  expect(document.documentElement.classList.contains("lite")).toBe(true);
});

it("does not resume the carousel while focused after leaving Lite", () => {
  vi.useFakeTimers();
  const view = render(<ModeProvider><FeatureCarousel /></ModeProvider>);
  const next = view.getByRole("button", { name: "Next feature" });
  act(() => next.focus());
  expect(document.activeElement).toBe(next);
  act(() => media(deviceQuery).change(true));
  act(() => media(deviceQuery).change(false));
  act(() => vi.advanceTimersByTime(10400));
  expect(view.getByRole("heading").textContent).toBe("A folder is a space.");
});
it("rechecks actual focus when a focused control disappears in Lite mode", () => {
  vi.useFakeTimers();
  const view = render(<ModeProvider><FeatureCarousel /></ModeProvider>);
  const pause = view.getByRole("button", { name: "Pause feature rotation" });
  act(() => pause.focus());
  act(() => media(deviceQuery).change(true));
  expect(document.activeElement).toBe(document.body);
  act(() => media(deviceQuery).change(false));
  act(() => vi.advanceTimersByTime(5200));
  expect(view.getByRole("heading").textContent).toBe("Search everything.");
});

it("release API returns loading, populated and draft-filtered data", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [release, { ...release, draft: true }] }));
  const hook = renderHook(() => useReleases());
  expect(hook.result.current.status).toBe("loading");
  await waitFor(() => expect(hook.result.current.status).toBe("ready"));
  expect(hook.result.current).toEqual({ status: "ready", releases: [release] });
});
it("handles an empty release API", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
  const hook = renderHook(() => useReleases());
  await waitFor(() => expect(hook.result.current).toEqual({ status: "ready", releases: [] }));
});
it.each([
  { ok: false, status: 403 },
  { ok: true, json: async () => ({ message: "invalid shape" }) },
])("handles API errors and malformed responses", async response => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
  const hook = renderHook(() => useReleases());
  await waitFor(() => expect(hook.result.current.status).toBe("error"));
});
it("renders populated, empty, error and no-notes changelog states", () => {
  const view = render(<ReleaseList state={{ status: "ready", releases: [release] }} />);
  expect(view.getByText("Latest")).toBeTruthy();
  expect(view.getByText("Fast")).toBeTruthy();
  view.rerender(<ReleaseList state={{ status: "ready", releases: [{ ...release, body: "" }] }} />);
  expect(view.getByText("No notes for this release.")).toBeTruthy();
  view.rerender(<ReleaseList state={{ status: "ready", releases: [] }} />);
  expect(view.getByText("No releases yet")).toBeTruthy();
  view.rerender(<ReleaseList state={{ status: "error" }} />);
  expect(view.getByRole("alert").textContent).toContain("Couldn't load releases");
});
it("keeps markdown escaped and only allows safe link protocols", () => {
  const nodes = releaseMarkdown("<script>alert(1)</script>\n\n- `code`\n- [Safe](https://example.com)\n\n```\nx < y\n```");
  expect(nodes.map(textContent).join(" ")).toContain("<script>alert(1)</script>");
  expect(nodes.some(node => typeof node !== "string" && node.tag === "pre")).toBe(true);
  expect(safeHref("javascript:alert(1)")).toBe("#");
  expect(safeHref("//evil.example")).toBe("#");
  expect(releaseMarkdown("")).toEqual([]);
});
it("keeps all docs routes, copy, FAQ anchors and real media", () => {
  expect(Object.keys(allDocs)).toHaveLength(10);
  for (const [path] of docsLinks) {
    const nodes = allDocs["/docs/" + (path ? path + "/" : "")];
    expect(nodes).toBeTruthy();
    expect(nodes.some(node => typeof node !== "string" && node.tag === "h1")).toBe(true);
  }
  expect(JSON.stringify(allDocs["/docs/"])).toContain('"id":"faq"');
  expect(JSON.stringify(allDocs)).toContain("/media/docs/");
});
it("renders only the screenshot matching the current theme", () => {
  const view = render(<ModeProvider><Content nodes={allDocs["/docs/"]} /></ModeProvider>);
  expect(view.getAllByRole("img")).toHaveLength(1);
  expect(view.getByRole("img").getAttribute("src")).toContain("overview-light");
  act(() => media("(prefers-color-scheme: dark)").change(true));
  expect(view.getAllByRole("img")).toHaveLength(1);
  expect(view.getByRole("img").getAttribute("src")).toContain("overview-dark");
});
it("selects direct assets when available, otherwise keeps release links", () => {
  expect(assetUrl(undefined, "mac-arm")).toMatch(/releases\/latest$/);
  const url = "https://github.com/fireflylabss/abstract/releases/download/v1/abstract-macos-aarch64.dmg";
  expect(assetUrl({ ...release, assets: [{ name: "abstract-macos-aarch64.dmg", browser_download_url: url }] }, "mac-arm")).toBe(url);
  expect(preferredPlatform("Macintosh").name).toBe("macOS");
  expect(preferredPlatform("Windows").name).toBe("Windows");
  expect(preferredPlatform("Linux").name).toBe("Linux");
  expect(preferredPlatform("Unknown").name).toBe("Abstract");
});
it("direct asset buttons download in place while fallback links open releases", () => {
  const nodes = [{ tag: "a", attrs: { "data-asset": "mac-arm", target: "_blank" }, action: true, children: ["Apple Silicon"] }];
  const view = render(<Content nodes={nodes} />);
  expect(view.getByRole("link").getAttribute("target")).toBe("_blank");
  view.rerender(<Content nodes={nodes} release={{ ...release, assets: [{ name: "abstract-macos-aarch64.dmg", browser_download_url: "https://github.com/fireflylabss/abstract/releases/download/v1/abstract-macos-aarch64.dmg" }] }} />);
  expect(view.getByRole("link").hasAttribute("download")).toBe(true);
  expect(view.getByRole("link").hasAttribute("target")).toBe(false);
});
