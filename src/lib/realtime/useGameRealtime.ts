"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The single realtime primitive for all three consoles. Replaces the old
 * SSE (`/api/realtime`) + in-process `pg_notify` listener, which could not
 * run on serverless.
 *
 * Model: Supabase Realtime "Postgres Changes" on `GameEvent` is a wakeup +
 * an ordering cursor, not a data channel. On every event (and on every
 * reconnect) the hook replays anything newer than its cursor from
 * `/api/game/events`, hands each event to `onEvent`, and the console
 * refetches `/api/game/state` — which stays the source of truth. RLS
 * authorizes the websocket; `/api/game/events` re-filters for the gap fill.
 *
 * The subscription target (gameId) and auth both come from
 * `/api/realtime/token`, derived server-side from the session cookie — the
 * caller only says whether it's `enabled` and what to do `onEvent`.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export type RealtimeStatus = "connecting" | "live" | "reconnecting" | "offline";

export interface GameRealtimeEvent {
  id: string;
  type: string;
  payload: unknown;
  sequenceNumber: string;
  createdAt: string;
}

interface Options {
  /** false disables the subscription entirely (e.g. before login) */
  enabled: boolean;
  /** called once per event, in sequence order, after de-duplication */
  onEvent?: (event: GameRealtimeEvent) => void;
}

interface TokenResponse {
  token: string;
  expiresIn: number;
  gameId: string;
}

export function useGameRealtime({ enabled, onEvent }: Options): { status: RealtimeStatus } {
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const cursorRef = useRef<bigint>(BigInt(0));

  /** Drain everything newer than the cursor from the replay endpoint. */
  const drain = useCallback(async () => {
    try {
      const res = await fetch(`/api/game/events?since=${cursorRef.current.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const body = (await res.json()) as { events: GameRealtimeEvent[] };
      for (const evt of body.events) {
        const seq = BigInt(evt.sequenceNumber);
        if (seq <= cursorRef.current) continue;
        cursorRef.current = seq;
        onEventRef.current?.(evt);
      }
    } catch {
      // network blip — the next event or reconnect will retry
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reflecting a prop toggle into status
      setStatus("offline");
      return;
    }

    // realtime misconfigured — fall back to a slow poll so the app still works
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time fallback signal
      setStatus("reconnecting");
      void drain();
      const poll = setInterval(() => void drain(), 5000);
      return () => clearInterval(poll);
    }

    let disposed = false;
    let tokenTimer: ReturnType<typeof setTimeout> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let channel: RealtimeChannel | null = null;

    // We drive auth manually via setAuth(); disable GoTrue's own storage +
    // refresh so multiple mounts don't fight over one localStorage key.
    const client: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: `ns-rt-${Math.random().toString(36).slice(2)}`,
      },
    });

    const retry = (fn: () => void, ms: number) => {
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(fn, ms);
    };

    const connect = async () => {
      if (disposed) return;
      try {
        const res = await fetch("/api/realtime/token", { cache: "no-store" });
        if (!res.ok) throw new Error(`token ${res.status}`);
        const { token, expiresIn, gameId } = (await res.json()) as TokenResponse;
        if (disposed) return;

        await client.realtime.setAuth(token);
        if (tokenTimer) clearTimeout(tokenTimer);
        tokenTimer = setTimeout(() => void connect(), Math.max(30, expiresIn - 60) * 1000);

        if (channel) {
          await client.removeChannel(channel);
          channel = null;
        }

        channel = client
          .channel(`game:${gameId}`)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "GameEvent", filter: `gameId=eq.${gameId}` },
            () => void drain(),
          )
          .subscribe((s) => {
            if (disposed) return;
            if (s === "SUBSCRIBED") {
              setStatus("live");
              void drain();
            } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") {
              setStatus("reconnecting");
              retry(() => void connect(), 2000);
            } else if (s === "CLOSED") {
              setStatus("reconnecting");
            }
          });
      } catch {
        if (disposed) return;
        setStatus("reconnecting");
        retry(() => void connect(), 2000);
      }
    };

    const onOnline = () => void connect();
    const onVisible = () => {
      if (document.visibilityState === "visible") void drain();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);

    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial connecting state
    setStatus("connecting");
    void connect();

    return () => {
      disposed = true;
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      if (tokenTimer) clearTimeout(tokenTimer);
      if (retryTimer) clearTimeout(retryTimer);
      if (channel) void client.removeChannel(channel);
      void client.realtime.disconnect();
    };
  }, [enabled, drain]);

  return { status };
}
