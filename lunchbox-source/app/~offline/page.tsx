import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="offline-page">
      <div className="offline-card">
        <span aria-hidden="true">🍱</span>
        <p className="kicker">YOU ARE OFFLINE</p>
        <h1>Your lunchbox is still here.</h1>
        <p>Reconnect to view the latest school menu, availability and order status.</p>
        <Link className="primary-button" href="/">Try again</Link>
      </div>
    </main>
  );
}
