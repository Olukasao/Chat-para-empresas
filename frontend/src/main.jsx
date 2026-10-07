import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { applyThemeToDocument, applyWorldCupThemeToDocument, readStoredTheme, readStoredWorldCupTheme } from "./utils/theme";
import "./index.css";

applyThemeToDocument(readStoredTheme());
applyWorldCupThemeToDocument(readStoredWorldCupTheme());

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
