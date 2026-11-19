import { Fragment, createElement, type ReactNode } from "react";
import { Button } from "@/components/quartz/ui/button";
import { Code, CodeBlock } from "@/components/quartz/ui/code-block";
import { Kbd } from "@/components/quartz/ui/kbd";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/quartz/ui/collapsible";
import { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell } from "@/components/quartz/ui/table";
import { assetUrl, type Release } from "./releases";
import { latestUrl, sitePath } from "./site";
import { useModes } from "./modes";

export type ContentNode = string | { tag: string; attrs?: Record<string, string | null>; children: ContentNode[]; action?: boolean; theme?: "light" | "dark" };
export const textContent = (node: ContentNode): string =>
  typeof node === "string" ? node : node.children.map(textContent).join("");
export const slug = (text: string) => text.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
export function safeHref(value: string) {
  return /^(https?:\/\/|\/(?!\/)|#|mailto:)/i.test(value) ? sitePath(value) : "#";
}

export function Content({ nodes, release }: { nodes: ContentNode[]; release?: Release }) {
  const { dark } = useModes();
  const render = (node: ContentNode, key: number): ReactNode => {
    if (typeof node === "string") return node;
    if (node.theme && node.theme !== (dark ? "dark" : "light")) return null;
    const attrs = node.attrs ?? {};
    const tableStructure = ["table", "thead", "tbody", "tfoot", "tr"].includes(node.tag);
    const children = node.children.filter(child => !tableStructure || typeof child !== "string" || child.trim()).map(render);
    const id = attrs.id ?? (node.tag === "h2" ? slug(textContent(node)) : undefined);
    switch (node.tag) {
      case "code": return <Code key={key}>{textContent(node)}</Code>;
      case "pre": return <CodeBlock key={key} language="text" variant={/^(xattr |paru |sudo |xcode-select |git |cargo |cd |npm |pnpm |yarn )/.test(textContent(node).trim()) ? "command" : "block"} code={textContent(node)} />;
      case "kbd": return <Kbd key={key}>{children}</Kbd>;
      case "table": return <Table key={key} aria-label={`Reference table ${key + 1}`}>{children}</Table>;
      case "thead": return <TableHeader key={key}>{children}</TableHeader>;
      case "tbody": return <TableBody key={key}>{children}</TableBody>;
      case "tfoot": return <TableFooter key={key}>{children}</TableFooter>;
      case "tr": return <TableRow key={key}>{children}</TableRow>;
      case "th": return <TableHead key={key} scope="col">{children}</TableHead>;
      case "td": return <TableCell key={key}>{children}</TableCell>;
      case "details": {
        const summary = node.children.find(child => typeof child !== "string" && child.tag === "summary");
        return <Collapsible key={key}><CollapsibleTrigger>{summary ? textContent(summary) : "Details"}</CollapsibleTrigger>
          <CollapsibleContent><div className="reading">{node.children.filter(child => child !== summary).map(render)}</div></CollapsibleContent></Collapsible>;
      }
      case "a": {
        const href = attrs["data-asset"] ? assetUrl(release, attrs["data-asset"]) : safeHref(attrs.href ?? "#");
        const direct = !!attrs["data-asset"] && href !== latestUrl;
        const link = <a href={href} download={direct || undefined} target={direct ? undefined : attrs.target ?? undefined} rel={!direct && attrs.target ? "noreferrer" : undefined} />;
        return node.action ? <Button key={key} nativeButton={false} role="link" variant="secondary" size="sm" render={link}>{children}</Button> :
          <a key={key} href={href} target={attrs.target ?? undefined} rel={attrs.target ? "noreferrer" : undefined} className="underline underline-offset-4">{children}</a>;
      }
      case "img": return <img key={key} src={sitePath(attrs.src ?? "")} alt={attrs.alt ?? ""} width={attrs.width ? Number(attrs.width) : undefined} height={attrs.height ? Number(attrs.height) : undefined} loading="lazy" decoding="async" />;
      case "br": return <br key={key} />;
      case "hr": return <hr key={key} />;
      case "span": return <span key={key} id={id ?? undefined} className={node.children.some(child => typeof child !== "string" && child.action) ? "inline-flex flex-wrap gap-2" : undefined}>{children}</span>;
      case "div": return <div key={key} id={id ?? undefined}>{children}</div>;
      case "h1": case "h2": case "h3": case "h4": case "p": case "ul": case "ol": case "li":
      case "strong": case "em": case "s": case "small": case "figure": case "figcaption": case "blockquote":
        return createElement(node.tag, { key, id }, children);
      default: return <Fragment key={key}>{children}</Fragment>;
    }
  };
  return <>{nodes.map(render)}</>;
}
