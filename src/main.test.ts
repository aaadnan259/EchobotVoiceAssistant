/**
 * @vitest-environment jsdom
 */
/**
 * Regression tests for src/main.tsx's Sentry.init() call (F2 / P1, Phase 6 -
 * Workstream 2). See src/sentryReplayConfig.test.ts for tests against the
 * real, unmocked Sentry SDK's internal masking state.
 *
 * "@sentry/react", "react-dom/client", and "./App.tsx" are mocked only to
 * avoid making a real network call to Sentry's DSN and to avoid needing a
 * full App render tree for what is purely a wiring/configuration test - the
 * assertions below verify the REAL arguments our own code passes to the real
 * (here, mocked-for-capture) Sentry.init/replayIntegration functions at real
 * module-evaluation time, not a string match against this file's source text.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock() factories are hoisted to the top of the file by Vitest, so the mock
// functions they reference must be created via vi.hoisted() rather than as plain
// `const`s declared inside describe() - otherwise they are referenced before
// initialization (TDZ) when the hoisted mock factory actually runs.
const { sentryInit, replayIntegration, browserTracingIntegration } = vi.hoisted(() => ({
    sentryInit: vi.fn(),
    replayIntegration: vi.fn((opts: unknown) => ({ __replayOpts: opts })),
    browserTracingIntegration: vi.fn(() => ({ __tracing: true })),
}));

vi.mock("@sentry/react", () => ({
    init: sentryInit,
    replayIntegration,
    browserTracingIntegration,
    // Used as <Sentry.ErrorBoundary> JSX in main.tsx - render children through.
    ErrorBoundary: ({ children }: { children: unknown }) => children,
}));

vi.mock("react-dom/client", () => ({
    createRoot: vi.fn(() => ({ render: vi.fn() })),
}));

vi.mock("./App.tsx", () => ({
    default: () => null,
}));

describe("src/main.tsx actually calls Sentry.init with the fixed configuration", () => {
    beforeEach(() => {
        vi.resetModules();
        sentryInit.mockClear();
        replayIntegration.mockClear();
        browserTracingIntegration.mockClear();
    });

    it("calls Sentry.init with sendDefaultPii: false and a replayIntegration configured to mask text and block media", async () => {
        await import("./main.tsx");

        expect(sentryInit).toHaveBeenCalledTimes(1);
        const initArgs = sentryInit.mock.calls[0][0];

        expect(initArgs.sendDefaultPii).toBe(false);

        expect(replayIntegration).toHaveBeenCalledTimes(1);
        expect(replayIntegration).toHaveBeenCalledWith({
            maskAllText: true,
            blockAllMedia: true,
        });
    });

    it("leaves DSN, environment, tracing, and sample rates unchanged (regression guard against overreach)", async () => {
        await import("./main.tsx");

        const initArgs = sentryInit.mock.calls[0][0];
        expect(initArgs.dsn).toBe(
            "https://5bfe8946d8eec1dda0e243865b0cd7d6@o4510723191013376.ingest.us.sentry.io/4510723193569280"
        );
        expect(initArgs.tracesSampleRate).toBe(0.1);
        expect(initArgs.replaysSessionSampleRate).toBe(0.1);
        expect(initArgs.replaysOnErrorSampleRate).toBe(1.0);
        expect(browserTracingIntegration).toHaveBeenCalledTimes(1);
    });
});
