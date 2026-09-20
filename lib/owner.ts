/**
 * The single owner of this instance.
 *
 * There is no sign-in: every row belongs to this fixed id. Keep it in sync
 * with supabase/migrations/0002_single_owner.sql, which also sets it as the
 * column default.
 */
export const OWNER_ID = "00000000-0000-4000-8000-000000000001";
