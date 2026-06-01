import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import App from "./App.jsx";
import { BrandingProvider } from "./context/BrandingContext.jsx";
import { NotificationProvider } from "./context/NotificationContext.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrandingProvider>
      <NotificationProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </NotificationProvider>
    </BrandingProvider>
  </StrictMode>,
);
