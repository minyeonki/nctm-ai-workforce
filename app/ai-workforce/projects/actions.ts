"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NCTM_AGENTS } from "@/lib/agents";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROOM_TYPES = new Set(["STUDENT_CASE", "ASSESSMENT", "OPERATIONS", "GENERAL"]);
const MESSAGE_TYPES = new Set(["COMMENT", "REVIEW", "REWORK_REQUEST"]);
const MODEL = "claude-sonnet-4-20250514";

async function authenticatedClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/ai-workforce/command/login");
  return supabase;
}

export async function createProjectRoom(formData: FormData) {
  const title = formData.get("title");
  const description = formData.get("description");
  const roomType = formData.get("roomType");
  const selectedAgentIds = new Set(formData.getAll("agents").filter((value): value is string => typeof value === "string"));

  if (typeof title !== "string" || title.trim().length < 2 || title.trim().length > 120) throw new Error("프로젝트 이름은 2~120자로 입력해 주세요.");
  if (typeof description !== "string" || description.length > 2000) throw new Error("프로젝트 설명은 2,000자 이하로 입력해 주세요.");
  if (typeof roomType !== "string" || !ROOM_TYPES.has(roomType)) throw new Error("올바른 프로젝트 유형을 선택해 주세요.");

  const agents = NCTM_AGENTS.filter((agent) => selectedAgentIds.has(agent.id)).map((agent) => ({ key: agent.id, name: agent.name }));
  const supabase = await authenticatedClient();
  const { data, error } = await supabase.rpc("create_ai_project_room_v01", {
    p_title: title.trim(), p_description: description.trim(), p_room_type: roomType, p_agents: agents,
  });
  if (error) throw new Error(`프로젝트 룸 생성 실패: ${error.code}`);
  redirect(`/ai-workforce/projects/${data}`);
}

async function runProjectAgent(agentId: string, instruction: string) {
  const agent = NCTM_AGENTS.find((item) => item.id === agentId);
  if (!agent) throw new Error("등록되지 않은 AI 직원입니다.");
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("AI 실행 키가 설정되지 않았습니다.");

  const prompt = `당신은 NCTM 수학학원의 "${agent.name}"입니다.
역할: ${agent.role}
임무: ${agent.mission}
허용 출력: ${agent.outputs.join(", ")}

교직원의 업무지시:
${instruction}

규칙:
- 확인되지 않은 사실을 단정하지 마세요.
- 자료가 부족하면 부족한 항목을 먼저 밝히세요.
- 외부 발송, 데이터 수정, 결제 등 실제 행동을 했다고 표현하지 마세요.
- 결과는 교직원 검토용 초안으로 작성하세요.
- 근거, 판단, 제안 행동을 구분해 한국어로 간결하게 작성하세요.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1800,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(55000),
  });

  if (!response.ok) throw new Error(`AI provider error: ${response.status}`);
  const data = await response.json();
  const result = data.content?.find((item: { type?: string }) => item.type === "text")?.text;
  if (typeof result !== "string" || result.trim().length === 0) throw new Error("AI가 빈 결과를 반환했습니다.");
  return result.trim();
}

export async function postProjectMessage(formData: FormData) {
  const roomId = formData.get("roomId");
  const messageType = formData.get("messageType");
  const body = formData.get("body");
  const agentKey = formData.get("agentKey");

  if (typeof roomId !== "string" || !UUID.test(roomId)) throw new Error("잘못된 프로젝트 룸입니다.");
  if (typeof messageType !== "string") throw new Error("잘못된 메시지 유형입니다.");
  if (typeof body !== "string" || body.trim().length < 1 || body.trim().length > 12000) throw new Error("내용은 1~12,000자로 입력해 주세요.");

  const supabase = await authenticatedClient();

  if (messageType === "TASK_REQUEST") {
    if (typeof agentKey !== "string" || !NCTM_AGENTS.some((agent) => agent.id === agentKey)) throw new Error("담당 AI 직원을 선택해 주세요.");

    const { data, error } = await supabase.rpc("enqueue_ai_project_task_v01", {
      p_room_id: roomId, p_agent_key: agentKey, p_body: body.trim(),
    });
    if (error || !data?.executionId) throw new Error(`AI 업무 접수 실패: ${error?.code ?? "EMPTY_RESPONSE"}`);

    try {
      const result = await runProjectAgent(agentKey, body.trim());
      const { error: completeError } = await supabase.rpc("complete_ai_project_task_v01", {
        p_execution_id: data.executionId, p_result: result, p_model_name: MODEL,
      });
      if (completeError) throw new Error(`결과 저장 실패: ${completeError.code}`);
    } catch (dispatchError) {
      await supabase.rpc("fail_ai_project_task_v01", {
        p_execution_id: data.executionId,
        p_error_message: dispatchError instanceof Error ? dispatchError.message : "AI dispatch failed",
      });
    }
  } else {
    if (!MESSAGE_TYPES.has(messageType)) throw new Error("잘못된 메시지 유형입니다.");
    const { error } = await supabase.rpc("post_ai_project_room_message_v01", {
      p_room_id: roomId, p_message_type: messageType, p_body: body.trim(),
    });
    if (error) throw new Error(`메시지 저장 실패: ${error.code}`);
  }

  revalidatePath("/ai-workforce/projects");
  revalidatePath(`/ai-workforce/projects/${roomId}`);
}
