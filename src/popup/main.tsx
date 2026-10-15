import React from "react";
import ReactDOM from "react-dom/client";
// Bundled instead of fetched from Google Fonts: no request (and no IP address) leaves the
// browser just because someone opened the popup.
import "@fontsource/space-grotesk/latin-500.css";
import "@fontsource/space-grotesk/latin-700.css";
import "@fontsource/space-mono/latin-400.css";
import "@fontsource/space-mono/latin-700.css";
import App from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("root element missing");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
