/**
 * Move-Chilld — Design tokens.
 *
 * Two palettes:
 *  - "Sunrise Bus"  (light) — warm cream + school-bus yellow
 *  - "Night Bus"    (dark)  — deep navy + brand yellow that pops
 *
 * Spacing / radii / typography are mode-agnostic and shared.
 *
 * Don't import `lightColors` / `darkColors` directly in screens. Use the
 * `useTheme()` hook from `@/src/lib/themeContext` so the screen reacts when
 * the user toggles the mode.
 */

export type ThemeColors = {
  bg: string;
  surface: string;
  surfaceSoft: string;
  surfaceAlt: string;
  surfaceSubtle: string;

  border: string;
  borderStrong: string;
  borderSubtle: string;

  text: string;
  textMuted: string;
  textSubtle: string;
  textOnDark: string;
  textOnBrand: string;

  brand: string;
  brandDeep: string;
  brandSoft: string;

  primary: string;
  primaryHover: string;
  primarySoft: string;

  accent: string;
  accentDeep: string;
  accentSoft: string;

  success: string;
  successSoft: string;
  successBorder: string;

  danger: string;
  dangerSoft: string;
  dangerBorder: string;

  warning: string;
  warningSoft: string;

  info: string;
  infoSoft: string;
};

export const lightColors: ThemeColors = {
  bg: "#FFF9EE",
  surface: "#FFFFFF",
  surfaceSoft: "#FFF4D6",
  surfaceAlt: "#F7F1E1",
  surfaceSubtle: "#FBF6E8",

  border: "#F1E5C8",
  borderStrong: "#E8D9A8",
  borderSubtle: "#F5EDD8",

  text: "#1A1A2E",
  textMuted: "#6B6B80",
  textSubtle: "#9A9AAB",
  textOnDark: "#FFFFFF",
  textOnBrand: "#1A1A2E",

  brand: "#FACC15",
  brandDeep: "#EAB308",
  brandSoft: "#FEF3C7",

  primary: "#1E3A8A",
  primaryHover: "#1E40AF",
  primarySoft: "#DBEAFE",

  accent: "#F97316",
  accentDeep: "#EA580C",
  accentSoft: "#FFEDD5",

  success: "#16A34A",
  successSoft: "#DCFCE7",
  successBorder: "#86EFAC",

  danger: "#DC2626",
  dangerSoft: "#FEE2E2",
  dangerBorder: "#FCA5A5",

  warning: "#F59E0B",
  warningSoft: "#FEF3C7",

  info: "#0EA5E9",
  infoSoft: "#E0F2FE",
};

export const darkColors: ThemeColors = {
  bg: "#0F0F1A",
  surface: "#1A1A2E",
  surfaceSoft: "#22223D",
  surfaceAlt: "#232338",
  surfaceSubtle: "#1F1F30",

  border: "#2D2D45",
  borderStrong: "#3D3D5A",
  borderSubtle: "#232338",

  text: "#F5F1E8",
  textMuted: "#A0A0B5",
  textSubtle: "#6B6B85",
  textOnDark: "#FFFFFF",
  textOnBrand: "#1A1A2E",

  brand: "#FACC15",
  brandDeep: "#EAB308",
  brandSoft: "#3D3315",

  primary: "#3B82F6",
  primaryHover: "#60A5FA",
  primarySoft: "#1E3A5F",

  accent: "#FB923C",
  accentDeep: "#F97316",
  accentSoft: "#4A2A18",

  success: "#4ADE80",
  successSoft: "#14352B",
  successBorder: "#2D6A47",

  danger: "#F87171",
  dangerSoft: "#3D1818",
  dangerBorder: "#8B2C2C",

  warning: "#FBBF24",
  warningSoft: "#3D3315",

  info: "#38BDF8",
  infoSoft: "#102A40",
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 36,
} as const;

export const typography = {
  display: { fontSize: 32, fontWeight: "800" as const, letterSpacing: -0.5 },
  title: { fontSize: 24, fontWeight: "800" as const, letterSpacing: -0.3 },
  heading: { fontSize: 20, fontWeight: "700" as const },
  body: { fontSize: 15, fontWeight: "500" as const },
  bodyBold: { fontSize: 15, fontWeight: "700" as const },
  caption: { fontSize: 13, fontWeight: "500" as const },
  label: {
    fontSize: 12,
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
};

/**
 * Shadows are computed from the theme so they look right on both modes.
 * On dark mode, shadows mostly disappear; we lean on borders + brand glows
 * for elevation cues instead.
 */
export function makeShadow(colors: ThemeColors, isDark: boolean) {
  const shadowColor = isDark ? "#000000" : "#1A1A2E";
  return {
    sm: {
      shadowColor,
      shadowOpacity: isDark ? 0.4 : 0.05,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    md: {
      shadowColor,
      shadowOpacity: isDark ? 0.5 : 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    brand: {
      shadowColor: colors.brandDeep,
      shadowOpacity: isDark ? 0.5 : 0.35,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    primary: {
      shadowColor: colors.primary,
      shadowOpacity: isDark ? 0.5 : 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    accent: {
      shadowColor: colors.accentDeep,
      shadowOpacity: isDark ? 0.55 : 0.3,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 5 },
      elevation: 5,
    },
  };
}

export type ThemeShadow = ReturnType<typeof makeShadow>;

/** Header / nav theming for expo-router Stack.Screen. */
export function makeNavTheme(colors: ThemeColors) {
  return {
    headerStyle: { backgroundColor: colors.bg },
    headerTitleStyle: { fontWeight: "700" as const, color: colors.text },
    headerTintColor: colors.text,
    contentStyle: { backgroundColor: colors.bg },
  };
}

export type Theme = {
  mode: "light" | "dark";
  colors: ThemeColors;
  shadow: ThemeShadow;
  radii: typeof radii;
  spacing: typeof spacing;
  typography: typeof typography;
};

export function makeTheme(mode: "light" | "dark"): Theme {
  const colors = mode === "dark" ? darkColors : lightColors;
  return {
    mode,
    colors,
    shadow: makeShadow(colors, mode === "dark"),
    radii,
    spacing,
    typography,
  };
}
