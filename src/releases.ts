import { useEffect, useState } from "react";
import { apiUrl, latestUrl } from "./site";

export type Release = {
  tag_name: string; name: string | null; html_url: string; published_at: string | null;
  prerelease: boolean; draft: boolean; body: string | null;
  assets?: { name: string; browser_download_url: string }[];
};
export type ReleaseState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; releases: Release[] };

export function useReleases(latest = false) {
  const [state, setState] = useState<ReleaseState>({ status: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    let mounted = true;
    void fetch(apiUrl + (latest ? "/latest" : "?per_page=30"), {
      signal: controller.signal, headers: { Accept: "application/vnd.github+json" },
    }).then(async response => {
      if (!response.ok) throw new Error(String(response.status));
      const json: unknown = await response.json();
      const rows = latest ? [json] : json;
      if (!Array.isArray(rows) || !rows.every(isRelease)) throw new Error("Invalid release data");
      if (mounted) setState({ status: "ready", releases: rows.filter(row => !row.draft) });
    }).catch(() => {
      if (mounted) setState({ status: "error" });
    }).finally(() => window.clearTimeout(timeout));
    return () => { mounted = false; controller.abort(); window.clearTimeout(timeout); };
  }, [latest]);
  return state;
}

function isRelease(value: unknown): value is Release {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.tag_name === "string" && typeof row.html_url === "string" &&
    /^https:\/\/github\.com\//.test(row.html_url) &&
    (row.body === null || typeof row.body === "string") &&
    (row.published_at === null || typeof row.published_at === "string");
}

export const assetPatterns: Record<string, RegExp> = {
  "mac-arm": /macos-aarch64\.dmg$/, "mac-intel": /macos-x86_64\.dmg$/,
  "linux-tar": /linux-x86_64\.tar\.gz$/, "linux-tar-arm64": /linux-aarch64\.tar\.gz$/,
  "linux-deb": /_amd64\.deb$/, "linux-deb-arm64": /_arm64\.deb$/,
  "linux-rpm": /\.x86_64\.rpm$/, "linux-rpm-arm64": /\.aarch64\.rpm$/,
  "linux-appimage": /linux-x86_64\.AppImage$/, "linux-appimage-arm64": /linux-aarch64\.AppImage$/,
  "win-exe": /windows-x86_64\.exe$/, "win-zip": /windows-x86_64\.zip$/,
};
export function assetUrl(release: Release | undefined, key: string) {
  const asset = release?.assets?.find(asset => assetPatterns[key]?.test(asset.name));
  return asset && /^https:\/\/github\.com\//.test(asset.browser_download_url) ? asset.browser_download_url : latestUrl;
}
export function preferredPlatform(agent: string) {
  if (/Mac|iPhone|iPad/i.test(agent)) return { key: "mac-arm", name: "macOS" };
  if (/Win/i.test(agent)) return { key: "win-exe", name: "Windows" };
  if (/Linux|X11/i.test(agent)) return { key: "linux-appimage", name: "Linux" };
  return { key: "", name: "Abstract" };
}
