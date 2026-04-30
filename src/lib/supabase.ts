import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import { AppState, Platform } from "react-native";

// Reads from app.json "extra" or falls back to the values below.
// Move these to env/Expo config before shipping.
const extra = (Constants.expoConfig?.extra ?? {}) as {
  supabaseUrl: string;
  supabasePublishableKey: string;
};

const supabaseUrl =
  extra.supabaseUrl;
const publishableKey =
  extra.supabasePublishableKey;

export const supabase = createClient(supabaseUrl, publishableKey, {
  auth: {
    // Web uses its own localStorage; native uses AsyncStorage.
    storage: Platform.OS === "web" ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
  },
});

// Pause/resume auto refresh based on app foreground state (recommended by Supabase).
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
