import { useEffect, useLayoutEffect, useState } from "react";
import { Item } from "@/components/quartz/ui/item";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/quartz/ui/collapsible";
import { Content, slug, textContent, type ContentNode } from "./content";
import docsContent from "./docs-content.json";
import { docsLinks, sitePath } from "./site";

export const allDocs = docsContent as Record<string, ContentNode[]>;
function DocsNavigation({ route }: { route: string }) {
  return <nav aria-label="Docs">{docsLinks.map(([path, name]) => {
    const href = "/docs/" + (path ? path + "/" : "");
    return <Item key={href} size="sm" selected={route === href} render={<a href={sitePath(href)} />}>{name}</Item>;
  })}</nav>;
}

export function DocsPage({ route }: { route: string }) {
  const nodes = allDocs[route] ?? allDocs["/docs/"];
  useLayoutEffect(() => {
    if (!location.hash) return;
    let id = location.hash.slice(1);
    try { id = decodeURIComponent(id); } catch {}
    document.getElementById(id)?.scrollIntoView();
  }, [route]);
  const headings = nodes.filter(node => typeof node !== "string" && node.tag === "h2").map(node => ({
    title: textContent(node), id: typeof node === "string" ? "" : node.attrs?.id ?? slug(textContent(node)),
  }));
  const [active, setActive] = useState("");
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id);
    }, { rootMargin: "-96px 0px -70% 0px" });
    document.querySelectorAll("article h2[id]").forEach(heading => observer.observe(heading));
    return () => observer.disconnect();
  }, [route]);
  return <main id="main" className="docs-layout">
    <aside className="docs-navigation">
      <div className="hidden md:block"><DocsNavigation route={route} /></div>
      <div className="md:hidden"><Collapsible><CollapsibleTrigger>Docs navigation</CollapsibleTrigger>
        <CollapsibleContent><DocsNavigation route={route} /></CollapsibleContent></Collapsible></div>
      {headings.length >= 2 && <Collapsible defaultOpen>
        <CollapsibleTrigger>On this page</CollapsibleTrigger>
        <CollapsibleContent><nav aria-label="On this page">
          {headings.map(heading => <Item key={heading.id} size="dense" selected={active === heading.id} render={<a href={"#" + heading.id} />}>{heading.title}</Item>)}
        </nav></CollapsibleContent>
      </Collapsible>}
    </aside>
    <article className="docs-content reading"><Content nodes={nodes} /></article>
  </main>;
}
