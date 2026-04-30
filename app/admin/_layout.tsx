import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { ThemeToggle } from "@/src/components/ThemeToggle";
import { useProfile } from "@/src/hooks/useProfile";
import { useSession } from "@/src/hooks/useSession";
import { makeNavTheme } from "@/src/lib/theme";
import { useTheme } from "@/src/lib/themeContext";

export default function AdminLayout() {
  const { colors } = useTheme();
  const { session, loading: sessionLoading } = useSession();
  const { profile, loading: profileLoading } = useProfile(session?.user.id);

  if (sessionLoading || profileLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.brandDeep} />
      </View>
    );
  }

  if (!session) return <Redirect href="/" />;
  if (profile?.role !== "admin") return <Redirect href="/" />;

  return (
    <Stack
      screenOptions={{
        ...makeNavTheme(colors),
        headerRight: () => <ThemeToggle compact />,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Admin" }} />
      <Stack.Screen
        name="route/[id]"
        options={{ title: "Ligne", headerBackTitle: "Admin" }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
