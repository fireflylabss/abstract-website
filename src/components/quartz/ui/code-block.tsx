'use client';

import {useEffect, useRef, useState, type ReactNode} from 'react';
import {cva, type VariantProps} from 'class-variance-authority';
import {Icon, Return, View, ViewOff} from '@/components/quartz/icon';
import {Button} from '@/components/quartz/ui/button';
import {CopyButton} from '@/components/quartz/ui/copy-button';
import {maskSecret} from '@/components/quartz/ui/input/secret';
import type {Kind} from '@/lib/quartz/kind';
import {cn} from '@/lib/quartz/utils';

// Quartz's code: three forms of one thing (was Code block, Snippet and Inline code).
// - CodeBlock: one white frame with a 40px header (filename or language, wrap, copy) over a row rule and the code in a well. Line
//   numbers, highlighted lines (the wash, with the number in ink), and lines that scroll sideways
//   or wrap. kind sets data-kind on the frame, for the rare file that belongs to a kind (a prompt release's config); it draws no mark.
// - CodeBlock variant="command": shell commands with a prompt and copy, plus the output they print, in a well
//   with the frame's edge.
// - Code: an identifier, value or path inside a sentence, as a small well with no line.
// A secret keeps its length: one dot per hidden character, in text-3, between the prefix and the tail in ink
// (maskSecret, shared with the input's secret mode). MaskedKey writes a key the server keeps only the tail of.
// Syntax is ink at stepped alphas, never a rainbow: identifiers and numbers are ink, keywords are ink at
// the strong weight, strings and punctuation sit at 80%, comments at 66%. The one place hue meets code
// is a resource reference: an ID like run_8f2a gets a 2px underline in its kind's line step.
//
// The detail that comes from the job: copy takes what a person would run. In a command block the
// prompts and the printed output are never copied, and a secret shown as dots copies its real value, so
// nobody has to reveal a key or trim a $ to use the command.
//
// The tokenizer below is small on purpose. It knows comments, strings, numbers and keywords for the
// languages a dev tool shows, and nothing about grammar. Diff, terminal and log viewer reuse it.

// ---------- Tokenizer ----------

type Language = 'ts' | 'tsx' | 'js' | 'json' | 'bash' | 'python' | 'yaml' | 'text';
type TokenType = 'plain' | 'keyword' | 'string' | 'number' | 'comment' | 'punct' | 'key';
type Token = {type: TokenType; value: string; kind?: Kind; href?: string};
/** A resource reference: this exact text is underlined in the kind's hue, and links when href is set. */
type CodeRef = {text: string; kind: Kind; href?: string};

const jsKeywords = 'as async await break case catch class const continue default delete do else enum export extends false finally for from function if import in instanceof interface let new null of return static super switch this throw true try type typeof undefined var void while yield';
const config: Record<Language, {line?: string; block?: [string, string]; quotes: string; multi?: string; keywords: Set<string>; word: RegExp}> = {
  ts: {line: '//', block: ['/*', '*/'], quotes: `'"\``, multi: '`', keywords: new Set(jsKeywords.split(' ')), word: /^[A-Za-z_$][\w$]*/},
  tsx: {line: '//', block: ['/*', '*/'], quotes: `'"\``, multi: '`', keywords: new Set(jsKeywords.split(' ')), word: /^[A-Za-z_$][\w$]*/},
  js: {line: '//', block: ['/*', '*/'], quotes: `'"\``, multi: '`', keywords: new Set(jsKeywords.split(' ')), word: /^[A-Za-z_$][\w$]*/},
  json: {quotes: '"', keywords: new Set(['true', 'false', 'null']), word: /^[A-Za-z_]\w*/},
  bash: {line: '#', quotes: `'"`, keywords: new Set('if then else elif fi for while do done case esac in function export local return'.split(' ')), word: /^[A-Za-z_./@~-][\w./@~:=-]*/},
  python: {line: '#', quotes: `'"`, keywords: new Set('and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield'.split(' ')), word: /^[A-Za-z_]\w*/},
  yaml: {line: '#', quotes: `'"`, keywords: new Set(['true', 'false', 'null', 'yes', 'no']), word: /^[A-Za-z_][\w.-]*/},
  text: {quotes: '', keywords: new Set(), word: /^\S+/},
};

/** Resource IDs the tokenizer underlines without being told: run_, agt_, key_, dpl_ and mdl_ prefixes. */
const refPrefixes: Record<string, Kind> = {run: 'run', agt: 'agent', key: 'key', dpl: 'deploy', mdl: 'model'};
const refPattern = /\b(run|agt|key|dpl|mdl)_[A-Za-z0-9]{4,}\b/g;

type State = {block?: boolean; quote?: string};

function tokenizeLine(line: string, lang: Language, state: State): Token[] {
  const c = config[lang];
  const out: Token[] = [];
  const push = (type: TokenType, value: string) => {
    const last = out[out.length - 1];
    if (last && last.type === type) last.value += value; else out.push({type, value});
  };
  let i = 0;
  while (i < line.length) {
    const rest = line.slice(i);
    if (state.block && c.block) {
      const end = rest.indexOf(c.block[1]);
      if (end < 0) { push('comment', rest); break; }
      push('comment', rest.slice(0, end + c.block[1].length));
      i += end + c.block[1].length; state.block = false; continue;
    }
    if (state.quote) {
      let j = 0;
      while (j < rest.length && rest[j] !== state.quote) j += rest[j] === '\\' ? 2 : 1;
      if (j >= rest.length) { push('string', rest); break; }
      push('string', rest.slice(0, j + 1)); i += j + 1; state.quote = undefined; continue;
    }
    if (c.line && rest.startsWith(c.line) && (c.line !== '#' || i === 0 || /\s/.test(line[i - 1]))) { push('comment', rest); break; }
    if (c.block && rest.startsWith(c.block[0])) { state.block = true; push('comment', c.block[0]); i += c.block[0].length; continue; }
    const ch = line[i];
    if (c.quotes.includes(ch)) {
      let j = 1;
      while (j < rest.length && rest[j] !== ch) j += rest[j] === '\\' ? 2 : 1;
      if (j >= rest.length && c.multi?.includes(ch)) { state.quote = ch; push('string', rest); break; }
      const value = rest.slice(0, j + 1);
      i += value.length;
      // A JSON or YAML string followed by a colon is a key, which reads as ink.
      const isKey = (lang === 'json' || lang === 'yaml') && /^\s*:/.test(line.slice(i));
      push(isKey ? 'key' : 'string', value);
      continue;
    }
    if (/\s/.test(ch)) { const m = rest.match(/^\s+/)![0]; push('plain', m); i += m.length; continue; }
    if (lang !== 'text' && /\d/.test(ch) && !/[\w$]/.test(line[i - 1] ?? '')) {
      const m = rest.match(/^\d[\d_.xXa-fA-FeEn]*/)![0]; push('number', m); i += m.length; continue;
    }
    const word = rest.match(c.word);
    if (word) {
      const w = word[0];
      i += w.length;
      if (lang === 'yaml' && /^\s*:/.test(line.slice(i)) && !line.slice(0, i - w.length).trim().replace(/^-\s*/, '')) push('key', w);
      else push(c.keywords.has(w) ? 'keyword' : 'plain', w);
      continue;
    }
    push(lang === 'text' ? 'plain' : 'punct', ch);
    i += 1;
  }
  return out;
}

/** Splits plain and string tokens wherever a resource reference appears. */
function markRefs(tokens: Token[], refs: CodeRef[] = [], detect = true): Token[] {
  if (!refs.length && !detect) return tokens;
  const out: Token[] = [];
  for (const token of tokens) {
    if (token.type === 'comment' || token.type === 'keyword') { out.push(token); continue; }
    const hits: {start: number; end: number; kind: Kind; href?: string}[] = [];
    for (const ref of refs) {
      let at = token.value.indexOf(ref.text);
      while (at >= 0) { hits.push({start: at, end: at + ref.text.length, kind: ref.kind, href: ref.href}); at = token.value.indexOf(ref.text, at + ref.text.length); }
    }
    if (detect) for (const m of token.value.matchAll(refPattern)) {
      if (!hits.some(h => m.index! < h.end && m.index! + m[0].length > h.start)) hits.push({start: m.index!, end: m.index! + m[0].length, kind: refPrefixes[m[1]]});
    }
    if (!hits.length) { out.push(token); continue; }
    hits.sort((a, b) => a.start - b.start);
    let at = 0;
    for (const hit of hits) {
      if (hit.start < at) continue;
      if (hit.start > at) out.push({type: token.type, value: token.value.slice(at, hit.start)});
      out.push({type: token.type, value: token.value.slice(hit.start, hit.end), kind: hit.kind, href: hit.href});
      at = hit.end;
    }
    if (at < token.value.length) out.push({type: token.type, value: token.value.slice(at)});
  }
  return out;
}

/** Splits code into lines of ink-only tokens. Carries block comments and template strings across lines. */
function tokenize(code: string, language: Language = 'text', options: {refs?: CodeRef[]; detectRefs?: boolean} = {}): Token[][] {
  const state: State = {};
  return code.split('\n').map(line => markRefs(tokenizeLine(line, language, state), options.refs, options.detectRefs ?? true));
}

const tokenClass: Record<TokenType, string> = {
  plain: 'text-(--code-text)',
  key: 'text-(--code-text)',
  number: 'text-(--code-text)',
  keyword: 'text-(--code-text) font-semibold',
  string: 'text-(--code-string)',
  punct: 'text-(--code-string)',
  comment: 'text-(--code-comment)',
};

/** The 2px underline in a kind's hue, for a resource reference inside code. A model reference is dashed, so it never reads as the agent's neighbouring green. */
const refClass = 'underline [text-decoration-color:var(--accent-line)] decoration-2 underline-offset-3 [text-decoration-skip-ink:none] data-[kind=model]:[text-decoration-style:dashed]';

/** Renders one line of tokens. `mark` wraps search matches, as [start, end) offsets into the line. */
function TokenLine({tokens, marks, current}: {tokens: Token[]; marks?: [number, number][]; current?: number}) {
  if (!tokens.length) return <>{'\n'}</>;
  let offset = 0;
  return <>{tokens.map((token, i) => {
    const start = offset;
    offset += token.value.length;
    const body = marks?.length ? splitMarks(token.value, start, marks, current) : token.value;
    const cls = cn(tokenClass[token.type], token.kind && refClass);
    if (token.kind && token.href) return <a key={i} href={token.href} data-kind={token.kind} className={cn(cls, 'hover:decoration-3')}>{body}</a>;
    return <span key={i} data-kind={token.kind} className={cls}>{body}</span>;
  })}</>;
}

/** A search match inside code: an ink field under the text, and the current one inverted. */
const matchClass = 'rounded-inner bg-pressed text-(--code-text) shadow-[inset_0_-2px_0_var(--ink)]';
const currentMatchClass = 'rounded-inner bg-inverse text-text-inverse';

function splitMarks(value: string, start: number, marks: [number, number][], current?: number): ReactNode {
  const end = start + value.length;
  const parts: ReactNode[] = [];
  let at = start;
  marks.forEach(([a, b], m) => {
    if (b <= start || a >= end) return;
    const s = Math.max(a, start), e = Math.min(b, end);
    if (s > at) parts.push(value.slice(at - start, s - start));
    parts.push(<mark key={m} data-current={m === current || undefined} className={m === current ? currentMatchClass : matchClass}>{value.slice(s - start, e - start)}</mark>);
    at = e;
  });
  if (at < end) parts.push(value.slice(at - start));
  return parts;
}

/** "1,4-6" or [1, 4, 5, 6] to a set of 1-based line numbers. */
function parseLines(lines?: number[] | string): Set<number> {
  if (!lines) return new Set();
  if (Array.isArray(lines)) return new Set(lines);
  const out = new Set<number>();
  for (const part of lines.split(',')) {
    const [a, b] = part.trim().split('-').map(Number);
    if (!a) continue;
    for (let n = a; n <= (b || a); n++) out.add(n);
  }
  return out;
}

const languageLabels: Record<Language, string> = {ts: 'TypeScript', tsx: 'TSX', js: 'JavaScript', json: 'JSON', bash: 'Shell', python: 'Python', yaml: 'YAML', text: 'Text'};

// ---------- Copy ----------

/**
 * The 28px ghost copy button in every code header: CopyButton, so the confirm timing lives in one place.
 * text can be a function, so a long value (a 100,000-line log) is built on press instead of on every render.
 */
function CopyCodeButton({text, label = 'Copy code', size, className, onCopy, forceState}: {text: string | (() => string); label?: string; /** icon-xs in a 40px header, icon-sm alone on the code. */ size?: 'icon-xs' | 'icon-sm'; className?: string; onCopy?: (text: string) => void; forceState?: 'copied' | 'failed'}) {
  return <CopyButton data-slot="code-copy" size={size} forceState={forceState} value={text} aria-label={label} label={label.replace(/^Copy /, '')} onCopy={onCopy as never} className={cn('bg-transparent', className)}/>;
}

// ---------- Command lines ----------

type CommandLine = {kind: 'command' | 'output'; text: string};

/** Splits a command block: lines that start with the prompt are commands; the rest is output. */
function commandLines(code: string, prompt: string): CommandLine[] {
  const lines = code.replace(/\n$/, '').split('\n');
  const marker = prompt ? `${prompt} ` : '';
  const anyPrompt = !!marker && lines.some(l => l.startsWith(marker));
  return lines.map(l => !anyPrompt ? {kind: 'command', text: l} : l.startsWith(marker) ? {kind: 'command', text: l.slice(marker.length)} : {kind: 'output', text: l});
}

/** A mask split around its dots, so the dots can take text-3 while the prefix and the tail stay ink. */
function MaskText({masked}: {masked: string}) {
  const from = masked.indexOf('\u2022');
  const to = masked.lastIndexOf('\u2022') + 1;
  if (from < 0) return <>{masked}</>;
  return <>{masked.slice(0, from)}<span className="text-text-3">{masked.slice(from, to)}</span>{masked.slice(to)}</>;
}

function Masked({line, secret, revealed}: {line: string; secret?: string; revealed: boolean}) {
  if (!secret || revealed || !line.includes(secret)) return <TokenLine tokens={tokenize(line, 'bash')[0]}/>;
  const parts = line.split(secret);
  return <>{parts.flatMap((part, i) => {
    const text = <TokenLine key={`t${i}`} tokens={tokenize(part, 'bash')[0]}/>;
    // The dots cannot be selected, and the spoken "hidden secret" is generated content, so a hand selection
    // copies the command around the secret and nothing that looks like a key. Reveal first to copy it all.
    return i === 0 ? [text] : [<span key={`s${i}`} data-slot="code-block-secret" className="select-none before:sr-only before:content-['hidden_secret']"><span aria-hidden><MaskText masked={maskSecret(secret)}/></span></span>, text];
  })}</>;
}

// ---------- Code block ----------

type CodeBlockProps = Omit<React.ComponentProps<'figure'>, 'children' | 'onCopy'> & {
  /** The source, as one string. A trailing newline is dropped. In a command block, lines starting with the prompt are commands and the rest is output. */
  code?: string;
  /** block: a file or excerpt. command: shell commands with a prompt; copy takes only the commands. */
  variant?: 'block' | 'command';
  /** Commands, one per line, as an alternative to code in a command block. */
  command?: string | string[];
  /** The prompt in a command block. Never selected or copied. */
  prompt?: string;
  /** A substring to hide behind dots until revealed. Copy always takes the real value. */
  secret?: string;
  defaultRevealed?: boolean;
  /** Sets the tokenizer and the header label when there is no filename. */
  language?: Language;
  /** Shown in the header in place of the language. */
  filename?: string;
  /** Show the header row with the filename or language, the wrap toggle and copy. Block only. */
  header?: boolean;
  /** Line numbers in a gutter that copy and selection skip. Block only. */
  lineNumbers?: boolean;
  /** 1-based lines to highlight: [3, 4] or "3-4,9". */
  highlight?: number[] | string;
  /** Start wrapped instead of scrolling sideways. The header toggle switches it. */
  defaultWrap?: boolean;
  /** The first line's number, for an excerpt from a longer file. */
  startLine?: number;
  /** Resource references to underline in their kind's line step, on top of the run_, agt_, key_, dpl_ and mdl_ IDs found by default. */
  refs?: CodeRef[];
  /** Turn off the automatic ID detection. */
  detectRefs?: boolean;
  /** px. Past this the body scrolls. */
  maxHeight?: number;
  /** Command block height: 28 or 36px per line. */
  size?: 'sm' | 'default';
  /** Accessible name of the copy button. */
  copyLabel?: string;
  /** The kind the file belongs to: sets data-kind on the frame; it draws no mark. Rare. */
  kind?: Kind;
  /** Called after the copy reaches the clipboard, with what was copied. */
  onCopy?: (text: string) => void;
  /** Shows the copy button's copied or failed state without a press, for docs. */
  forceCopyState?: 'copied' | 'failed';
};

function CodeBlock(props: CodeBlockProps) {
  return props.variant === 'command' || props.command !== undefined ? <CommandBlock {...props}/> : <FileBlock {...props}/>;
}

function FileBlock({code = '', language = 'text', filename, header = true, lineNumbers = true, highlight, defaultWrap = false, startLine = 1, refs, detectRefs, maxHeight, copyLabel, onCopy, forceCopyState, kind, className, variant: _variant, command: _command, prompt: _prompt, secret: _secret, defaultRevealed: _dr, size: _size, ...props}: CodeBlockProps) {
  const [wrap, setWrap] = useState(defaultWrap);
  const source = code.replace(/\n$/, '');
  const lines = tokenize(source, language, {refs, detectRefs});
  const marked = parseLines(highlight);
  const digits = String(startLine + lines.length - 1).length;
  const name = filename ?? languageLabels[language];

  return <figure
    data-slot="code-block"
    data-variant="block"
    data-wrap={wrap || undefined}
    data-kind={kind}
    className={cn('frame flex min-w-0 flex-col bg-page text-text-1', className)}
    {...props}
  >
    {header && <figcaption data-slot="code-block-header" className="@container/header frame-head rule-row">
      <span className={cn('min-w-0 truncate', filename ? 'type-tag text-text-1' : 'type-label-sm text-text-2')}>{name}</span>
      {filename && language !== 'text' && <span className="type-label-sm text-text-3 @max-xs/header:hidden">{languageLabels[language]}</span>}
      <span className="frame-head-action">
        <Button data-slot="code-block-wrap" variant="ghost" size="icon-xs" aria-label="Wrap lines" aria-pressed={wrap} onClick={() => setWrap(w => !w)} className={cn('bg-transparent', wrap && 'bg-pressed')}>
          <Icon icon={Return} size={16}/>
        </Button>
        <CopyCodeButton size="icon-xs" text={source} label={copyLabel} onCopy={onCopy} forceState={forceCopyState}/>
      </span>
    </figcaption>}
    <div
      data-slot="code-block-body"
      tabIndex={0}
      role="region"
      aria-label={name}
      dir="ltr"
      className={cn('well relative min-h-0 overflow-auto py-3 text-(--code-text) focus-visible:focus-ring-inset [scrollbar-width:thin]', !header && 'pe-10')}
      style={maxHeight ? {maxHeight} : undefined}
    >
      <pre className={cn('type-code', wrap ? 'w-full' : 'w-max min-w-full')}>
        <code className="block">
          {lines.map((tokens, i) => {
            const n = startLine + i;
            const on = marked.has(n);
            return <span
              key={i}
              data-slot="code-block-line"
              data-highlighted={on || undefined}
              // A highlighted line takes the wash, and its number turns ink. Never a bar on its edge: no side rails.
              className={cn('flex pe-4', !lineNumbers && 'ps-4', on && 'bg-accent-wash forced-colors:outline forced-colors:outline-1 forced-colors:-outline-offset-1')}
            >
              {lineNumbers && <span aria-hidden className={cn('sticky start-0 shrink-0 bg-well ps-4 pe-4 text-end text-(--code-comment) select-none', on && 'text-(--code-text)')} style={{width: `calc(${digits}ch + 32px)`}}>
                {on && <span className="absolute inset-0 bg-accent-wash"/>}
                <span className="relative">{n}</span>
              </span>}
              {/* "Highlighted" is generated content: read aloud, never selected or copied with the code. */}
              <span className={cn('min-w-0 flex-1', wrap ? 'whitespace-pre-wrap [overflow-wrap:anywhere]' : 'whitespace-pre', on && "before:sr-only before:content-['Highlighted:_']")}>
                <TokenLine tokens={tokens}/>
              </span>
            </span>;
          })}
        </code>
      </pre>
    </div>
    {!header && <span className="absolute end-1.5 top-1.5"><CopyCodeButton text={source} label={copyLabel} onCopy={onCopy} forceState={forceCopyState}/></span>}
  </figure>;
}

/** True while a scroller has more content past its right edge, so the edge can fade instead of cutting a glyph. */
function useMoreRight() {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setMore(Math.abs(el.scrollLeft) + el.clientWidth < el.scrollWidth - 1);
    check();
    el.addEventListener('scroll', check, {passive: true});
    const ro = new ResizeObserver(check);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => { el.removeEventListener('scroll', check); ro.disconnect(); };
  }, []);
  return [ref, more] as const;
}

function CommandBlock({code, command, prompt = '$', secret, defaultRevealed = false, size = 'default', copyLabel = 'Copy command', onCopy, forceCopyState, className, variant: _variant, language: _l, filename: _f, header: _h, lineNumbers: _n, highlight: _hl, defaultWrap: _w, startLine: _s, refs: _r, detectRefs: _d, kind: _k, maxHeight, ...props}: CodeBlockProps) {
  const [revealed, setRevealed] = useState(defaultRevealed);
  const lines = command !== undefined
    ? (Array.isArray(command) ? command : [command]).map(text => ({kind: 'command' as const, text}))
    : commandLines(code ?? '', prompt);
  const commands = lines.filter(l => l.kind === 'command').map(l => l.text);
  const copyText = commands.join('\n');
  const sm = size === 'sm';
  const [bodyRef, more] = useMoreRight();

  return <figure
    data-slot="code-block"
    data-variant="command"
    data-size={size}
    className={cn(
      'group/command frame well flex min-w-0 items-start gap-1 text-(--code-text)',
      sm ? 'min-h-(--control-sm) py-0.5 ps-3 pe-0.5 type-code-sm [--command-line:--spacing(6)]' : 'min-h-(--control) py-1 ps-4 pe-1 type-code [--command-line:--spacing(7)]',
      className,
    )}
    {...props}
  >
    <div
      ref={bodyRef}
      data-slot="code-block-body"
      data-fade={more ? 'end' : undefined}
      tabIndex={0}
      role="region"
      aria-label={commands.length > 1 ? 'Commands' : 'Command'}
      dir="ltr"
      className="relative min-w-0 flex-1 overflow-auto outline-offset-0 [scrollbar-width:thin] fade-x"
      style={maxHeight ? {maxHeight} : undefined}
    >
      <pre className="w-max min-w-full">
        {lines.map((line, i) => <div key={i} data-slot={line.kind === 'command' ? 'code-block-command' : 'code-block-output'} className={cn('flex items-center leading-(--command-line) whitespace-pre', line.kind === 'output' && 'text-(--code-string)')}>
          {/* value-ok: one character after the prompt, the space a shell prints there */}
          {line.kind === 'command' && prompt && <span aria-hidden data-slot="code-block-prompt" className="me-[1ch] text-(--code-prompt) select-none">{prompt}</span>}
          <code>{line.kind === 'command' ? <Masked line={line.text} secret={secret} revealed={revealed}/> : line.text || ' '}</code>
        </div>)}
      </pre>
    </div>
    <span className={cn('flex shrink-0 items-center gap-0.5', sm ? 'h-6' : 'h-7')}>
      {secret && <Button
        data-slot="code-block-reveal"
        variant="ghost"
        size={sm ? 'icon-xs' : 'icon-sm'}
        aria-label={revealed ? 'Hide secret' : 'Show secret'}
        aria-pressed={revealed}
        onClick={() => setRevealed(r => !r)}
        className="bg-transparent"
      ><Icon icon={revealed ? ViewOff : View} size={16}/></Button>}
      <CopyCodeButton text={copyText} label={copyLabel} onCopy={onCopy} forceState={forceCopyState} size={sm ? 'icon-xs' : 'icon-sm'}/>
    </span>
  </figure>;
}

// ---------- Inline code ----------

const codeVariants = cva(
  'rounded-inner px-1 py-px font-mono text-(length:--code-inline) leading-none [font-feature-settings:var(--features-id)] text-(--code-text) [box-decoration-break:clone] forced-colors:border forced-colors:border-[CanvasText]',
  {
    variants: {
      variant: {
        default: 'well',
        plain: 'bg-transparent px-0 forced-colors:border-0',
      },
    },
    defaultVariants: {variant: 'default'},
  },
);

type CodeProps = React.ComponentProps<'code'> & VariantProps<typeof codeVariants> & {
  /** Marks a resource reference: a 2px underline in this kind's line step. */
  kind?: Kind;
  /** Links the reference to its resource. */
  href?: string;
};

/**
 * Inline code. Up to 32 characters it never wraps, so a short identifier is never split; a longer value
 * (a path, a hash) breaks anywhere rather than overflowing its line.
 */
function Code({className, variant = 'default', kind, href, children, ...props}: CodeProps) {
  const short = typeof children === 'string' && children.length <= 32;
  const code = <code
    data-slot="code"
    data-kind={href ? undefined : kind}
    className={cn(codeVariants({variant}), short ? 'whitespace-nowrap' : '[overflow-wrap:anywhere]', kind && refClass, className)}
    {...props}
  >{children}</code>;
  if (!href) return code;
  return <a data-slot="code-link" data-kind={kind} href={href} className="rounded-inner [&:hover>code]:decoration-3 [&:hover>code]:bg-pressed">{code}</a>;
}

type MaskedKeyProps = Omit<React.ComponentProps<'span'>, 'children'> & {
  /** The part of the key that is safe to show: "sk_demo_". */
  prefix: string;
  /** The last characters the server kept: "i0p0". */
  tail: string;
  /** The key's full length, so the mask keeps it: one dot per hidden character. */
  length: number;
};

/**
 * A key the server keeps only the tail of, in a table or a list: the prefix and the tail in ink with one dot per
 * hidden character between them in text-3, so the masked key is as long as the real one ("sk_demo_••••••••i0p0").
 * Screen readers hear "sk_demo_ key, ending in i0p0".
 */
function MaskedKey({prefix, tail, length, className, ...props}: MaskedKeyProps) {
  const hidden = Math.max(0, length - prefix.length - tail.length);
  return <span data-slot="masked-key" className={cn('type-tag whitespace-nowrap text-text-1', className)} {...props}>
    <span aria-hidden>{prefix}<span className="text-text-3">{'\u2022'.repeat(hidden)}</span>{tail}</span>
    <span className="sr-only">{`${prefix} key, ending in ${tail}`}</span>
  </span>;
}

export {
  CodeBlock, Code, CopyCodeButton, MaskedKey, TokenLine, tokenize, parseLines, commandLines, codeVariants,
  refClass, matchClass, currentMatchClass, languageLabels,
  type CodeBlockProps, type CodeProps, type CodeRef, type Language, type MaskedKeyProps, type Token, type TokenType,
};
