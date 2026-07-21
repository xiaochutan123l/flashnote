import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createAppServices } from "./application/container";
import { ServicesProvider } from "./application/services-context";
import { CaptureBar } from "./capture-bar/CaptureBar";
import { InboxPage } from "./inbox/InboxPage";
import "./styles.css";

const params = new URLSearchParams(window.location.search);
const windowKind = params.get("window") === "capture" ? "capture" : "inbox";
document.documentElement.dataset.window = windowKind;

const services = createAppServices();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ServicesProvider services={services}>
      {windowKind === "capture" ? <CaptureBar /> : <InboxPage />}
    </ServicesProvider>
  </StrictMode>,
);

