import Link from "next/link";
import { CAPABILITY_LABEL, NCTM_AGENTS, type CapabilityStage } from "@/lib/agents";

const STAGE_STYLE: Record<CapabilityStage, string> = {
  DESIGN_ONLY: "border-gray-200 bg-gray-50 text-gray-600",
  DATA_CONNECTED: "border-cyan-200 bg-cyan-50 text-cyan-800",
  SHADOW: "border-blue-200 bg-blue-50 text-blue-800",
  APPROVAL_GATED: "border-amber-200 bg-amber-50 text-amber-800",
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-800",
  SUSPENDED: "border-red-200 bg-red-50 text-red-800",
};

const DOMAIN_ICON: Record<NctmDomain, string> = { 교육: "🎓", 운영: "🏫", 경영: "📊", 콘텐츠: "📣", 개발: "💻" };
type NctmDomain = (typeof NCTM_AGENTS)[number]["domain"];

export default function AiWorkforcePage() {
  const activeCount = NCTM_AGENTS.filter((agent) => agent.capabilityStage === "ACTIVE").length;
  const connectedCount = NCTM_AGENTS.filter((agent) => agent.capabilityStage !== "DESIGN_ONLY").length;
  const priorityCount = NCTM_AGENTS.filter((agent) => agent.priority === 1).length;

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-black text-white">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <Link href="/" className="text-sm text-gray-400 hover:text-white">← NCTM Management</Link>
          <div className="mt-5 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold tracking-[0.2em] text-pink-400">NCTM AI WORKFORCE</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">AI 역량 관제센터</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-400">역할 정의와 실제 실행 역량을 분리해 표시합니다. 검증 근거 없이 AI를 가동 상태로 표시하지 않습니다.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
              <div className="rounded-2xl border border-gray-700 bg-gray-900 px-5 py-4 text-sm">
                <div className="text-gray-400">검증된 운영 상태</div>
                <div className="mt-1 text-2xl font-bold">{activeCount}명 가동 · {connectedCount}명 연결</div>
              </div>
              <Link href="/ai-workforce/projects" className="rounded-2xl bg-cyan-400 px-5 py-3 text-center text-sm font-bold text-slate-950 hover:bg-cyan-300">사람+AI 공유 프로젝트 룸 →</Link>
              <Link href="/ai-workforce/command" className="rounded-2xl border border-gray-700 px-5 py-3 text-center text-sm font-bold text-white hover:bg-gray-900">승인 관제센터 →</Link>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid gap-3 md:grid-cols-3">
          <Metric label="역할 설계" value={`${NCTM_AGENTS.length}개`} detail="정적 역할 정의" />
          <Metric label="실제 가동" value={`${activeCount}개`} detail="검증 이력이 있는 ACTIVE 단계" />
          <Metric label="P1 대상" value={`${priorityCount}개`} detail="구축 우선순위이며 가동 상태가 아님" />
        </div>

        <div className="mt-8 rounded-3xl border bg-white p-6 shadow-sm">
          <p className="text-xs font-bold tracking-widest text-gray-400">CAPABILITY GATE</p>
          <h2 className="mt-1 text-xl font-bold">증거 기반 승격 경로</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-5">
            {["설계", "데이터 연결", "그림자 실행", "인간 승인", "운영 가동"].map((step, index) => (
              <div key={step} className="rounded-2xl border bg-gray-50 p-4">
                <div className="text-xs font-bold text-pink-600">GATE {index + 1}</div>
                <div className="mt-2 text-sm font-semibold text-gray-800">{step}</div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-gray-500">각 승격은 R5 인간 승인자와 비어 있지 않은 검증 근거가 필요하며, 단계를 건너뛸 수 없습니다.</p>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <div><p className="text-xs font-bold tracking-widest text-gray-400">AGENT DIRECTORY</p><h2 className="mt-1 text-2xl font-bold">AI 역할 목록</h2></div>
          <div className="text-sm text-gray-500">우선순위 ≠ 실행 가능</div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {NCTM_AGENTS.map((agent) => (
            <article key={agent.id} className="flex flex-col rounded-3xl border bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-100 text-xl">{DOMAIN_ICON[agent.domain]}</div><div><h3 className="font-bold text-gray-900">{agent.name}</h3><p className="text-xs text-gray-400">{agent.role}</p></div></div>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${STAGE_STYLE[agent.capabilityStage]}`}>{CAPABILITY_LABEL[agent.capabilityStage]}</span>
              </div>
              <p className="mt-4 min-h-16 text-sm leading-6 text-gray-600">{agent.mission}</p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <DataBox label="INPUT CONTRACT" values={agent.inputs} />
                <DataBox label="OUTPUT CONTRACT" values={agent.outputs} />
              </div>
              <div className="mt-3 rounded-2xl bg-amber-50 p-3 text-xs leading-5 text-amber-900"><span className="font-bold">검증 상태:</span> {agent.evidenceNote}</div>
              <div className="mt-5 flex items-center justify-between border-t pt-4 text-xs"><span className="font-semibold text-gray-500">{agent.domain} 부문</span><span className="rounded-full bg-black px-3 py-1.5 font-bold text-white">우선순위 {agent.priority}</span></div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-3xl border bg-white p-5 shadow-sm"><div className="text-sm font-semibold text-gray-500">{label}</div><div className="mt-2 text-3xl font-bold text-gray-950">{value}</div><div className="mt-1 text-xs text-gray-400">{detail}</div></div>;
}

function DataBox({ label, values }: { label: string; values: string[] }) {
  return <div className="rounded-2xl bg-gray-50 p-3"><div className="font-bold text-gray-400">{label}</div><div className="mt-2 leading-5 text-gray-700">{values.join(" · ")}</div></div>;
}
