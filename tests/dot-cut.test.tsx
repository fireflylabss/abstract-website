import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DotCutCard from "../src/dot-cut/card";
import { DotCut } from "../src/dot-cut/engine";
import { Home } from "../src/home";

vi.mock("../src/dot-cut/engine", () => ({
  DotCut: vi.fn(function () {
    return { ok: true, start: vi.fn(), stop: vi.fn(), renderStill: vi.fn(),
      destroy: vi.fn(), setPointer: vi.fn(), toCell: vi.fn(() => ({ x: 1, y: 2 })) };
  }),
}));
let intersect: IntersectionObserverCallback;
let disconnected = false;
let fine = true;
let hidden = false;
const fonts = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  Object.defineProperty(document, "fonts", { configurable: true, value: { load: () => promise } });
  return resolve;
};
const currentEngine = () => vi.mocked(DotCut).mock.results.at(-1)!.value;
const visible = (value: boolean) => act(() => intersect([{ isIntersecting: value } as IntersectionObserverEntry], {} as IntersectionObserver));

beforeEach(() => {
  vi.clearAllMocks();
  fine = true; hidden = false; disconnected = false;
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  vi.stubGlobal("matchMedia", vi.fn((query: string) => ({ matches: query.includes("pointer: fine") ? fine : false, addEventListener() {}, removeEventListener() {} })));
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) { intersect = callback; }
    observe() {}
    disconnect() { disconnected = true; }
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("React Dot cut lifecycle", () => {
  it("the accessible hero pause control increments engine stops and keeps a fixed name", async () => {
    const ready = fonts();
    const view = render(<Home openDownloads={() => {}} />);
    await act(async () => ready()); visible(true);
    const engine = currentEngine();
    const before = engine.stop.mock.calls.length;
    const button = view.getByRole("button", { name: "Pause hero animation" });
    fireEvent.click(button);
    expect(engine.stop.mock.calls.length).toBeGreaterThan(before);
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.getAttribute("aria-label")).toBe("Pause hero animation");
    fireEvent.click(button); visible(true);
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });
  it("starts only on screen, pauses hidden and offscreen, resumes and disposes", async () => {
    const ready = fonts();
    const view = render(<DotCutCard paused={false} lite={false} />);
    await act(async () => ready());
    const engine = currentEngine();
    expect(engine.start).not.toHaveBeenCalled();
    visible(true);
    expect(engine.start).toHaveBeenCalledTimes(1);
    hidden = true; act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(engine.stop).toHaveBeenCalled();
    hidden = false; act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(engine.start).toHaveBeenCalledTimes(2);
    visible(false);
    expect(engine.stop).toHaveBeenCalledTimes(2);
    view.unmount();
    expect(engine.destroy).toHaveBeenCalledOnce();
    expect(disconnected).toBe(true);
  });
  it("Lite and reduced motion settle the first scene without starting", async () => {
    const ready = fonts();
    render(<DotCutCard paused={false} lite />);
    visible(true); await act(async () => ready());
    expect(currentEngine().renderStill).toHaveBeenCalled();
    expect(currentEngine().start).not.toHaveBeenCalled();
  });
  it("live Lite changes settle and resume, and preserve the user pause", async () => {
    const ready = fonts();
    const view = render(<DotCutCard paused={false} lite={false} />);
    await act(async () => ready()); visible(true);
    const engine = currentEngine();
    view.rerender(<DotCutCard paused={false} lite />);
    expect(engine.renderStill).toHaveBeenCalledTimes(2);
    view.rerender(<DotCutCard paused={false} lite={false} />); visible(true);
    expect(engine.start).toHaveBeenCalledTimes(2);
    view.rerender(<DotCutCard paused lite={false} />);
    const stops = engine.stop.mock.calls.length;
    hidden = true; act(() => document.dispatchEvent(new Event("visibilitychange")));
    hidden = false; act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(engine.start).toHaveBeenCalledTimes(2);
    expect(stops).toBeGreaterThan(0);
  });
  it("erases with a fine pointer but not a coarse pointer", async () => {
    const ready = fonts();
    const view = render(<DotCutCard paused={false} lite={false} />);
    await act(async () => ready());
    const engine = currentEngine();
    act(() => view.getByRole("img").dispatchEvent(new MouseEvent("pointermove", { clientX: 10, clientY: 20 })));
    expect(engine.setPointer).toHaveBeenCalledWith({ x: 1, y: 2 });
    fine = false; engine.setPointer.mockClear();
    act(() => view.getByRole("img").dispatchEvent(new MouseEvent("pointermove")));
    expect(engine.setPointer).not.toHaveBeenCalled();
  });
  it("does not construct after unmount before fonts load", async () => {
    const ready = fonts(); const view = render(<DotCutCard paused={false} lite={false} />);
    view.unmount(); await act(async () => ready());
    expect(DotCut).not.toHaveBeenCalled();
  });
  it("unavailable canvas never starts and still disposes", async () => {
    const ready = fonts();
    vi.mocked(DotCut).mockImplementationOnce(function () {
      return { ok: false, start: vi.fn(), stop: vi.fn(), renderStill: vi.fn(), destroy: vi.fn() } as unknown as DotCut;
    });
    const view = render(<DotCutCard paused={false} lite={false} />);
    visible(true); await act(async () => ready());
    const engine = currentEngine();
    expect(engine.start).not.toHaveBeenCalled();
    view.unmount(); expect(engine.destroy).toHaveBeenCalledOnce();
  });
});
