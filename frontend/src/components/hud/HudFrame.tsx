import { WifiHigh } from "phosphor-react-native";
import { useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Svg, { Defs, LinearGradient, Path, Polygon, Stop } from "react-native-svg";
import { colors } from "@/src/theme";

const TAB = 16; // the raised tab on the top-right edge

function outline(w: number, h: number) {
  const c = 24;
  const tr = 34;
  const ts = w * 0.68;
  const i = 2;
  return `M${c},${TAB + i} L${ts},${TAB + i} L${ts + TAB},${i} L${w - tr},${i} L${w - i},${tr} L${w - i},${h - c} L${w - c},${h - i} L${c},${h - i} L${i},${h - c} L${i},${TAB + c} Z`;
}

// Sci-fi chamfered HUD frame: gradient neon edge, raised top-right tab, wifi, LED stripes.
export function HudFrame({ children, testID, padding = 22 }: { children: React.ReactNode; testID?: string; padding?: number }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (Math.abs(w - box.w) > 1 || Math.abs(h - box.h) > 1) setBox({ w, h });
  };
  const d = box.w ? outline(box.w, box.h) : "";
  return (
    <View onLayout={onLayout} style={{ padding, paddingTop: padding + TAB }} testID={testID}>
      {box.w > 0 && (
        <Svg style={StyleSheet.absoluteFill} width={box.w} height={box.h}>
          <Defs>
            <LinearGradient id="hudEdge" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.brand} />
              <Stop offset="1" stopColor={colors.hudBlue} />
            </LinearGradient>
            <LinearGradient id="hudFill" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors.hudGradientStart} />
              <Stop offset="1" stopColor={colors.hudGradientEnd} />
            </LinearGradient>
          </Defs>
          <Path d={d} fill="url(#hudFill)" stroke={colors.hudGlow} strokeWidth={12} strokeOpacity={0.18} />
          <Path d={d} fill="none" stroke="url(#hudEdge)" strokeWidth={3} strokeLinejoin="round" />
          <Path d={`M${30},${TAB + 12} L${box.w * 0.4},${TAB + 12}`} stroke={colors.brand} strokeOpacity={0.25} strokeWidth={1.5} />
          <Path d={`M12,${TAB + 44} L12,${box.h * 0.6}`} stroke={colors.brand} strokeOpacity={0.25} strokeWidth={1.5} />
          {[0, 1, 2].map((k) => {
            const x = box.w - 118 + k * 30;
            const y = box.h - 2;
            return <Polygon key={k} points={`${x + 9},${y - 10} ${x + 30},${y - 10} ${x + 21},${y} ${x},${y}`} fill={colors.hudBlue} />;
          })}
        </Svg>
      )}
      <View style={styles.wifi} testID="hud-wifi-icon">
        <WifiHigh size={24} color={colors.brand} weight="bold" />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ wifi: { position: "absolute", top: 4, right: 46 } });
