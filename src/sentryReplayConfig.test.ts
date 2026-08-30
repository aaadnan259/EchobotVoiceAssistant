/**
 * Regression tests for Sentry privacy configuration (F2 / P1, Phase 6 -
 * Workstream 2) - REAL SDK behavior, no mocking.
 *
 * This file intentionally does NOT mock "@sentry/react" (see src/main.test.ts
 * for the file that does, to verify our own code's call arguments). Here we
 * call the REAL, installed Sentry.replayIntegration() factory with our exact
 * intended arguments and inspect its real internal option state, proving the
 * third-party library itself actually records masking as enabled for these
 * arguments - not just that our source code contains the right-looking
 * literals, and not a mocked stand-in.
 */
import { describe, it, expect } from "vitest";
import * as Sentry from "@sentry/react";

type ReplayInternals = {
    _initialOptions: Record<string, unknown>;
    _recordingOptions: Record<string, unknown>;
};

describe("Sentry replayIntegration actual runtime behavior (real installed SDK)", () => {
    it("the currently-shipped config (maskAllText/blockAllMedia: true) is recorded as masking-enabled internally", () => {
        const integration = Sentry.replayIntegration({
            maskAllText: true,
            blockAllMedia: true,
        }) as unknown as ReplayInternals;

        // Real internal state of the real, installed replay integration - not a
        // mock, not a string match on our source file.
        expect(integration._initialOptions.maskAllText).toBe(true);
        expect(integration._initialOptions.blockAllMedia).toBe(true);
        expect(integration._recordingOptions.maskAllText).toBe(true);
    });

    it("sanity check: the OLD (pre-fix) config is distinguishably recorded as masking-disabled, proving this test can actually tell the two configurations apart", () => {
        const integration = Sentry.replayIntegration({
            maskAllText: false,
            blockAllMedia: false,
        }) as unknown as ReplayInternals;

        expect(integration._initialOptions.maskAllText).toBe(false);
        expect(integration._initialOptions.blockAllMedia).toBe(false);
        expect(integration._recordingOptions.maskAllText).toBe(false);
    });

    it("omitting the options entirely falls back to the SDK's own privacy-preserving defaults (masking enabled)", () => {
        const integration = Sentry.replayIntegration() as unknown as ReplayInternals;

        expect(integration._initialOptions.maskAllText).toBe(true);
        expect(integration._initialOptions.blockAllMedia).toBe(true);
    });
});
