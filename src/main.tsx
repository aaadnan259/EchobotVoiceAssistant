import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize Sentry for error tracking
Sentry.init({
  dsn: "https://5bfe8946d8eec1dda0e243865b0cd7d6@o4510723191013376.ingest.us.sentry.io/4510723193569280",
  environment: import.meta.env.MODE,
  // Do not attach IP address / other default PII to events: this is a personal,
  // conversational product with no visible user consent mechanism for that data
  // being sent to a third party (F2).
  sendDefaultPii: false,
  integrations: [
    Sentry.browserTracingIntegration(),
    // Explicitly keep Sentry's own privacy-preserving defaults for session replay:
    // mask all text and block all media, so a replay never contains a user's actual
    // chat content or other on-screen text/images verbatim (F2). Set explicitly
    // (rather than omitted) so this stays true even if the SDK's own defaults ever
    // change, and so the intent is visible to future readers of this file.
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
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