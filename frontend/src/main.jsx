import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import App from "./App.jsx";
import { AuthBootstrap } from "./components/AuthBootstrap.jsx";
import { BrandingProvider } from "./context/BrandingContext.jsx";
import { NotificationProvider } from "./context/NotificationContext.jsx";
import { installEarlyScrollHandlers } from "./utils/scrollPageToTop.js";

if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

installEarlyScrollHandlers();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrandingProvider>
      <NotificationProvider>
        <BrowserRouter>
          <AuthBootstrap>
            <App />
          </AuthBootstrap>
        </BrowserRouter>
      </NotificationProvider>
    </BrandingProvider>
  </StrictMode>,
);
