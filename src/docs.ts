import "./style.css";
import "./docs.css";
import { setupTheme } from "./theme";

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
setupTheme(reduced);

const year = document.getElementById("year");
if (year) year.textContent = String(new Date().getFullYear());
