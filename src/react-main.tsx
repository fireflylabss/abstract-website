import { useState } from "react";
import { createRoot } from "react-dom/client";
import { QuartzPortalProvider } from "@/lib/quartz/portal";
import { ModeProvider } from "./modes";
import { Shell } from "./shell";
import { Home } from "./home";
import { DownloadDialog } from "./download";
import { DocsPage } from "./docs-page";
import { ChangelogPage } from "./changelog-page";
import { useReleases } from "./releases";
import "@/components/quartz/styles.css";
import "./site.css";
import "./brand.css";

function App() {
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const releaseState = useReleases(true);
  const release = releaseState.status === "ready" ? releaseState.releases[0] : undefined;
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const path = location.pathname.slice(base.length);
  const route = path.endsWith("/") ? path : path + "/";
  const home = route === "/";
  return <ModeProvider><Shell home={home} openDownloads={() => setDownloadsOpen(true)}>
    {home ? <Home release={release} openDownloads={() => setDownloadsOpen(true)} /> :
      route.startsWith("/docs/") ? <DocsPage route={route} /> : <ChangelogPage />}
    <DownloadDialog open={downloadsOpen} onOpenChange={setDownloadsOpen} release={release} />
  </Shell></ModeProvider>;
}

createRoot(document.getElementById("root")!).render(
  <QuartzPortalProvider><App /></QuartzPortalProvider>,
);
