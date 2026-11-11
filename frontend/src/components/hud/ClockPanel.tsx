import { BatteryHigh, BatteryLow, BatteryMedium } from "phosphor-react-native";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useBatteryPct } from "@/src/hooks/useBattery";
import { colors, fonts, spacing } from "@/src/theme";

export function ClockPanel({ size }: { size: number }) {
  const [now, setNow] = useState(new Date());
  const batt = useBatteryPct();
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const BIcon = batt == null || batt > 60 ? BatteryHigh : batt > 25 ? BatteryMedium : BatteryLow;
  return (
    <View style={styles.row} testID="hud-clock">
      <Text style={[styles.clock, { fontSize: size, lineHeight: size * 1.08 }]} testID="hud-clock-time">{`${hh}:${mm}`}</Text>
      <View style={styles.batt}>
        <BIcon size={size * 0.36} color={colors.brand} weight="duotone" />
        <Text style={[styles.battTxt, { fontSize: size * 0.2 }]} testID="hud-battery">{batt == null ? "--" : `${batt}%`}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  clock: { fontFamily: fonts.displayBold, color: colors.eyeFill, textShadowColor: "rgba(0, 240, 255, 0.7)", textShadowRadius: 16 },
  batt: { alignItems: "center" },
  battTxt: { fontFamily: fonts.displayBold, color: colors.brand },
});
