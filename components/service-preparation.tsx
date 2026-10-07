export function ServicePreparation() {
  return (
    <main className="service-surface mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4 py-8 sm:px-8">
      <header className="mb-8">
        <strong className="text-3xl text-[#6268ba]">직꼿</strong>
      </header>
      <section className="space-y-5 rounded-3xl border bg-white p-6 shadow-sm sm:p-10">
        <p className="text-sm font-semibold text-[#6268ba]">서비스 준비 중</p>
        <h1>잠깐 움직이는 시간을 준비하고 있어요</h1>
        <p>직꼿은 지금 가능한 자세에서 가볍게 시작하는 움직임을 제안합니다.</p>
        <p>
          현재 서비스 연결을 준비하고 있습니다. 준비가 끝나면 회원가입과 루틴
          체험을 이용할 수 있어요.
        </p>
      </section>
      <footer className="py-6 text-center text-xs text-gray-500">
        직꼿은 질환을 진단하거나 치료하는 의료 서비스가 아닙니다.
      </footer>
    </main>
  );
}
