import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
 
export function useRealtimeTable(
  table: string,
  onChange: () => void,
  filter?: string
) {
  const callbackRef = useRef(onChange);
 
  useEffect(() => {
    callbackRef.current = onChange;
  }, [onChange]);
 
  useEffect(() => {
    const channelName = `realtime-${table}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("postgres_changes" as any, {
        event: "*",
        schema: "public",
        table,
        ...(filter ? { filter } : {}),
      }, () => {
        callbackRef.current();
      })
      .subscribe();
 
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [table, filter]);
}
