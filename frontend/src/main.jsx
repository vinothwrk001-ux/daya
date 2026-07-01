import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import App from "./App.jsx";
import { AuthBootstrap } from "./components/AuthBootstrap.jsx";
import { BrandingProvider } from "./context/BrandingContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { NotificationProvider } from "./context/NotificationContext.jsx";
import { installEarlyScrollHandlers } from "./utils/scrollPageToTop.js";
import { initializeCartSync } from "./utils/cartSync.js";

if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

installEarlyScrollHandlers();
initializeCartSync();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrandingProvider>
      <ThemeProvider>
        <NotificationProvider>
          <BrowserRouter>
            <AuthBootstrap>
              <App />
            </AuthBootstrap>
          </BrowserRouter>
        </NotificationProvider>
      </ThemeProvider>
    </BrandingProvider>
  </StrictMode>,
);
