import "./style.css";
import { animate, inView, stagger } from "motion";

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ── split headlines into words ─────────────────────────────────────────── */
function splitWords(el: Element) {
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const frag = document.createDocumentFragment();
      const parts = (node.textContent ?? "").split(/(\s+)/);
      for (const part of parts) {
        if (!part) continue;
        if (/^\s+$/.test(part)) {
          frag.append(" ");
        } else {
          const w = document.createElement("span");
          w.className = "w";
          w.textContent = part;
          frag.append(w);
        }
      }
      node.parentNode?.replaceChild(frag, node);
    } else {
      [...node.childNodes].forEach(walk);
    }
  };
  [...el.childNodes].forEach(walk);
}

document.querySelectorAll("[data-split]").forEach(splitWords);

/* ── reveal on view ─────────────────────────────────────────────────────── */
if (!reduced) {
  inView(
    "[data-reveal]",
    (el) => {
      animate(el, { opacity: 1, y: 0 }, { duration: 0.9, ease: [0.22, 1, 0.36, 1] });
    },
    { margin: "0px 0px -10% 0px" },
  );

  inView(
    "[data-split]",
    (el) => {
      const words = el.querySelectorAll<HTMLElement>(".w");
      animate(
        words,
        { opacity: 1, y: 0 },
        { duration: 0.8, delay: stagger(0.045), ease: [0.22, 1, 0.36, 1] },
      );
      if (el.classList.contains("big")) {
        words.forEach((w, i) => setTimeout(() => w.classList.add("on"), 300 + i * 70));
      }
    },
    { margin: "0px 0px -15% 0px" },
  );
} else {
  document.querySelectorAll(".big .w").forEach((w) => w.classList.add("on"));
}

/* ── hero window: subtle parallax tilt ──────────────────────────────────── */
const win = document.getElementById("demo");
if (win && !reduced && matchMedia("(pointer: fine)").matches) {
  win.addEventListener("pointermove", (e) => {
    const r = win.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    win.style.transform = `perspective(1400px) rotateX(${-y * 2}deg) rotateY(${x * 2}deg)`;
  });
  win.addEventListener("pointerleave", () => {
    animate(win, { transform: "perspective(1400px) rotateX(0deg) rotateY(0deg)" }, { duration: 0.6 });
  });
}

/* ── typing demo ────────────────────────────────────────────────────────── */
type Seg = { text: string; cls?: string };
const script: Seg[] = [
  { text: "# ", cls: "m" },
  { text: "Por que escrever à mão", cls: "h" },
  { text: "\n\n" },
  { text: "Não é sobre a ferramenta. É sobre " },
  { text: "*", cls: "m" },
  { text: "atenção", cls: "i" },
  { text: "*", cls: "m" },
  { text: "." },
  { text: "\n\n" },
  { text: "- ", cls: "m" },
  { text: "uma ideia por linha" },
  { text: "\n" },
  { text: "- ", cls: "m" },
  { text: "salvar é " },
  { text: "**", cls: "m" },
  { text: "automático", cls: "b" },
  { text: "**", cls: "m" },
  { text: "\n" },
  { text: "- ", cls: "m" },
  { text: "fechar sem medo" },
];

const typed = document.getElementById("typed")!;
const treeActive = document.getElementById("tree-active")!;
const winTitle = document.getElementById("win-title")!;
const status = document.getElementById("status")!;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function type() {
  let title = "";
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleSave = () => {
    status.textContent = "salvando…";
    status.classList.add("saving");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      status.textContent = "salvo";
      status.classList.remove("saving");
    }, 500);
  };

  for (const seg of script) {
    const span = document.createElement("span");
    if (seg.cls) span.className = seg.cls;
    typed.append(span);
    for (const ch of seg.text) {
      span.textContent += ch;
      if (seg.cls === "h") {
        title += ch;
        treeActive.textContent = `${title}.md`;
        winTitle.textContent = `Pessoal / ${title}`;
      }
      scheduleSave();
      await sleep(ch === "\n" ? 260 : 28 + Math.random() * 60);
    }
    if (seg.text.endsWith("\n\n")) await sleep(300);
  }
}

if (reduced) {
  typed.innerHTML = script
    .map((s) => `<span class="${s.cls ?? ""}">${s.text}</span>`)
    .join("");
  treeActive.textContent = "Por que escrever à mão.md";
  winTitle.textContent = "Pessoal / Por que escrever à mão";
} else {
  const once = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      once.disconnect();
      setTimeout(type, 500);
    }
  }, { threshold: 0.3 });
  once.observe(win!);
}

document.getElementById("year")!.textContent = String(new Date().getFullYear());
