/**
 * Theme context — exposes the current theme + a setter, persists the user's
 * choice in AsyncStorage so it survives reloads. Defaults to system preference.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";

import { makeTheme, type Theme } from "./theme";

const STORAGE_KEY = "move-chilld:theme-mode";

export type ThemeMode = "light" | "dark" | "system";

type ThemeContextValue = Theme & {
  /** Persisted preference: 'light' | 'dark' | 'system'. */
  mode: ThemeMode;
  /** Effective resolved mode after applying system preference. */
  effectiveMode: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (value === "light" || value === "dark" || value === "system") {
          setModeState(value);
        }
      })
      .finally(() => setHydrated(true));
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const effectiveMode: "light" | "dark" =
    mode === "system" ? (systemScheme === "dark" ? "dark" : "light") : mode;

  const toggleMode = useCallback(() => {
    setMode(effectiveMode === "dark" ? "light" : "dark");
  }, [effectiveMode, setMode]);

  const value = useMemo<ThemeContextValue>(() => {
    const theme = makeTheme(effectiveMode);
    return {
      ...theme,
      mode,
      effectiveMode,
      setMode,
      toggleMode,
    };
  }, [effectiveMode, mode, setMode, toggleMode]);

  // Avoid the "wrong theme flash" before AsyncStorage hydrates.
  // The first paint waits for either a stored value or system preference.
  if (!hydrated) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return ctx;
}
