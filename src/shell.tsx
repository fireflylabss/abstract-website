import type { ReactNode } from "react";
import { Button } from "@/components/quartz/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/quartz/ui/tooltip";
import { Icon, Light, Asleep, Contrast } from "@/components/quartz/icon";
import { useModes } from "./modes";
import { docsLinks, repository, releasesUrl, sitePath } from "./site";

export function Logo() {
  const holes = new Set(["3,1", "4,1", "5,1", "2,2", "3,2", "5,2", "6,2", "1,3", "2,3", "6,3", "7,3", "1,4", "2,4", "6,4", "7,4", "1,5", "2,5", "3,5", "4,5", "5,5", "6,5", "7,5", "1,6", "2,6", "6,6", "7,6", "1,7", "2,7", "6,7", "7,7"]);
  return <svg className="brand-mark size-7 shrink-0" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
    {Array.from({ length: 81 }, (_, i) => {
      const x = i % 9; const y = Math.floor(i / 9);
      return holes.has(`${x},${y}`) ? null : <circle key={i} cx={x * 2 + 1} cy={y * 2 + 1} r="1" />;
    })}
  </svg>;
}

export function ThemeToggle() {
  const { preference, toggleTheme } = useModes();
  return <Tooltip>
    <TooltipTrigger render={<Button variant="ghost" size="icon" aria-label="Change theme" aria-description={`Current theme: ${preference}`} onClick={toggleTheme} />}>
      <Icon icon={preference === "system" ? Contrast : preference === "light" ? Light : Asleep} />
    </TooltipTrigger>
    <TooltipContent>Change theme</TooltipContent>
  </Tooltip>;
}

export function Header({ openDownloads }: { openDownloads: () => void }) {
  return <header className="site-header">
    <div className="site-header-inner">
      <a href={sitePath("/")} className="inline-flex items-center gap-2 type-heading-xs"><Logo /><span>Abstract</span></a>
      <nav aria-label="Primary" className="site-nav">
        <a href={sitePath("/docs/")} aria-current={location.pathname === sitePath("/docs/") ? "page" : undefined}>Docs</a>
        <a href={sitePath("/docs/#faq")}>FAQ</a>
        <a href={sitePath("/changelog/")} aria-current={location.pathname === sitePath("/changelog/") ? "page" : undefined}>Changelog</a>
      </nav>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <a href={repository} target="_blank" rel="noreferrer" className="type-label text-text-2">GitHub</a>
        <span className="hidden sm:contents"><Button variant="secondary" size="sm" onClick={openDownloads}>Download</Button></span>
      </div>
    </div>
  </header>;
}

export function Footer() {
  return <footer className="site-footer">
    <a href={sitePath("/")} className="inline-flex items-center gap-2 type-heading-xs"><Logo />Abstract</a>
    <div className="flex flex-wrap gap-6 type-body-sm text-text-2">
      <nav aria-label="Product" className="flex flex-wrap gap-4">
        <a href={sitePath("/")}>Home</a><a href={sitePath("/docs/install/")}>Download</a>
        <a href={sitePath("/docs/#faq")}>FAQ</a><a href={sitePath("/docs/")}>Docs</a><a href={sitePath("/changelog/")}>Changelog</a>
      </nav>
      <nav aria-label="Project" className="flex flex-wrap gap-4">
        <a href={repository} target="_blank" rel="noreferrer">GitHub</a>
        <a href={releasesUrl} target="_blank" rel="noreferrer">Releases</a>
        <a href={repository + "/issues"} target="_blank" rel="noreferrer">Issues</a>
        <a href={repository + "/blob/main/LICENSE"} target="_blank" rel="noreferrer">Apache-2.0</a>
      </nav>
    </div>
    <p className="type-body-sm text-text-3">© {new Date().getFullYear()} Firefly Labs</p>
  </footer>;
}

export function Shell({ children, home = false, openDownloads }: { children: ReactNode; home?: boolean; openDownloads: () => void }) {
  return <div className="site-shell">
    <a href="#main" className="sr-only focus:not-sr-only">Skip to content</a>
    <Header openDownloads={openDownloads} />
    {children}
    {!home && <Footer />}
  </div>;
}

export { docsLinks };
