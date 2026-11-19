import { Badge } from "@/components/quartz/ui/badge";
import { RelativeTime } from "@/components/quartz/ui/relative-time";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/quartz/ui/empty-state";
import { SkeletonSwap, SkeletonText } from "@/components/quartz/ui/skeleton";
import { Content } from "./content";
import { releaseMarkdown } from "./markdown";
import { useReleases, type ReleaseState } from "./releases";
import { releasesUrl } from "./site";

export function ReleaseList({ state }: { state: ReleaseState }) {
  if (state.status === "loading") return null;
  if (state.status === "error") return <Empty reason="error">
    <EmptyHeader><EmptyTitle>Couldn't load releases</EmptyTitle>
      <EmptyDescription>See them on <a href={releasesUrl} target="_blank" rel="noreferrer">GitHub Releases</a>.</EmptyDescription></EmptyHeader>
  </Empty>;
  if (!state.releases.length) return <Empty>
    <EmptyHeader><EmptyTitle>No releases yet</EmptyTitle>
      <EmptyDescription>Watch <a href={releasesUrl} target="_blank" rel="noreferrer">GitHub Releases</a> for the first release.</EmptyDescription></EmptyHeader>
  </Empty>;
  const latest = state.releases.find(release => !release.prerelease)?.tag_name;
  return <div className="release-list">{state.releases.map(release => <article key={release.tag_name} id={release.tag_name} className="release-entry">
    <header className="release-header">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="type-heading"><a href={release.html_url} target="_blank" rel="noreferrer">{release.name?.trim() || release.tag_name}</a></h2>
        {release.prerelease ? <Badge>Pre-release</Badge> : release.tag_name === latest && <Badge>Latest</Badge>}
      </div>
      {release.published_at && <RelativeTime date={release.published_at} className="type-body-sm text-text-3" />}
    </header>
    <div className="reading">{release.body?.trim() ? <Content nodes={releaseMarkdown(release.body)} /> : <p>No notes for this release.</p>}</div>
  </article>)}</div>;
}

export function ChangelogPage() {
  const state = useReleases();
  return <main id="main" className="page-content">
    <header className="mb-8 flex flex-col gap-4">
      <h1 className="type-display">Changelog.</h1>
      <p className="type-body-lg text-text-2">Every release of abstract, straight from <a href={releasesUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">GitHub Releases</a>.</p>
    </header>
    <SkeletonSwap loading={state.status === "loading"} label="Loading releases" fallback={
      <div className="flex flex-col gap-6"><SkeletonText type="heading" /><SkeletonText type="body-lg" lines={4} /><SkeletonText type="heading" /><SkeletonText type="body-lg" lines={3} /></div>
    }><ReleaseList state={state} /></SkeletonSwap>
  </main>;
}
