import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ConnectedWorkspace from "./ConnectedWorkspace";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {new URLSearchParams(window.location.search).get("view") === "connected" ? (
      <ConnectedWorkspace />
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
