import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = ts.transpileModule(
  readFileSync(new URL("../src/dot-cut/mount.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;

function harness({ reduced = false, lite = false, fine = true, ok = true } = {}) {
  const instances = [];
  class Engine {
    ok = ok;
    starts = 0;
    stops = 0;
    stills = 0;
    destroyed = false;
    pointer = null;
    constructor() { instances.push(this); }
    start() { this.starts++; }
    stop() { this.stops++; }
    renderStill() { this.stills++; }
    destroy() { this.destroyed = true; }
    setPointer(point) { this.pointer = point; }
    toCell(x, y) { return { x, y }; }
  }
  const motion = new EventTarget();
  motion.matches = reduced;
  const device = new EventTarget();
  device.matches = lite;
  let intersect;
  let disconnected = false;
  let fontsReady;
  const document = new EventTarget();
  document.hidden = false;
  document.documentElement = { classList: { contains: () => lite } };
  document.fonts = { ready: new Promise(resolve => { fontsReady = resolve; }) };
  const host = new EventTarget();
  const control = new EventTarget();
  const attributes = new Map();
  control.setAttribute = (name, value) => attributes.set(name, value);
  control.getAttribute = name => attributes.get(name);
  host.parentElement = { querySelector: () => control };
  host.getBoundingClientRect = () => ({ left: 10, top: 20 });
  const exports = {};
  vm.runInNewContext(source, {
    exports, document,
    require: name => name === "./engine" ? { DotCut: Engine } : { FONT_VAR: "--visual-sans", PALETTES: [["#8aa9ff", "#1f45f5"]] },
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    matchMedia: query => query.includes("reduced-motion") ? motion : query.includes("pointer: fine") ? { matches: fine } : device,
    IntersectionObserver: class {
      constructor(callback) { intersect = callback; }
      observe() {}
      disconnect() { disconnected = true; }
    },
  });
  const dispose = exports.mountDotCut(host);
  return {
    instances, motion, device, document, host, control, dispose,
    ready: async () => { fontsReady(); await Promise.resolve(); },
    visible: value => intersect([{ isIntersecting: value, intersectionRatio: value ? 1 : 0 }]),
    disconnected: () => disconnected,
  };
}

test("starts only on screen, pauses hidden/offscreen, resumes and cleans up", async () => {
  const h = harness();
  await h.ready();
  const engine = h.instances[0];
  assert.equal(engine.starts, 0);
  h.visible(true);
  assert.equal(engine.starts, 1);
  h.document.hidden = true;
  h.document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(engine.stops, 2);
  h.document.hidden = false;
  h.document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(engine.starts, 2);
  h.visible(false);
  assert.equal(engine.stops, 3);
  h.dispose();
  assert.equal(engine.destroyed, true);
  assert.equal(h.disconnected(), true);
  h.document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(engine.stops, 3);
});

test("reduced motion and Lite render one still and never start", async () => {
  for (const options of [{ reduced: true }, { lite: true }]) {
    const h = harness(options);
    await h.ready();
    h.visible(true);
    const engine = h.instances.at(-1);
    assert.equal(engine.starts, 0);
    assert.equal(engine.stills, 1);
    h.document.dispatchEvent(new Event("visibilitychange"));
    assert.equal(engine.stills, 1);
    h.dispose();
    assert.ok(h.instances.every(instance => instance.destroyed));
  }
});

test("live reduced-motion changes replace animated scene with first settled frame", async () => {
  const h = harness();
  await h.ready();
  h.visible(true);
  h.motion.matches = true;
  h.motion.dispatchEvent(new Event("change"));
  assert.equal(h.instances[0].destroyed, true);
  assert.equal(h.instances[1].stills, 1);
  assert.equal(h.instances[1].starts, 0);
  h.motion.matches = false;
  h.motion.dispatchEvent(new Event("change"));
  assert.equal(h.instances[1].starts, 1);
  h.dispose();
});

test("device Lite stays settled when reduced motion is turned off", async () => {
  const h = harness({ reduced: true, lite: true });
  await h.ready();
  h.visible(true);
  h.motion.matches = false;
  h.motion.dispatchEvent(new Event("change"));
  assert.equal(h.instances.at(-1).starts, 0);
  assert.equal(h.control.hidden, true);
  h.device.matches = false;
  h.device.dispatchEvent(new Event("change"));
  assert.equal(h.instances.at(-1).starts, 1);
  assert.equal(h.control.hidden, false);
  h.dispose();
});

test("fine pointer erases in host coordinates; coarse pointer is untouched", async () => {
  for (const fine of [true, false]) {
    const h = harness({ fine });
    await h.ready();
    const event = new Event("pointermove");
    Object.assign(event, { clientX: 30, clientY: 50 });
    h.host.dispatchEvent(event);
    const engine = h.instances[0];
    assert.equal(engine.pointer?.x ?? null, fine ? 20 : null);
    assert.equal(engine.pointer?.y ?? null, fine ? 30 : null);
    h.host.dispatchEvent(new Event("pointerleave"));
    assert.equal(engine.pointer, null);
    h.dispose();
  }
});

test("unmounted before fonts load does not build an engine", async () => {
  const h = harness();
  h.dispose();
  await h.ready();
  assert.equal(h.instances.length, 0);
});

test("pause control stops and resumes, preserves pause when visibility changes, and cleans up", async () => {
  const h = harness();
  await h.ready();
  h.visible(true);
  const engine = h.instances[0];
  assert.equal(h.control.hidden, false);
  h.control.dispatchEvent(new Event("click"));
  assert.equal(h.control.getAttribute("aria-pressed"), "true");
  assert.equal(h.control.getAttribute("aria-label"), "Pause hero animation");
  assert.equal(engine.starts, 1);
  h.visible(false);
  h.visible(true);
  assert.equal(engine.starts, 1);
  h.control.dispatchEvent(new Event("click"));
  assert.equal(engine.starts, 2);
  assert.equal(h.control.getAttribute("aria-pressed"), "false");
  assert.equal(h.control.getAttribute("aria-label"), "Pause hero animation");
  h.dispose();
  h.control.dispatchEvent(new Event("click"));
  assert.equal(engine.starts, 2);
});

test("unavailable canvas context does not start and still disposes", async () => {
  const h = harness({ ok: false });
  await h.ready();
  h.visible(true);
  assert.equal(h.instances[0].starts, 0);
  h.dispose();
  assert.equal(h.instances[0].destroyed, true);
});
