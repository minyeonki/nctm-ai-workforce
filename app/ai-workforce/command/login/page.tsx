import { login } from "@/app/login/actions";

const ERROR_MESSAGE: Record<string, string> = {
  missing_credentials: "이메일과 비밀번호를 모두 입력해 주세요.",
  invalid_credentials: "로그인 정보를 확인해 주세요.",
};

export default async function GovernanceLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-950 px-6">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <p className="text-xs font-bold tracking-[0.2em] text-pink-600">NCTM GOVERNANCE</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-950">원장 인증</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">Command Desk는 Supabase Auth와 Actor Registry가 모두 확인된 사용자만 접근할 수 있습니다.</p>
        {error && ERROR_MESSAGE[error] ? <p role="alert" className="mt-5 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{ERROR_MESSAGE[error]}</p> : null}
        <form action={login} className="mt-6 space-y-4">
          <label className="block text-sm font-semibold text-gray-700">이메일<input name="email" type="email" autoComplete="email" required className="mt-2 w-full rounded-2xl border px-4 py-3 font-normal" /></label>
          <label className="block text-sm font-semibold text-gray-700">비밀번호<input name="password" type="password" autoComplete="current-password" required className="mt-2 w-full rounded-2xl border px-4 py-3 font-normal" /></label>
          <button className="w-full rounded-2xl bg-black px-4 py-3 font-bold text-white hover:bg-gray-800">안전하게 로그인</button>
        </form>
      </section>
    </main>
  );
}
