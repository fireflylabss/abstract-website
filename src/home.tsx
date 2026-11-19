import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/quartz/ui/button";
import { Code } from "@/components/quartz/ui/code-block";
import { Kbd } from "@/components/quartz/ui/kbd";
import { Icon, Pause, Play, ChevronLeft, ChevronRight } from "@/components/quartz/icon";
import DotCutCard from "./dot-cut/card";
import { useModes } from "./modes";
import { assetUrl, preferredPlatform, type Release } from "./releases";
import { latestUrl, sitePath } from "./site";

const features = [
  { title: "A folder is a space.", description: <>The sidebar is your directory tree. Every note is a plain <Code>.md</Code> file, named after its first heading.</> },
  { title: "Search everything.", description: <><Kbd>⌘</Kbd><Kbd>P</Kbd> opens a palette over note titles and bodies. Empty, it jumps back to what you edited last.</>, video: "search" },
  { title: "Focus mode.", description: <><Kbd>⌘</Kbd><Kbd>\</Kbd> hides the sidebar. Just you and the text, until you press it again.</>, video: "focus" },
  { title: "Light, dark or system.", description: <>Two monochrome themes, no accent color fighting your text. <Kbd>⌘</Kbd><Kbd>⇧</Kbd><Kbd>L</Kbd> cycles, or it follows the system.</>, video: "theme" },
];

function FeatureVideo({ name, title }: { name: string; title: string }) {
  const { lite, dark } = useModes();
  const video = useRef<HTMLVideoElement>(null);
  const [manual, setManual] = useState(false);
  const source = sitePath(`/media/clip-${name}${dark ? "-dark" : ""}`);
  useEffect(() => {
    const current = video.current;
    if (!current) return;
    setManual(false);
    if (lite) current.pause();
    else void current.play().catch(() => setManual(true));
  }, [lite, source]);
  return <video ref={video} className="feature-media" src={source + ".mp4"} poster={source + ".jpg"}
    muted loop playsInline preload="metadata" controls={lite || manual} onError={() => setManual(true)} aria-label={title} />;
}

export function FeatureCarousel() {
  const { lite, dark } = useModes();
  const region = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  useEffect(() => {
    if (lite) return;
    setFocused(region.current?.contains(document.activeElement) ?? false);
    setHovered(region.current?.matches(":hover") ?? false);
  }, [lite]);
  useEffect(() => {
    const sync = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  useEffect(() => {
    if (lite || paused || hovered || focused || hidden) return;
    const timer = window.setInterval(() => setIndex(value => (value + 1) % features.length), 5200);
    return () => window.clearInterval(timer);
  }, [lite, paused, hovered, focused, hidden]);
  const feature = features[index];
  return <section ref={region} className="feature" aria-label="App features" aria-roledescription="carousel"
    onPointerEnter={event => { if (event.pointerType === "mouse") setHovered(true); }} onPointerLeave={() => setHovered(false)}
    onFocus={() => setFocused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    {feature.video ? <FeatureVideo key={index} name={feature.video} title={feature.title} /> :
      <img className="feature-media" src={sitePath(`/media/hero-${dark ? "dark" : "light"}.png`)} width="1100" height="720" alt="Abstract's notes editor showing a folder of markdown notes" />}
    <div className="flex min-w-0 flex-col gap-2">
      <div aria-live={focused || paused || lite ? "polite" : "off"} aria-atomic="true">
        <h2 className="type-heading-xs">{feature.title}</h2>
        <p className="type-body-sm text-text-2">{feature.description}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" aria-label="Previous feature" onClick={() => setIndex(value => (value + features.length - 1) % features.length)}><Icon icon={ChevronLeft} /></Button>
        <span className="type-label-sm text-text-3">{index + 1} / {features.length}</span>
        <Button variant="ghost" size="icon-sm" aria-label="Next feature" onClick={() => setIndex(value => (value + 1) % features.length)}><Icon icon={ChevronRight} /></Button>
        {!lite && <Button variant="ghost" size="icon-sm" aria-label="Pause feature rotation" pressed={paused} onPressedChange={setPaused}><Icon icon={paused ? Play : Pause} /></Button>}
      </div>
    </div>
  </section>;
}

export function Home({ openDownloads, release }: { openDownloads: () => void; release?: Release }) {
  const { lite } = useModes();
  const [paused, setPaused] = useState(false);
  const platform = preferredPlatform(navigator.userAgent);
  const download = assetUrl(release, platform.key);
  const direct = download !== latestUrl;
  return <main id="main" className="home-view">
    <div className="dot-hero">
      <DotCutCard paused={paused} lite={lite} />
      {!lite && <div className="hero-pause"><Button variant="secondary" size="icon-sm" aria-label="Pause hero animation" pressed={paused} onPressedChange={setPaused}><Icon icon={paused ? Play : Pause} /></Button></div>}
    </div>
    <div className="home-details">
      <div className="flex min-w-0 flex-col gap-4">
        <h1 className="home-headline">Your notes <em className="not-italic">outlive the app.</em></h1>
        <p className="type-body text-text-2">A minimal notes editor that treats your notes as what they are: plain <Code>.md</Code> files in real folders, on your disk. No accounts, no sync daemon, no proprietary format. The folder is the app.</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button nativeButton={false} role="link" render={<a href={download} download={direct || undefined} target={direct ? undefined : "_blank"} rel={direct ? undefined : "noreferrer"} />}>Download {platform.name === "Abstract" ? "Abstract" : `for ${platform.name}`}</Button>
          <Button variant="secondary" onClick={openDownloads}>All platforms</Button>
          {release?.tag_name && <span className="type-label-sm text-text-3">{release.tag_name}</span>}
        </div>
      </div>
      <FeatureCarousel />
    </div>
  </main>;
}
