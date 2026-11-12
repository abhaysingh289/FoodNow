import Link from "next/link";
import { ResetButton } from "./_components/ResetButton";

export const metadata = { title: "FoodNow Ops" };

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="flex items-center justify-between gap-4 border-b border-line bg-surface px-6 py-3">
        <div className="flex items-center gap-4">
          <Link href="/ops" className="font-display text-xl font-bold text-brand">
            FoodNow Ops
          </Link>
          <span className="text-sm text-muted">You play the restaurant, the rider and the payment provider.</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/" target="_blank" className="text-sm font-semibold text-brand hover:underline">
            Open customer app ↗
          </Link>
          <ResetButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1800px] px-6 py-5">{children}</main>
    </div>
  );
}
