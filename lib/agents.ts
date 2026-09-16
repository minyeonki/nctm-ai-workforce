export type CapabilityStage =
  | "DESIGN_ONLY"
  | "DATA_CONNECTED"
  | "SHADOW"
  | "APPROVAL_GATED"
  | "ACTIVE"
  | "SUSPENDED";

export type NctmAgent = {
  id: string;
  name: string;
  role: string;
  domain: "교육" | "운영" | "경영" | "콘텐츠" | "개발";
  mission: string;
  inputs: string[];
  outputs: string[];
  capabilityStage: CapabilityStage;
  evidenceNote: string;
  priority: 1 | 2 | 3;
};

const DESIGN_ONLY = "DESIGN_ONLY" satisfies CapabilityStage;
const NO_RUNTIME = "실행 런타임과 검증 이력이 연결되지 않았습니다.";

export const NCTM_AGENTS: readonly NctmAgent[] = [
  { id: "director", name: "원장 AI", role: "AI Chief of Staff", domain: "경영", mission: "학원 전체 데이터를 요약하고 오늘의 우선순위와 의사결정안을 제시합니다.", inputs: ["출결", "학습기록", "상담", "수납", "교사일지"], outputs: ["일일 브리핑", "긴급 알림", "실행 우선순위"], capabilityStage: DESIGN_ONLY, evidenceNote: NO_RUNTIME, priority: 1 },
  { id: "student-risk", name: "학생 위험도 AI", role: "Student Success Analyst", domain: "교육", mission: "결석, 과제 미제출, 성취도 저하 신호를 근거와 함께 탐지합니다.", inputs: ["출결", "오답", "숙제", "상담이력"], outputs: ["위험 신호", "근거", "개입 권고"], capabilityStage: DESIGN_ONLY, evidenceNote: NO_RUNTIME, priority: 1 },
  { id: "wrong-answer", name: "오답 분석 AI", role: "Learning Diagnostic Agent", domain: "교육", mission: "문항별 오답 원인 후보를 분류하고 교사 검토용 근거를 제시합니다.", inputs: ["문항", "학생답", "풀이사진", "개념태그"], outputs: ["오답 원인 후보", "근거", "재학습 제안"], capabilityStage: DESIGN_ONLY, evidenceNote: NO_RUNTIME, priority: 1 },
  { id: "problem-qa", name: "문제 검수 AI", role: "Assessment QA Agent", domain: "교육", mission: "문제의 정답, 조건, 난이도, 중복 여부를 검수합니다.", inputs: ["문제", "정답", "해설", "문제DB"], outputs: ["검수 결과", "오류 경고", "수정안"], capabilityStage: DESIGN_ONLY, evidenceNote: NO_RUNTIME, priority: 1 },
  { id: "parent-report", name: "학부모 리포트 AI", role: "Parent Communication Agent", domain: "운영", mission: "확인된 학습 사실을 학부모용 리포트 초안으로 변환합니다.", inputs: ["출결", "성취도", "교사일지", "오답분석"], outputs: ["주간 리포트 초안", "상담 요약", "가정 지도 포인트"], capabilityStage: DESIGN_ONLY, evidenceNote: NO_RUNTIME, priority: 1 },
  { id: "consulting", name: "상담 전략 AI", role: "CRM Strategy Agent", domain: "운영", mission: "상담 기록을 분석해 다음 질문과 제안안을 만듭니다.", inputs: ["상담메모", "학생정보", "수강이력"], outputs: ["상담 전략", "질문 목록", "후속조치"], capabilityStage: DESIGN_ONLY, evidenceNote: NO_RUNTIME, priority: 2 },
  { id: "attendance", name: "출결 대응 AI", role: "Attendance Operations Agent", domain: "운영", mission: "결석·지각 발생 시 확인 대상과 안내 초안을 정리합니다.", inputs: ["출결", "시간표", "연락이력"], outputs: ["확인 목록", "안내 초안", "반복 결석 신호"], capabilityStage: DESIGN_ONLY, evidenceNote: NO_RUNTIME, priority: 2 },
  { id: "finance", name: "수납·재무 AI", role: "Academy Finance Agent", domain: "경영", mission: "수강료 납부 현황과 현금흐름 확인 항목을 정리합니다.", inputs: ["청구", "납부", "할인", "환불"], outputs: ["미납 확인 목록", "월별 요약", "확인 필요 거래"], capabilityStage: DESIGN_ONLY, evidenceNote: NO_RUNTIME, priority: 2 },
  { id: "hr", name: "인사·채용 AI", role: "People Operations Agent", domain: "경영", mission: "지원자와 교직원 정보를 구조화하고 확인 질문을 제시합니다.", inputs: ["지원서", "경력", "근무조건", "평가기준"], outputs: ["평가 근거", "면접 질문", "리스크 요약"], capabilityStage: DESIGN_ONLY, evidenceNote: NO_RUNTIME, priority: 2 },
  { id: "content", name: "콘텐츠 제작 AI", role: "Content Studio Agent", domain: "콘텐츠", mission: "확인된 학원 소식과 교육 정보를 채널별 초안으로 변환합니다.", inputs: ["주제", "학원일정", "검증된 성과자료"], outputs: ["블로그 초안", "카드뉴스 문구", "홍보 일정"], capabilityStage: DESIGN_ONLY, evidenceNote: NO_RUNTIME, priority: 3 },
  { id: "developer", name: "개발 AI", role: "Software Engineering Agent", domain: "개발", mission: "NCTM OS 기능을 설계하고 구현 작업을 검증 가능한 단위로 분해합니다.", inputs: ["기능요청", "코드", "DB스키마"], outputs: ["구현계획", "코드 변경", "테스트 항목"], capabilityStage: DESIGN_ONLY, evidenceNote: NO_RUNTIME, priority: 1 },
  { id: "qa", name: "QA AI", role: "Software QA Agent", domain: "개발", mission: "기능의 오류, 누락, 권한 문제와 회귀 위험을 점검합니다.", inputs: ["요구사항", "코드 변경", "테스트 결과"], outputs: ["테스트 시나리오", "버그 리포트", "배포 판정"], capabilityStage: DESIGN_ONLY, evidenceNote: NO_RUNTIME, priority: 1 },
];

export const CAPABILITY_LABEL: Record<CapabilityStage, string> = {
  DESIGN_ONLY: "설계만 존재",
  DATA_CONNECTED: "데이터 연결",
  SHADOW: "그림자 실행",
  APPROVAL_GATED: "승인 기반",
  ACTIVE: "운영 가동",
  SUSPENDED: "중지",
};

export const EXECUTABLE_STAGES = new Set<CapabilityStage>([
  "SHADOW",
  "APPROVAL_GATED",
  "ACTIVE",
]);
