import { VISITOR_DAILY_CAP, isUnlocked } from "@/lib/access";
import { usageToday } from "@/lib/usage";
import { GenerateClient } from "./generate-client";

/**
 * Never prerender this page.
 *
 * It depends on the unlock cookie and on a counter that changes through the
 * day, so a build-time render would freeze both. Without this the lock check
 * runs at build time, when there is no cookie, and the page stays locked even
 * for the owner. Next cannot infer this reliably here, because isUnlocked()
 * short-circuits before touching cookies() when no password is configured.
 */
export const dynamic = "force-dynamic";

export default async function GeneratePage() {
  const unlocked = await isUnlocked();
  const used = unlocked ? 0 : await usageToday();

  return (
    <GenerateClient
      unlocked={unlocked}
      liveRemaining={Math.max(0, VISITOR_DAILY_CAP - used)}
    />
  );
}
