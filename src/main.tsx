import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize Sentry for production error tracking
// Set VITE_SENTRY_DSN environment variable in production
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

if (SENTRY_DSN && import.meta.env.PROD) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
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
}

// Wrap App with Sentry error boundary in production
const WrappedApp = SENTRY_DSN && import.meta.env.PROD
  ? () => (
    <Sentry.ErrorBoundary
      fallback={<div className="p-4 text-red-500">Something went wrong. Please refresh the page.</div>}
      showDialog
    >
      <App />
    </Sentry.ErrorBoundary>
  )
  : App;

createRoot(document.getElementById("root")!).render(<WrappedApp />);