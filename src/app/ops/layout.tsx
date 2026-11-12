import Link from "next/link";
import { ViewToggle } from "@/components/view/ViewToggle";
import { ResetButton } from "./_components/ResetButton";

export const metadata = { title: "FoodNow Ops" };

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur md:px-6">
        <div className="flex items-center gap-4">
          <Link href="/ops" className="text-xl font-extrabold tracking-tight text-ink">
            Food<span className="text-brand">Now</span> <span className="font-semibold text-muted">Ops</span>
          </Link>
          <span className="hidden text-sm text-muted lg:inline">You play the restaurant, the rider and the payment provider.</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <div className="hidden md:block">
            <ViewToggle />
          </div>
          <Link href="/" target="_blank" className="rounded-chip px-3 py-2 text-sm font-semibold text-ink hover:bg-fill">
            Open customer app ↗
          </Link>
          <ResetButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1800px] px-4 py-5 md:px-6">{children}</main>
    </div>
  );
}
