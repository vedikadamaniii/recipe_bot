import { VISITOR_DAILY_CAP, isUnlocked } from "@/lib/access";
import { usageToday } from "@/lib/usage";
import { GenerateClient } from "./generate-client";

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
