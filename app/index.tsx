import { signInWithGoogle } from "@/src/features/auth/googleAuth";
import { useProfile } from "@/src/hooks/useProfile";
import { useSession } from "@/src/hooks/useSession";
import { supabase } from "@/src/lib/supabase";
import { Redirect } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export default function LoginScreen() {
  const { session, loading } = useSession();
  const { profile, loading: profileLoading } = useProfile(session?.user.id);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading || (session && profileLoading)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (session) {
    const role = profile?.role ?? "parent";
    if (role === "admin") return <Redirect href="/admin" />;
    if (role === "driver") return <Redirect href="/driver" />;
    return <Redirect href="/home" />;
  }

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
    setMessage(null);
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    setBusy(false);
    setMessage(error ? error.message : "Compte créé — vérifie ton email.");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Move-Chilld</Text>
      <Text style={styles.subtitle}>Sais exactement quand partir pour le bus scolaire.</Text>

      <Pressable
        onPress={handleGoogle}
        disabled={busy}
        style={[styles.primaryBtn, busy && styles.disabled]}
      >
        <Text style={styles.primaryBtnText}>Continuer avec Google</Text>
      </Pressable>

      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.dividerText}>ou</Text>
        <View style={styles.line} />
      </View>

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />
      <TextInput
        placeholder="Mot de passe"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />

      <Pressable
        onPress={handleLogin}
        disabled={busy}
        style={[styles.secondaryBtn, busy && styles.disabled]}
      >
        <Text style={styles.secondaryBtnText}>Se connecter</Text>
      </Pressable>

      <Pressable onPress={handleSignUp} disabled={busy} style={styles.ghostBtn}>
        <Text style={styles.ghostBtnText}>Créer un compte</Text>
      </Pressable>

      {!!message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    gap: 12,
    backgroundColor: "#fff",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 32, fontWeight: "800" },
  subtitle: { fontSize: 15, color: "#555", marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: "#e2e2e2",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
  },
  primaryBtn: {
    backgroundColor: "#111",
    padding: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  primaryBtnText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "700",
    fontSize: 15,
  },
  secondaryBtn: {
    backgroundColor: "#2563eb",
    padding: 14,
    borderRadius: 12,
    marginTop: 4,
  },
  secondaryBtnText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "700",
    fontSize: 15,
  },
  ghostBtn: { padding: 12 },
  ghostBtnText: { textAlign: "center", color: "#555", fontWeight: "600" },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 6,
  },
  line: { flex: 1, height: 1, backgroundColor: "#eee" },
  dividerText: { color: "#888", fontSize: 13 },
  disabled: { opacity: 0.5 },
  message: { color: "#333", textAlign: "center", marginTop: 8 },
});
