/**
 * Authentication controller — wraps Supabase Auth.
 */

import type { User, AuthChangeEvent, Session } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";

export async function signUp(email: string, password: string): Promise<{ error?: string }> {
  const sb = getSupabase();
  if (!sb) return { error: "Supabase not configured" };
  const { error } = await sb.auth.signUp({ email, password });
  if (error) return { error: error.message };
  return {};
}

export async function signIn(email: string, password: string): Promise<{ error?: string }> {
  const sb = getSupabase();
  if (!sb) return { error: "Supabase not configured" };
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  return {};
}

export async function signOut(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
}

export function getCurrentUser(): User | null {
  // Supabase JS v2 has no synchronous user accessor; use getSessionUser() or onAuthStateChange instead.
  return null;
}

export async function getSessionUser(): Promise<User | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user ?? null;
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
): (() => void) | undefined {
  const sb = getSupabase();
  if (!sb) return undefined;
  const { data } = sb.auth.onAuthStateChange(callback);
  return () => data.subscription.unsubscribe();
}

export async function resetPassword(email: string, redirectTo?: string): Promise<{ error?: string }> {
  const sb = getSupabase();
  if (!sb) return { error: "Supabase not configured" };
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: redirectTo ?? window.location.origin,
  });
  if (error) return { error: error.message };
  return {};
}

export async function updatePassword(newPassword: string): Promise<{ error?: string }> {
  const sb = getSupabase();
  if (!sb) return { error: "Supabase not configured" };
  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) return { error: error.message };
  return {};
}

export async function touchActive(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.rpc("touch_active");
}
