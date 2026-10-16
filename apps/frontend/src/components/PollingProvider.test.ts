import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as runtimeConfig from "@/lib/runtime-config";
import {
  DEFAULT_POLL_INTERVAL,
  PollingProvider,
  resolvePolling,
  usePollingQueryOptions,
} from "./PollingProvider";

describe("resolvePolling", () => {
  it("defaults to enabled at the default interval with overrides allowed", () => {
    expect(resolvePolling(undefined, null)).toEqual({
      enabled: true,
      interval: DEFAULT_POLL_INTERVAL,
      canOverride: true,
      minInterval: undefined,
    });
  });

  it("uses the operator's interval when no user preference is set", () => {
    expect(resolvePolling({ interval: 8000 }, null)).toMatchObject({
      enabled: true,
      interval: 8000,
    });
  });

  it("lets a user preference override the operator default", () => {
    expect(resolvePolling({ interval: 8000 }, 5000)).toMatchObject({
      enabled: true,
      interval: 5000,
    });
  });

  it('disables polling when the user picks "off"', () => {
    expect(resolvePolling(undefined, "off")).toMatchObject({
      enabled: false,
      canOverride: true,
    });
  });

  it("forces polling off and blocks override when the operator disables it", () => {
    expect(resolvePolling({ enabled: false }, 2000)).toMatchObject({
      enabled: false,
      canOverride: false,
    });
  });

  it("ignores the user preference when overrides are disallowed", () => {
    expect(
      resolvePolling({ interval: 9000, allowUserOverride: false }, 1000),
    ).toMatchObject({
      enabled: true,
      interval: 9000,
      canOverride: false,
    });
  });

  it("clamps a user preference up to the operator's minimum interval", () => {
    expect(resolvePolling({ minInterval: 5000 }, 2000)).toMatchObject({
      enabled: true,
      interval: 5000,
    });
  });

  it("clamps the operator default up to the minimum interval", () => {
    expect(
      resolvePolling({ interval: 1000, minInterval: 3000 }, null),
    ).toMatchObject({
      interval: 3000,
    });
  });
});

describe("usePollingQueryOptions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    { config: undefined, expected: DEFAULT_POLL_INTERVAL },
    { config: { interval: 8000 }, expected: 8000 },
    { config: { enabled: false }, expected: false },
    { config: { interval: 1000, minInterval: 5000 }, expected: 5000 },
  ])("uses $expected as the live query interval", ({ config, expected }) => {
    vi.spyOn(runtimeConfig, "getPollingConfig").mockReturnValue(config);
    let options: ReturnType<typeof usePollingQueryOptions> | undefined;

    function Probe() {
      options = usePollingQueryOptions();
      return null;
    }

    renderToString(createElement(PollingProvider, null, createElement(Probe)));

    expect(options).toEqual({ refetchInterval: expected });
  });
});
