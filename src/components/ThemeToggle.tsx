import { Pressable, StyleSheet, Text } from "react-native";

import { useTheme } from "@/src/lib/themeContext";

/**
 * Small round button that toggles light <-> dark mode.
 * Designed to fit in expo-router headers (right side) or floated on the
 * login screen.
 */
export function ThemeToggle({ compact = false }: { compact?: boolean } = {}) {
  const { effectiveMode, toggleMode, colors } = useTheme();
  const isDark = effectiveMode === "dark";

  return (
    <Pressable
      onPress={toggleMode}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={
        isDark ? "Passer au thème clair" : "Passer au thème sombre"
      }
      style={[
        styles.btn,
        compact && styles.btnCompact,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={styles.emoji}>{isDark ? "☀️" : "🌙"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  btnCompact: { width: 34, height: 34 },
  emoji: { fontSize: 16 },
});
