import Link from "next/link";
import { ResetButton } from "./_components/ResetButton";

export const metadata = { title: "FoodNow Ops" };

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-line bg-surface/95 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-4">
          <Link href="/ops" className="text-xl font-extrabold tracking-tight text-ink">
            Food<span className="text-brand">Now</span> <span className="font-semibold text-muted">Ops</span>
          </Link>
          <span className="text-sm text-muted">You play the restaurant, the rider and the payment provider.</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/" target="_blank" className="rounded-chip px-3 py-2 text-sm font-semibold text-ink hover:bg-fill">
            Open customer app ↗
          </Link>
          <ResetButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1800px] px-6 py-5">{children}</main>
    </div>
  );
}
