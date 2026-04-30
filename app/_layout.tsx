import {
  DarkTheme as NavDarkTheme,
  DefaultTheme as NavLightTheme,
  ThemeProvider as NavThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { ThemeToggle } from "@/src/components/ThemeToggle";
import { makeNavTheme } from "@/src/lib/theme";
import { ThemeProvider, useTheme } from "@/src/lib/themeContext";

function ThemedStack() {
  const { effectiveMode, colors } = useTheme();

  const navTheme = {
    ...(effectiveMode === "dark" ? NavDarkTheme : NavLightTheme),
    colors: {
      ...(effectiveMode === "dark" ? NavDarkTheme : NavLightTheme).colors,
      background: colors.bg,
      card: colors.bg,
      text: colors.text,
      border: colors.borderSubtle,
      primary: colors.primary,
      notification: colors.accent,
    },
  };

  return (
    <NavThemeProvider value={navTheme}>
      <Stack
        screenOptions={{
          ...makeNavTheme(colors),
          headerRight: () => <ThemeToggle compact />,
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="home" options={{ title: "Move-Chilld" }} />
        <Stack.Screen name="driver" options={{ title: "Tableau chauffeur" }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style={effectiveMode === "dark" ? "light" : "dark"} />
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ThemedStack />
    </ThemeProvider>
  );
}
