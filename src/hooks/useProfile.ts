import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Profile } from "../lib/types";

/**
 * Loads the current user's profile row.
 * Returns null while unauthenticated, or if the profile hasn't been created yet.
 */
export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, role, email, full_name, push_token")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.warn("useProfile:", error.message);
    }
    setProfile((data as Profile) ?? null);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, loading, refetch: fetchProfile };
}
