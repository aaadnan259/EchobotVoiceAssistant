import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize Sentry for error tracking
Sentry.init({
  dsn: "https://5bfe8946d8eec1dda0e243865b0cd7d6@o4510723191013376.ingest.us.sentry.io/4510723193569280",
  environment: import.meta.env.MODE,
  sendDefaultPii: true,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  // Performance monitoring sample rate (0-1)
  tracesSampleRate: 0.1,
  // Session replay sample rate
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

// Wrap App with Sentry error boundary
const WrappedApp = () => (
  <Sentry.ErrorBoundary
    fallback={<div className="p-4 text-red-500">Something went wrong. Please refresh the page.</div>}
    showDialog
  >
    <App />
  </Sentry.ErrorBoundary>
);

createRoot(document.getElementById("root")!).render(<WrappedApp />);