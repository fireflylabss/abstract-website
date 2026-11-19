import type { ContentNode } from "./content";

export function inlineMarkdown(text: string): ContentNode[] {
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s<]+)|\*\*([^*]+)\*\*|`([^`]+)`/g;
  const result: ContentNode[] = [];
  let position = 0;
  for (const match of text.matchAll(pattern)) {
    result.push(text.slice(position, match.index));
    if (match[2] || match[3]) result.push({ tag: "a", attrs: { href: match[2] ?? match[3], target: "_blank" }, children: [match[1] ?? match[3]] });
    else result.push({ tag: match[4] ? "strong" : "code", children: [match[4] ?? match[5]] });
    position = match.index! + match[0].length;
  }
  result.push(text.slice(position));
  return result;
}

export function releaseMarkdown(source: string): ContentNode[] {
  const result: ContentNode[] = [];
  let paragraph: string[] = [];
  let list: ContentNode[] = [];
  let fence: string[] | null = null;
  const flush = () => {
    if (paragraph.length) result.push({ tag: "p", children: inlineMarkdown(paragraph.join(" ")) });
    if (list.length) result.push({ tag: "ul", children: list });
    paragraph = []; list = [];
  };
  for (const raw of source.split(/\r?\n/)) {
    if (raw.startsWith("```")) {
      flush();
      if (fence) { result.push({ tag: "pre", children: [fence.join("\n")] }); fence = null; }
      else fence = [];
      continue;
    }
    if (fence) { fence.push(raw); continue; }
    const bullet = raw.match(/^\s*[-*]\s+(.*)/);
    const heading = raw.match(/^(#{1,6})\s+(.*)/);
    if (bullet) {
      if (paragraph.length) flush();
      list.push({ tag: "li", children: inlineMarkdown(bullet[1]) });
    } else if (heading) {
      flush();
      result.push({ tag: heading[1].length <= 2 ? "h3" : "h4", children: inlineMarkdown(heading[2]) });
    } else if (!raw.trim()) flush();
    else {
      if (list.length) flush();
      paragraph.push(raw.trim());
    }
  }
  flush();
  if (fence) result.push({ tag: "pre", children: [fence.join("\n")] });
  return result;
}
