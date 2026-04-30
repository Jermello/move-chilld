import { ThemeToggle } from "@/src/components/ThemeToggle";
import { signInWithGoogle } from "@/src/features/auth/googleAuth";
import { useProfile } from "@/src/hooks/useProfile";
import { useSession } from "@/src/hooks/useSession";
import { supabase } from "@/src/lib/supabase";
import { radii, spacing, typography, type Theme } from "@/src/lib/theme";
import { useTheme } from "@/src/lib/themeContext";
import { Redirect } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Mode = "login" | "signup";

export default function LoginScreen() {
  const theme = useTheme();
  const { colors, shadow } = theme;
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const { session, loading } = useSession();
  const { profile, loading: profileLoading } = useProfile(session?.user.id);

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [intendedRole, setIntendedRole] = useState<"parent" | "driver">("parent");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading || (session && profileLoading)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brandDeep} />
      </View>
    );
  }

  if (session) {
    const role = profile?.role ?? "parent";
    if (role === "admin") return <Redirect href="/admin" />;
    if (role === "driver") return <Redirect href="/driver" />;
    return <Redirect href="/home" />;
  }

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    setMessage(null);
  };

  const handleGoogle = async () => {
    setMessage(null);
    setBusy(true);
    const { error } = await signInWithGoogle();
    setBusy(false);
    if (error) setMessage(error);
  };

  const handleLogin = async () => {
    setMessage(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (error) setMessage(error.message);
  };

  const handleSignUp = async () => {
    const trimmedName = fullName.trim();
    if (!trimmedName) {
      setMessage("Renseigne ton nom pour créer un compte.");
      return;
    }
    setMessage(null);
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          intended_role: intendedRole,
          full_name: trimmedName,
        },
      },
    });

    if (!error && data.user?.id) {
      const userId = data.user.id;
      const { error: nameError } = await supabase
        .from("profiles")
        .update({ full_name: trimmedName, email: email.trim() })
        .eq("id", userId);
      if (nameError) console.warn("signup name update:", nameError.message);

      if (intendedRole === "driver") {
        const { error: roleError } = await supabase
          .from("profiles")
          .update({ role: "driver" })
          .eq("id", userId)
          .eq("role", "parent");
        if (roleError) console.warn("signup role update:", roleError.message);
      }
    }

    setBusy(false);
    setMessage(error ? error.message : "Compte créé.");
  };

  const isSignup = mode === "signup";
  const submitLabel = isSignup ? "Créer mon compte" : "Se connecter";
  const onSubmit = isSignup ? handleSignUp : handleLogin;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.toggleSlot}>
        <ThemeToggle />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <View style={[styles.logoBadge, shadow.brand]}>
            <Text style={styles.logoEmoji}>🚌</Text>
          </View>
          <Text style={styles.title}>Move-Chilld</Text>
          <Text style={styles.subtitle}>
            Sais exactement quand partir{"\n"}pour le bus scolaire.
          </Text>
        </View>

        <Pressable
          onPress={handleGoogle}
          disabled={busy}
          style={[styles.googleBtn, shadow.sm, busy && styles.disabled]}
        >
          <Text style={styles.googleBtnText}>Continuer avec Google</Text>
        </Pressable>

        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.dividerText}>ou par email</Text>
          <View style={styles.line} />
        </View>

        <View style={styles.modeTabs}>
          <Pressable
            onPress={() => switchMode("login")}
            style={[
              styles.modeTab,
              !isSignup && [styles.modeTabActive, shadow.sm],
            ]}
          >
            <Text style={[styles.modeTabText, !isSignup && styles.modeTabTextActive]}>
              Se connecter
            </Text>
          </Pressable>
          <Pressable
            onPress={() => switchMode("signup")}
            style={[
              styles.modeTab,
              isSignup && [styles.modeTabActive, shadow.sm],
            ]}
          >
            <Text style={[styles.modeTabText, isSignup && styles.modeTabTextActive]}>
              Créer un compte
            </Text>
          </Pressable>
        </View>

        <View style={styles.form}>
          {isSignup && (
            <View style={styles.field}>
              <Text style={styles.label}>Nom complet</Text>
              <TextInput
                placeholder="Prénom Nom"
                placeholderTextColor={colors.textSubtle}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                autoComplete="name"
                style={styles.input}
              />
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              placeholder="toi@exemple.com"
              placeholderTextColor={colors.textSubtle}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Mot de passe</Text>
            <TextInput
              placeholder={isSignup ? "Au moins 6 caractères" : "Ton mot de passe"}
              placeholderTextColor={colors.textSubtle}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={isSignup ? "new-password" : "current-password"}
              style={styles.input}
            />
          </View>

          {isSignup && (
            <View style={styles.field}>
              <Text style={styles.label}>Je suis</Text>
              <View style={styles.segmented}>
                <Pressable
                  onPress={() => setIntendedRole("parent")}
                  style={[
                    styles.segment,
                    intendedRole === "parent" && [styles.segmentActive, shadow.sm],
                  ]}
                >
                  <Text style={styles.segmentEmoji}>👨‍👩‍👧</Text>
                  <Text
                    style={[
                      styles.segmentText,
                      intendedRole === "parent" && styles.segmentTextActive,
                    ]}
                  >
                    Parent
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setIntendedRole("driver")}
                  style={[
                    styles.segment,
                    intendedRole === "driver" && [styles.segmentActive, shadow.sm],
                  ]}
                >
                  <Text style={styles.segmentEmoji}>🚌</Text>
                  <Text
                    style={[
                      styles.segmentText,
                      intendedRole === "driver" && styles.segmentTextActive,
                    ]}
                  >
                    Chauffeur
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        <Pressable
          onPress={onSubmit}
          disabled={busy}
          style={[styles.primaryBtn, shadow.primary, busy && styles.disabled]}
        >
          <Text style={styles.primaryBtnText}>{submitLabel}</Text>
        </Pressable>

        {!!message && (
          <View style={styles.messageBox}>
            <Text style={styles.messageText}>{message}</Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles({ colors }: Theme) {
  return StyleSheet.create({
    container: {
      flexGrow: 1,
      justifyContent: "center",
      padding: spacing.xl,
      gap: spacing.md,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.bg,
    },
    toggleSlot: {
      position: "absolute",
      top: spacing.xxxl + spacing.md,
      right: spacing.xl,
      zIndex: 10,
    },

    hero: { alignItems: "center", marginBottom: spacing.md },
    logoBadge: {
      width: 72,
      height: 72,
      borderRadius: radii.xl,
      backgroundColor: colors.brand,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.md,
    },
    logoEmoji: { fontSize: 38 },
    title: { ...typography.display, color: colors.text },
    subtitle: {
      ...typography.body,
      color: colors.textMuted,
      marginTop: spacing.xs,
      textAlign: "center",
    },

    googleBtn: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      paddingVertical: 14,
      borderRadius: radii.lg,
    },
    googleBtnText: {
      color: colors.text,
      textAlign: "center",
      fontWeight: "600",
      fontSize: 15,
    },

    divider: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      marginVertical: spacing.xs,
    },
    line: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: { color: colors.textSubtle, fontSize: 12, fontWeight: "600" },

    modeTabs: {
      flexDirection: "row",
      backgroundColor: colors.surfaceAlt,
      borderRadius: radii.lg,
      padding: 4,
      gap: 4,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    modeTab: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: radii.md,
      alignItems: "center",
    },
    modeTabActive: {
      backgroundColor: colors.surface,
    },
    modeTabText: { color: colors.textMuted, fontWeight: "600", fontSize: 14 },
    modeTabTextActive: { color: colors.text },

    form: { gap: spacing.md, marginTop: spacing.xs },
    field: { gap: 6 },
    label: { ...typography.label, color: colors.textMuted },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.lg,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      backgroundColor: colors.surface,
      color: colors.text,
    },

    segmented: {
      flexDirection: "row",
      backgroundColor: colors.surfaceAlt,
      borderRadius: radii.md,
      padding: 4,
      gap: 4,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    segment: {
      flex: 1,
      paddingVertical: 10,
      alignItems: "center",
      borderRadius: radii.sm,
      flexDirection: "row",
      justifyContent: "center",
      gap: 6,
    },
    segmentActive: {
      backgroundColor: colors.brand,
    },
    segmentEmoji: { fontSize: 16 },
    segmentText: { color: colors.textMuted, fontWeight: "700", fontSize: 14 },
    segmentTextActive: { color: colors.textOnBrand },

    primaryBtn: {
      backgroundColor: colors.primary,
      paddingVertical: 16,
      borderRadius: radii.lg,
      marginTop: spacing.xs,
    },
    primaryBtnText: {
      color: colors.textOnDark,
      textAlign: "center",
      fontWeight: "700",
      fontSize: 16,
    },

    disabled: { opacity: 0.5 },
    messageBox: {
      backgroundColor: colors.warningSoft,
      borderWidth: 1,
      borderColor: colors.brandDeep,
      borderRadius: radii.md,
      padding: spacing.md,
      marginTop: spacing.xs,
    },
    messageText: { color: colors.text, textAlign: "center", fontWeight: "500" },
  });
}
