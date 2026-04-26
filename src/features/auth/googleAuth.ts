import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "../../lib/supabase";

// Required for the auth session to complete after the web flow.
WebBrowser.maybeCompleteAuthSession();

/**
 * Kicks off Google OAuth via Supabase using the browser flow.
 * The OAuth callback URL must be configured in Supabase:
 *   - movechilld://auth-callback (native)
 *   - http(s)://<your-domain>/auth-callback (web)
 *
 * After the browser returns, Supabase parses the token from the deep link
 * via `onAuthStateChange`.
 */
export async function signInWithGoogle(): Promise<{ error?: string }> {
  const redirectTo = Linking.createURL("auth-callback");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data?.url) {
    return { error: error?.message ?? "Could not start Google sign-in" };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type !== "success" || !result.url) {
    return { error: result.type === "cancel" ? undefined : "Sign-in failed" };
  }

  // Parse the tokens from the redirect URL fragment/query and set the session.
  const url = new URL(result.url);
  const params = new URLSearchParams(
    (url.hash?.startsWith("#") ? url.hash.slice(1) : url.search.slice(1)) || ""
  );
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");

  if (access_token && refresh_token) {
    const { error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });
    if (sessionError) return { error: sessionError.message };
  }

  return {};
}
