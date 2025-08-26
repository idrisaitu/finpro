"use client";

import { motion } from "framer-motion";

interface StepperProps {
  steps: string[];
  current: number; // 0-based
}

export default function Stepper({ steps, current }: StepperProps) {
  return (
    <div className="flex items-center gap-3 overflow-x-auto">
      {steps.map((label, i) => {
        const active = i === current;
        const done = i < current;
        return (
          <div key={i} className="flex items-center gap-3">
            <div className={`relative flex items-center gap-2 px-3 py-2 rounded-xl ${active ? "tab-active" : done ? "tab-inactive" : "tab-inactive"}`}>
              <motion.div layoutId="step-dot" className={`h-2.5 w-2.5 rounded-full ${active ? "bg-emerald-600" : done ? "bg-emerald-300" : "bg-gray-300"}`} />
              <span className={`text-sm ${active ? "text-emerald-800" : "text-gray-600"}`}>{label}</span>
            </div>
            {i < steps.length - 1 && <div className="w-6 h-[1px] bg-emerald-200" />}
          </div>
        );
      })}
    </div>
  );
}


