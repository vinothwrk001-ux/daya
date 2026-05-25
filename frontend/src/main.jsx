import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import App from "./App.jsx";
import { BrandingProvider } from "./context/BrandingContext.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrandingProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </BrandingProvider>
  </StrictMode>,
);
