// Design tokens for Orby. Dark-first sci-fi HUD palette (from /app/design_guidelines.json).
import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const dark = {
  surface: "#06090F",
  onSurface: "#E0F7FF",
  surfaceSecondary: "#0C121C",
  onSurfaceSecondary: "#D2F5FF",
  surfaceTertiary: "#131A26",
  onSurfaceTertiary: "#D2F5FF",
  surfaceInverse: "#D2F5FF",
  onSurfaceInverse: "#06090F",
  muted: "#4ACEEB",

  brand: "#00F0FF",
  onBrand: "#06090F",
  brandPrimary: "#00F0FF",
  onBrandPrimary: "#06090F",
  brandSecondary: "#008B99",
  onBrandSecondary: "#E0F7FF",
  brandTertiary: "rgba(0, 240, 255, 0.15)",
  onBrandTertiary: "#00F0FF",

  success: "#00FF88",
  onSuccess: "#06090F",
  warning: "#FFB000",
  onWarning: "#06090F",
  error: "#FF2A55",
  onError: "#E0F7FF",
  info: "#00F0FF",
  onInfo: "#06090F",

  border: "rgba(0, 240, 255, 0.15)",
  borderStrong: "rgba(0, 240, 255, 0.45)",
  divider: "rgba(0, 240, 255, 0.2)",

  hudGradientStart: "rgba(8, 12, 20, 0.95)",
  hudGradientEnd: "rgba(12, 18, 28, 0.98)",
  hudGlow: "rgba(0, 240, 255, 0.45)",
  hudText: "#D2F5FF",
  eyeLove: "#FF4FD8",
  eyeAngry: "#FF2A55",
  eyeSad: "#4AA8FF",
  backdrop: "rgba(2, 4, 8, 0.7)",
  glass: "rgba(12, 18, 28, 0.72)",
};

export type ThemeColors = typeof dark;

export const defaultScheme = "dark" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light: dark, dark };

export const colors = dark;

export const fonts = {
  display: "Rajdhani-Medium",
  displayBold: "Rajdhani-Bold",
  text: "IBMPlexSans",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.("dark");

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  useColorScheme();
  return { scheme: "dark", colors: dark };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
