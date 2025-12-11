// app/dashboard/layout.tsx
import { ReactNode } from "react";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="border-b border-white/10 bg-slate-950 px-4 md:px-6 lg:px-10 py-3 text-sm font-semibold text-slate-200">
        3CX User Manager Dashboard
      </header>

      <main className="w-full">{children}</main>
    </div>
  );
}
