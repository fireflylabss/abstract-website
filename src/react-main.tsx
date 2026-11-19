import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { QuartzPortalProvider } from "@/lib/quartz/portal";
import "./style.css";
import "@/components/quartz/styles.css";

const root = document.getElementById("root")!;
const homeMarkup = { __html: root.innerHTML };

function Home() {
  useEffect(() => {
    void import("./main");
  }, []);

  return <div dangerouslySetInnerHTML={homeMarkup} />;
}

createRoot(root).render(
  <QuartzPortalProvider>
    <Home />
  </QuartzPortalProvider>,
);
