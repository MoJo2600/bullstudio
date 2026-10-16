import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  getPollingConfig,
  type RuntimePollingConfig,
} from "@/lib/runtime-config";

/** Fallback interval (ms) when the operator hasn't configured one. */
export const DEFAULT_POLL_INTERVAL = 2000;

const STORAGE_KEY = "__bullstudio_polling";

/** A user's chosen poll interval in ms, or "off" to disable polling entirely. */
export type PollingPreference = number | "off";

export interface ResolvedPolling {
  /** Whether live views should poll at all. */
  enabled: boolean;
  /** Effective poll interval in ms (only meaningful when `enabled`). */
  interval: number;
  /** Whether the end-user is allowed to change polling from the UI. */
  canOverride: boolean;
  /** Operator-imposed floor (ms) the user cannot poll faster than, if any. */
  minInterval?: number;
}

/**
 * Resolves the effective polling behaviour from the operator's config and the
 * end-user's stored preference. Pure and side-effect free so it can be unit
 * tested in isolation.
 *
 * Precedence: operator `enabled: false` wins (polling off, no override). Else a
 * user preference wins when overrides are allowed, clamped up to `minInterval`.
 * Otherwise the operator's default interval applies.
 */
export function resolvePolling(
  operator: RuntimePollingConfig | undefined,
  userPref: PollingPreference | null,
): ResolvedPolling {
  const operatorEnabled = operator?.enabled ?? true;
  const operatorInterval = operator?.interval ?? DEFAULT_POLL_INTERVAL;
  const minInterval = operator?.minInterval;
  const allowUserOverride = operator?.allowUserOverride ?? true;
  const canOverride = operatorEnabled && allowUserOverride;

  const clamp = (ms: number) => (minInterval ? Math.max(ms, minInterval) : ms);

  if (!operatorEnabled) {
    return {
      enabled: false,
      interval: clamp(operatorInterval),
      canOverride: false,
      minInterval,
    };
  }

  if (canOverride && userPref !== null) {
    if (userPref === "off") {
      return {
        enabled: false,
        interval: clamp(operatorInterval),
        canOverride,
        minInterval,
      };
    }
    return {
      enabled: true,
      interval: clamp(userPref),
      canOverride,
      minInterval,
    };
  }

  return {
    enabled: operatorEnabled,
    interval: clamp(operatorInterval),
    canOverride,
    minInterval,
  };
}

interface PollingProviderState extends ResolvedPolling {
  setPreference: (preference: PollingPreference) => void;
}

const PollingProviderContext = createContext<PollingProviderState | undefined>(
  undefined,
);

function readStoredPreference(): PollingPreference | null {
  if (typeof window === "undefined") {
    return null;
  }

  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === null) {
    return null;
  }
  if (saved === "off") {
    return "off";
  }

  const parsed = Number(saved);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function PollingProvider({ children }: { children: React.ReactNode }) {
  const operator = useMemo(() => getPollingConfig(), []);
  const [userPref, setUserPref] = useState<PollingPreference | null>(null);

  useEffect(() => {
    setUserPref(readStoredPreference());
  }, []);

  const resolved = resolvePolling(operator, userPref);

  const value: PollingProviderState = {
    ...resolved,
    setPreference: (preference: PollingPreference) => {
      window.localStorage.setItem(STORAGE_KEY, String(preference));
      setUserPref(preference);
    },
  };

  return (
    <PollingProviderContext.Provider value={value}>
      {children}
    </PollingProviderContext.Provider>
  );
}

export const usePolling = () => {
  const context = useContext(PollingProviderContext);

  if (context === undefined) {
    throw new Error("usePolling must be used within a PollingProvider");
  }

  return context;
};

export function usePollingQueryOptions(): { refetchInterval: number | false } {
  const { enabled, interval } = usePolling();
  return { refetchInterval: enabled ? interval : false };
}
