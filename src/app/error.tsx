'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="container empty">
      <h1>Có chút gián đoạn</h1>
      <p>Vui lòng thử lại sau ít phút.</p>
      <button onClick={reset}>Thử lại</button>
    </main>
  );
}
