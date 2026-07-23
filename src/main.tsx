import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createAppServices } from "./application/container";
import { ServicesProvider } from "./application/services-context";
import { CaptureBar } from "./capture-bar/CaptureBar";
import { FocusWindow } from "./focus-window/FocusWindow";
import { MainWindow } from "./main-window/MainWindow";
import "./styles.css";

const params = new URLSearchParams(window.location.search);
const requestedWindow = params.get("window");
const windowKind =
  requestedWindow === "capture" || requestedWindow === "focus"
    ? requestedWindow
    : "inbox";
document.documentElement.dataset.window = windowKind;

const services = createAppServices();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ServicesProvider services={services}>
      {windowKind === "capture" ? <CaptureBar /> : null}
      {windowKind === "focus" ? <FocusWindow /> : null}
      {windowKind === "inbox" ? <MainWindow /> : null}
    </ServicesProvider>
  </StrictMode>,
);
