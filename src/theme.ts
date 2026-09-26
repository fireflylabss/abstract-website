/* Shared theme wiring: all .theme buttons toggle light/dark with a circular
   view transition out of the click point. onChange runs inside the swap. */
export function setupTheme(reduced: boolean, onChange?: () => void) {
  const root = document.documentElement;
  const metaTheme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  const buttons = document.querySelectorAll<HTMLButtonElement>(".theme");

  const applyTheme = (dark: boolean) => {
    root.dataset.theme = dark ? "dark" : "light";
    if (metaTheme) metaTheme.content = dark ? "#0a0a0a" : "#f6f6f4";
    buttons.forEach((b) =>
      b.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode"),
    );
  };

  applyTheme(root.dataset.theme === "dark");

  buttons.forEach((btn) =>
    btn.addEventListener("click", (e) => {
      const dark = root.dataset.theme !== "dark";
      const swap = () => {
        applyTheme(dark);
        localStorage.setItem("theme", dark ? "dark" : "light");
        onChange?.();
      };
      if (!document.startViewTransition || reduced) {
        swap();
        return;
      }
      let x = e.clientX;
      let y = e.clientY;
      if (!x && !y) {
        const b = btn.getBoundingClientRect();
        x = b.left + b.width / 2;
        y = b.top + b.height / 2;
      }
      const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      const vt = document.startViewTransition(swap);
      vt.ready.then(() =>
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
          {
            duration: 550,
            easing: "cubic-bezier(.2,0,0,1)",
            pseudoElement: "::view-transition-new(root)",
          },
        ),
      );
    }),
  );
}
