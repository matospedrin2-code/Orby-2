import { getBatteryLevelAsync } from "expo-battery";
import { useEffect, useState } from "react";

export function useBatteryPct(): number | null {
  const [pct, setPct] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    const read = async () => {
      try {
        const level = await getBatteryLevelAsync();
        if (alive) setPct(level == null || level < 0 ? null : Math.round(level * 100));
      } catch {
        if (alive) setPct(null);
      }
    };
    read();
    const t = setInterval(read, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return pct;
}
