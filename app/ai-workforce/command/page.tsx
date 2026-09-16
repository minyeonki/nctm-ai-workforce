import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { decideApproval } from "./actions";

export const dynamic = "force-dynamic";

type Agent = { actorKey: string; displayName: string; capabilityStage: string; configVersion: string };
type Approval = {
  id: string; status: string;
  action: { action_type?: string; execution_mode?: string };
  requiredPermissionTier: number; expiresAt: string;
};
type CommandDesk = {
  actor: { actorKey: string; displayName: string; permissionTier: number };
  agents: Agent[];
  approvals: Approval[];
  executions: { status: string }[];
  verifications: { status: string }[];
};

const EXECUTABLE = new Set(["SHADOW", "APPROVAL_GATED", "ACTIVE"]);

function dateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

export default async function CommandDeskPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/ai-workforce/command/login");

  const { data, error } = await supabase.rpc("get_governance_command_desk_v01");
  const desk = data as CommandDesk | null;

  if (error || !desk) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <section className="mx-auto max-w-3xl rounded-3xl border border-red-200 bg-red-50 p-8">
          <p className="text-xs font-bold tracking-widest text-red-700">ACCESS DENIED</p>
          <h1 className="mt-2 text-2xl font-bold text-red-950">Actor 권한을 확인할 수 없습니다</h1>
          <p className="mt-3 text-sm leading-6 text-red-900">
            로그인은 확인됐지만 활성 R5 인간 Actor 연결 또는 Governance RPC 권한이 없습니다.
            오류 참조: {error?.code ?? "EMPTY_RESPONSE"}
          </p>
          <form action={logout}><button className="mt-6 rounded-xl bg-red-950 px-4 py-2 text-sm font-bold text-white">로그아웃</button></form>
        </section>
      </main>
    );
  }

  const executableAgents = desk.agents.filter((agent) => EXECUTABLE.has(agent.capabilityStage));
  const pendingApprovals = desk.approvals.filter((approval) => approval.status === "PENDING");

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-black text-white">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Link href="/ai-workforce" className="text-sm text-gray-400 hover:text-white">← AI 역량 관제센터</Link>
              <p className="mt-5 text-sm font-semibold tracking-[0.2em] text-pink-400">AI COMMAND DESK · LIVE GOVERNANCE</p>
              <h1 className="mt-2 text-3xl font-bold">원장 업무지시실</h1>
              <p className="mt-3 text-sm text-gray-400">Supabase Auth → {desk.actor.displayName} · R{desk.actor.permissionTier}</p>
            </div>
            <form action={logout}><button className="rounded-xl border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-900">로그아웃</button></form>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div className={`rounded-3xl border p-6 ${executableAgents.length ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
          <p className="text-xs font-bold tracking-widest text-gray-600">EXECUTION GATE</p>
          <h2 className="mt-2 text-xl font-bold">
            {executableAgents.length ? `실행 가능 AI ${executableAgents.length}개` : "현재 실행 가능한 AI가 없습니다"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-700">
            표시 상태는 샘플이 아니라 Governance DB의 실시간 capability stage입니다. 실제 변경은 별도 승인을 통과해야 합니다.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["승인", desk.approvals.length, pendingApprovals.length],
            ["실행", desk.executions.length, desk.executions.filter((x) => x.status === "RUNNING").length],
            ["검증", desk.verifications.length, desk.verifications.filter((x) => x.status === "PENDING").length],
          ].map(([label, total, active]) => (
            <div key={String(label)} className="rounded-3xl border bg-white p-5 shadow-sm">
              <p className="text-xs font-bold tracking-widest text-gray-400">{label}</p>
              <p className="mt-2 text-3xl font-bold">{total}</p>
              <p className="mt-1 text-sm text-gray-500">처리 필요 {active}</p>
            </div>
          ))}
        </div>

        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">AI Capability Registry</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {desk.agents.map((agent) => (
              <article key={agent.actorKey} className="rounded-2xl bg-gray-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <strong>{agent.displayName}</strong>
                  <span className="rounded-full bg-gray-200 px-2 py-1 text-xs font-bold">{agent.capabilityStage}</span>
                </div>
                <p className="mt-2 text-xs text-gray-500">config {agent.configVersion}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">승인 대기열</h2>
          {pendingApprovals.length === 0 ? (
            <p className="mt-4 rounded-2xl bg-gray-50 p-5 text-sm text-gray-500">현재 승인 대기 요청이 없습니다.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {pendingApprovals.map((approval) => (
                <article key={approval.id} className="rounded-2xl border p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong>{approval.action.action_type ?? "UNKNOWN_ACTION"}</strong>
                    <span className="text-xs text-gray-500">만료 {dateTime(approval.expiresAt)}</span>
                  </div>
                  <p className="mt-2 text-sm text-gray-600">실행 방식 {approval.action.execution_mode} · 요구 권한 R{approval.requiredPermissionTier}</p>
                  <form action={decideApproval} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
                    <input type="hidden" name="approvalId" value={approval.id} />
                    <input name="reason" required minLength={3} placeholder="승인 또는 거절 근거" className="rounded-xl border px-3 py-2 text-sm" />
                    <button name="decision" value="REJECTED" className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700">거절</button>
                    <button name="decision" value="APPROVED" className="rounded-xl bg-black px-4 py-2 text-sm font-bold text-white">승인</button>
                  </form>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
