import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { postProjectMessage } from "../actions";

export const dynamic = "force-dynamic";

type Member = { type: "HUMAN" | "AI_AGENT"; key: string; name: string };
type Message = {
  id: string;
  authorType: "HUMAN" | "AI_AGENT" | "SYSTEM";
  authorKey: string;
  authorName: string;
  messageType: string;
  body: string;
  relatedRunId: string | null;
  assignedAgentKey?: string | null;
  executionId?: string | null;
  dispatchStatus?: string | null;
  metadata?: { draft?: boolean; model?: string; provenance?: string };
  createdAt: string;
};
type Workspace = {
  actor: { actorKey: string; displayName: string; permissionTier: number };
  room: { id: string; title: string; description: string; roomType: string; status: string; updatedAt: string };
  members: Member[];
  messages: Message[];
};

const MESSAGE_LABEL: Record<string, string> = {
  COMMENT: "의견",
  TASK_REQUEST: "업무지시",
  AI_RESULT: "AI 결과",
  REVIEW: "검토",
  REWORK_REQUEST: "재작업",
  SYSTEM: "시스템",
};

function dateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

export default async function ProjectRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/ai-workforce/command/login");

  const { data, error } = await supabase.rpc("get_ai_project_room_v01", { p_room_id: roomId });
  if (error || !data) notFound();
  const workspace = data as Workspace;
  const agents = workspace.members.filter((member) => member.type === "AI_AGENT");
  const humans = workspace.members.filter((member) => member.type === "HUMAN");

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-[1500px] px-5 py-4">
          <Link href="/ai-workforce/projects" className="text-sm text-gray-500 hover:text-gray-950">← 공유 프로젝트 룸</Link>
          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold">{workspace.room.title}</h1>
                <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-800">{workspace.room.status}</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">{workspace.room.description || "프로젝트 설명이 없습니다."}</p>
            </div>
            <Link href="/ai-workforce/command" className="rounded-xl border px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">승인 관제센터 →</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-5 px-5 py-5 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
        <aside className="rounded-3xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-bold tracking-widest text-gray-400">PARTICIPANTS</p>
          <h2 className="mt-1 font-bold">함께 일하는 구성원</h2>
          <div className="mt-5 space-y-3">
            {humans.map((member) => (
              <div key={member.key} className="flex items-center gap-3 rounded-2xl bg-gray-50 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-sm text-white">사람</div>
                <div><div className="text-sm font-bold">{member.name}</div><div className="text-xs text-gray-400">교직원</div></div>
              </div>
            ))}
            {agents.map((member) => (
              <div key={member.key} className="flex items-center gap-3 rounded-2xl border border-violet-100 bg-violet-50 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-sm text-white">AI</div>
                <div><div className="text-sm font-bold text-violet-950">{member.name}</div><div className="text-xs text-violet-500">AI 직원</div></div>
              </div>
            ))}
          </div>
        </aside>

        <section className="flex min-h-[70vh] flex-col rounded-3xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4">
            <p className="text-xs font-bold tracking-widest text-cyan-700">ROOM TIMELINE</p>
            <h2 className="mt-1 font-bold">업무 기록</h2>
          </div>
          <div className="flex-1 space-y-4 p-5">
            {workspace.messages.map((message) => {
              const isSystem = message.authorType === "SYSTEM";
              const isAgent = message.authorType === "AI_AGENT";
              return (
                <article key={message.id} className={`rounded-2xl border p-4 ${isSystem ? "border-gray-200 bg-gray-50" : isAgent ? "border-violet-200 bg-violet-50" : "border-cyan-100 bg-white"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <strong className="text-sm">{message.authorName}</strong>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-gray-500">{MESSAGE_LABEL[message.messageType] ?? message.messageType}</span>
                    </div>
                    <time className="text-xs text-gray-400">{dateTime(message.createdAt)}</time>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-700">{message.body}</p>
                  {message.messageType === "AI_RESULT" && (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-amber-100 px-2 py-1 font-bold text-amber-800">교직원 검토 필요</span>
                      {message.metadata?.model && <span className="rounded-full bg-white px-2 py-1 text-gray-500">{message.metadata.model}</span>}
                    </div>
                  )}
                  {message.executionId && <p className="mt-3 text-xs font-mono text-gray-400">execution {message.executionId}</p>}
                  {message.relatedRunId && <p className="mt-1 text-xs font-mono text-gray-400">run {message.relatedRunId}</p>}
                </article>
              );
            })}
          </div>
          <form action={postProjectMessage} className="border-t bg-gray-50 p-4">
            <input type="hidden" name="roomId" value={workspace.room.id} />
            <div className="grid gap-3 sm:grid-cols-[150px_minmax(0,1fr)_auto]">
              <div className="grid gap-2">
                <select name="messageType" className="rounded-xl border bg-white px-3 py-2.5 text-sm">
                  <option value="TASK_REQUEST">AI 업무지시</option>
                <option value="COMMENT">질문·의견</option>
                <option value="REVIEW">결과 검토</option>
                  <option value="REWORK_REQUEST">재작업 요청</option>
                </select>
                <select name="agentKey" defaultValue={agents[0]?.key ?? ""} className="rounded-xl border bg-white px-3 py-2.5 text-sm">
                  <option value="" disabled>담당 AI 선택</option>
                  {agents.map((agent) => <option key={agent.key} value={agent.key}>{agent.name}</option>)}
                </select>
              </div>
              <textarea name="body" required maxLength={12000} rows={2} placeholder="질문이나 업무지시를 구체적으로 입력하세요." className="resize-none rounded-xl border bg-white px-3 py-2.5 text-sm" />
              <button className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white hover:bg-cyan-800">룸에 올리기</button>
            </div>
          </form>
        </section>

        <aside className="space-y-4">
          <div className="rounded-3xl border bg-white p-5 shadow-sm">
            <p className="text-xs font-bold tracking-widest text-gray-400">WORKFLOW</p>
            <h2 className="mt-1 font-bold">업무 진행 단계</h2>
            <ol className="mt-4 space-y-3 text-sm">
              {["업무지시", "AI 처리", "결과 제출", "교사 검토", "승인 또는 재작업"].map((step, index) => (
                <li key={step} className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{index + 1}</span><span>{step}</span></li>
              ))}
            </ol>
          </div>
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-xs font-bold tracking-widest text-amber-700">CAPABILITY SAFETY</p>
            <p className="mt-2 text-sm leading-6 text-amber-950">
              룸의 업무지시는 먼저 기록됩니다. 실제 AI 실행은 해당 AI가 SHADOW 이상으로 승격되고 Governance 실행 게이트를 통과한 경우에만 연결됩니다.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
