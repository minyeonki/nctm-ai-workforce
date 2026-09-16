import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NCTM_AGENTS } from "@/lib/agents";
import { createProjectRoom } from "./actions";

export const dynamic = "force-dynamic";

type Room = {
  id: string;
  title: string;
  description: string;
  roomType: string;
  status: string;
  updatedAt: string;
  memberCount: number;
  messageCount: number;
  agents: { key: string; name: string }[];
};

type Workspace = {
  actor: { actorKey: string; displayName: string; permissionTier: number };
  rooms: Room[];
};

const TYPE_LABEL: Record<string, string> = {
  STUDENT_CASE: "학생 케이스",
  ASSESSMENT: "시험·채점",
  OPERATIONS: "학원 운영",
  GENERAL: "일반 프로젝트",
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: "열림",
  IN_PROGRESS: "진행 중",
  AWAITING_REVIEW: "검토 대기",
  COMPLETED: "완료",
  ARCHIVED: "보관",
};

function dateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

export default async function ProjectRoomsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/ai-workforce/command/login");

  const { data, error } = await supabase.rpc("list_ai_project_rooms_v01");
  const workspace = data as Workspace | null;

  if (error || !workspace) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <section className="mx-auto max-w-3xl rounded-3xl border border-amber-200 bg-amber-50 p-8">
          <p className="text-xs font-bold tracking-widest text-amber-700">PROJECT ROOM SETUP</p>
          <h1 className="mt-2 text-2xl font-bold text-amber-950">공유 프로젝트 룸을 준비 중입니다</h1>
          <p className="mt-3 text-sm leading-6 text-amber-900">
            데이터베이스 변경이 배포되면 이 화면에서 교사와 AI 직원이 같은 업무 공간을 사용합니다.
            오류 참조: {error?.code ?? "EMPTY_RESPONSE"}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <Link href="/ai-workforce" className="text-sm text-slate-400 hover:text-white">← AI 역량 관제센터</Link>
          <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold tracking-[0.2em] text-cyan-300">HUMAN + AI PROJECT SPACE</p>
              <h1 className="mt-2 text-3xl font-bold">공유 프로젝트 룸</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                교사와 AI 직원의 질문, 업무지시, 결과, 검토, 재작업 기록을 한 공간에 연결합니다.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-900 px-5 py-4 text-sm">
              <div className="text-slate-400">현재 사용자</div>
              <div className="mt-1 font-bold">{workspace.actor.displayName} · R{workspace.actor.permissionTier}</div>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-bold tracking-widest text-gray-400">ACTIVE ROOMS</p>
              <h2 className="mt-1 text-2xl font-bold">진행 중인 협업</h2>
            </div>
            <div className="text-sm text-gray-500">{workspace.rooms.length}개 프로젝트</div>
          </div>

          {workspace.rooms.length === 0 ? (
            <div className="mt-4 rounded-3xl border border-dashed bg-white p-10 text-center">
              <div className="text-4xl">🧩</div>
              <h3 className="mt-4 text-lg font-bold">첫 프로젝트 룸을 만드세요</h3>
              <p className="mt-2 text-sm text-gray-500">학생 케이스나 시험 채점처럼 실제 업무 단위로 시작하면 됩니다.</p>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {workspace.rooms.map((room) => (
                <Link key={room.id} href={`/ai-workforce/projects/${room.id}`} className="group rounded-3xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-800">{TYPE_LABEL[room.roomType] ?? room.roomType}</span>
                      <h3 className="mt-3 text-lg font-bold text-gray-950 group-hover:text-cyan-800">{room.title}</h3>
                    </div>
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">{STATUS_LABEL[room.status] ?? room.status}</span>
                  </div>
                  <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-gray-500">{room.description || "설명이 아직 없습니다."}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {room.agents.map((agent) => <span key={agent.key} className="rounded-lg bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700">AI · {agent.name}</span>)}
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t pt-4 text-xs text-gray-400">
                    <span>참여 {room.memberCount} · 기록 {room.messageCount}</span>
                    <span>{dateTime(room.updatedAt)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <aside className="rounded-3xl border bg-white p-6 shadow-sm lg:sticky lg:top-6 lg:self-start">
          <p className="text-xs font-bold tracking-widest text-cyan-700">NEW PROJECT</p>
          <h2 className="mt-1 text-xl font-bold">공유 룸 만들기</h2>
          <form action={createProjectRoom} className="mt-5 space-y-4">
            <label className="block text-sm font-semibold text-gray-700">
              프로젝트 이름
              <input name="title" required minLength={2} maxLength={120} placeholder="예: 김도원 중2-2 오답 개선" className="mt-2 w-full rounded-xl border px-3 py-2.5 font-normal" />
            </label>
            <label className="block text-sm font-semibold text-gray-700">
              업무 유형
              <select name="roomType" className="mt-2 w-full rounded-xl border bg-white px-3 py-2.5 font-normal">
                <option value="STUDENT_CASE">학생 케이스</option>
                <option value="ASSESSMENT">시험·채점</option>
                <option value="OPERATIONS">학원 운영</option>
                <option value="GENERAL">일반 프로젝트</option>
              </select>
            </label>
            <label className="block text-sm font-semibold text-gray-700">
              목표와 배경
              <textarea name="description" maxLength={2000} rows={3} placeholder="AI와 교사가 함께 해결할 내용을 적어주세요." className="mt-2 w-full resize-none rounded-xl border px-3 py-2.5 font-normal" />
            </label>
            <fieldset>
              <legend className="text-sm font-semibold text-gray-700">함께할 AI 직원</legend>
              <div className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded-2xl bg-gray-50 p-3">
                {NCTM_AGENTS.map((agent) => (
                  <label key={agent.id} className="flex cursor-pointer items-start gap-3 rounded-xl bg-white p-3 text-sm">
                    <input type="checkbox" name="agents" value={agent.id} className="mt-1" />
                    <span><strong>{agent.name}</strong><span className="mt-0.5 block text-xs leading-5 text-gray-500">{agent.mission}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>
            <button className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-cyan-800">프로젝트 룸 열기</button>
          </form>
        </aside>
      </section>
    </main>
  );
}
