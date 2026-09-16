# NCTM AI Workforce

nctm-hub에서 분리한 독립 실행 프로젝트입니다. **저장소와 배포는 분리되어 있지만, Supabase 백엔드(rcsqakeisrpgyiaycwgm)는 nctm-hub와 그대로 공유**합니다.

## 이 저장소가 포함하는 것

- `app/ai-workforce/` — AI 직원 관제센터 화면 (12개 AI 직원 레지스트리, 프로젝트 룸, 커맨드 승인 화면)
- `lib/agents.ts` — AI 직원 정의 (역할, 도메인, 실행 단계)
- `lib/supabase/` — nctm-hub와 동일한 Supabase 클라이언트 설정
- `app/login/actions.ts` — nctm-hub와 동일한 Supabase Auth 로그인/로그아웃
- `supabase/migrations/` — 참고용 마이그레이션 2개 (`ai_shared_project_rooms`, `ai_project_room_dispatcher`).
  **이미 nctm-hub의 프로덕션 Supabase에 적용되어 있으므로, 같은 프로젝트를 계속 쓰는 한 다시 실행할 필요 없습니다.**
  새 Supabase 프로젝트로 완전히 독립시킬 경우에만 이 파일들로 스키마를 재현하세요 (단, `governance.actor` 등 nctm-hub 쪽 다른 스키마에 대한 참조가 있어 별도 조정이 필요합니다).

## 설정 

1. `.env.example`을 `.env.local`로 복사
2. nctm-hub와 동일한 Supabase URL / Publishable Key 입력 (Vercel의 nctm-hub 프로젝트 환경변수에서 그대로 복사 가능)
3. `npm install`
4. `npm run dev`

## nctm-hub와의 관계

- **코드**: 완전히 분리된 별도 저장소/배포
- **데이터**: 같은 Supabase 프로젝트를 공유 (학생/교사/AI 직원 데이터가 끊기지 않음)
- **인증**: 같은 Supabase Auth — nctm-hub 로그인 계정으로 그대로 로그인 가능

## 원래 nctm-hub 쪽 정리

이 저장소로 분리한 뒤에는, nctm-hub의 `app/ai-workforce/`와 `lib/agents.ts`를 제거하고
필요하다면 nctm-hub 홈 화면에서 이 프로젝트의 배포 URL로 링크만 남기는 것을 권장합니다.
