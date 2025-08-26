"use client";

import { ReactNode } from "react";

export default function StatCard({ title, value, icon }: { title: string; value: ReactNode; icon?: ReactNode }) {
  return (
    <div className="glass-card rounded-2xl p-4 flex items-center justify-between">
      <div>
        <div className="text-xs text-emerald-800/80">{title}</div>
        <div className="text-xl font-semibold mt-1">{value}</div>
      </div>
      {icon && <div className="text-emerald-700/80">{icon}</div>}
    </div>
  );
}


