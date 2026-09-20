import { canGenerate, getUser } from "@/lib/supabase/server";
import { ImportClient } from "./import-client";

export default async function ImportPage() {
  const user = await getUser();
  return <ImportClient allowed={canGenerate(user!.email)} />;
}
