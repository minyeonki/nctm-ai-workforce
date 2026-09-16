"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function decideApproval(formData: FormData) {
  const id = formData.get("approvalId");
  const decision = formData.get("decision");
  const reason = formData.get("reason");

  if (typeof id !== "string" || !UUID.test(id)) throw new Error("Invalid approval id");
  if (decision !== "APPROVED" && decision !== "REJECTED") throw new Error("Invalid approval decision");
  if (typeof reason !== "string" || reason.trim().length < 3) throw new Error("Approval reason is required");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/ai-workforce/command/login");

  const { error } = await supabase.rpc("decide_governance_approval_v01", {
    p_approval_request_id: id,
    p_decision: decision,
    p_reason: reason.trim(),
  });
  if (error) throw new Error(`Approval decision failed: ${error.code}`);
  revalidatePath("/ai-workforce/command");
}
