"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Modal from "./ui/Modal";
import Stepper from "./ui/Stepper";
import StatCard from "./ui/StatCard";
import {
  GoalDefinition,
  OptimizationInputs,
  PortfolioPercentilesAtHorizon,
  RiskProfile,
  SimulationInputs,
  getPresetForRisk,
  optimizeMonthlyContributions,
  runSimulation,
} from "../lib/monteCarlo";

interface GoalInputRowProps {
  goal: GoalDefinition;
  onChange: (g: GoalDefinition) => void;
  onRemove: (id: string) => void;
}

function GoalInputRow({ goal, onChange, onRemove }: GoalInputRowProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-end border rounded p-3">
      <div className="flex flex-col gap-1">
        <label className="text-sm">Мақсат атауы</label>
        <input
          value={goal.name}
          onChange={(e) => onChange({ ...goal, name: e.target.value })}
          className="border rounded px-2 py-1"
          placeholder="Пәтер"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm">Сома (бүгінгі бағамен)</label>
        <input
          type="number"
          value={goal.targetAmountToday}
          onChange={(e) => onChange({ ...goal, targetAmountToday: Number(e.target.value || 0) })}
          className="border rounded px-2 py-1"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm">Мерзімі (ай)</label>
        <input
          type="number"
          value={goal.targetMonth}
          onChange={(e) => onChange({ ...goal, targetMonth: Math.max(1, Number(e.target.value || 0)) })}
          className="border rounded px-2 py-1"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm">Басымдық (1–5)</label>
        <input
          type="number"
          value={goal.priority}
          min={1}
          max={5}
          onChange={(e) => onChange({ ...goal, priority: Math.min(5, Math.max(1, Number(e.target.value || 1))) })}
          className="border rounded px-2 py-1"
        />
      </div>
      <div className="flex gap-2">
        <button
          className="border rounded px-3 py-1 hover:bg-[#f2f2f2]"
          onClick={() => onRemove(goal.id)}
        >
          Жою
        </button>
      </div>
    </div>
  );
}

export default function GoalPlanner() {
  const [risk, setRisk] = useState<RiskProfile>("balanced");
  const [annualInflation, setAnnualInflation] = useState(0.05);
  const [currentSavings, setCurrentSavings] = useState(0);
  const [monthlyBudget, setMonthlyBudget] = useState(50000);
  const [simulations, setSimulations] = useState(2000);
  const [goals, setGoals] = useState<GoalDefinition[]>([
    { id: "g1", name: "Пәтер", targetAmountToday: 8000000, targetMonth: 60, priority: 5 },
    { id: "g2", name: "Білім", targetAmountToday: 1500000, targetMonth: 36, priority: 4 },
    { id: "g3", name: "Зейнетақы", targetAmountToday: 20000000, targetMonth: 360, priority: 3 },
  ]);

  const riskPreset = useMemo(() => getPresetForRisk(risk), [risk]);

  const monthsHorizon = useMemo(() => Math.max(...goals.map((g) => g.targetMonth)), [goals]);

  const simulationInputs: SimulationInputs = useMemo(() => ({
    currentSavings,
    monthlyContribution: monthlyBudget,
    annualReturnMean: riskPreset.mean,
    annualReturnVol: riskPreset.vol,
    annualInflation,
    months: monthsHorizon,
    simulations,
  }), [annualInflation, currentSavings, monthlyBudget, monthsHorizon, riskPreset.mean, riskPreset.vol, simulations]);

  const percentilesMonths = useMemo(() => {
    const list: number[] = [];
    for (let m = 12; m <= monthsHorizon; m += Math.max(12, Math.floor(monthsHorizon / 6))) list.push(m);
    if (list[list.length - 1] !== monthsHorizon) list.push(monthsHorizon);
    return list;
  }, [monthsHorizon]);

  const [probabilities, percentiles] = useMemo(() => {
    const { probabilities, percentiles } = runSimulation(goals, simulationInputs, percentilesMonths);
    return [probabilities, percentiles] as [ReturnType<typeof runSimulation>["probabilities"], PortfolioPercentilesAtHorizon[]];
  }, [goals, percentilesMonths, simulationInputs]);

  const [allocation, setAllocation] = useState<Record<string, number> | null>(null);
  const [allocationProb, setAllocationProb] = useState<Record<string, number> | null>(null);
  const [optStep, setOptStep] = useState<number>(Math.max(1000, Math.floor(monthlyBudget / 20)));
  const [targetSuccessPct, setTargetSuccessPct] = useState<number>(80);

  const runOptimization = () => {
    const currentPerGoal: Record<string, number> = {};
    for (const g of goals) currentPerGoal[g.id] = Math.max(0, Math.floor(currentSavings / goals.length));

    const optInputs: OptimizationInputs = {
      goals,
      currentSavingsPerGoal: currentPerGoal,
      monthlyBudget,
      annualReturnMean: riskPreset.mean,
      annualReturnVol: riskPreset.vol,
      annualInflation,
      simulations,
      stepSize: optStep,
      targetSuccess: Math.max(0, Math.min(1, targetSuccessPct / 100)),
    };
    const result = optimizeMonthlyContributions(optInputs);
    setAllocation(result.monthlyContributionPerGoal);
    setAllocationProb(result.probabilities);
  };

  const addGoal = () => {
    const id = Math.random().toString(36).slice(2, 9);
    setGoals((g) => [
      ...g,
      { id, name: "Мақсат", targetAmountToday: 1000000, targetMonth: 24, priority: 3 },
    ]);
  };

  const removeGoal = (id: string) => setGoals((gs) => gs.filter((g) => g.id !== id));

  const [activeTab, setActiveTab] = useState<"setup" | "goals" | "results" | "optimize">("setup");
  const stepIndex = activeTab === "setup" ? 0 : activeTab === "goals" ? 1 : activeTab === "results" ? 2 : 3;
  const [showOptimizeModal, setShowOptimizeModal] = useState(false);

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-6">
      <div className="gradient-bg rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold green-accent">Мақсат жоспарлаушы</h2>
            <p className="text-sm text-[#4b5563] mt-1">Ақ‑жасыл стиль, ыңғайлы қадамдар және жұмсақ анимациялар</p>
          </div>
          <Stepper steps={["Параметрлер", "Мақсаттар", "Нәтижелер", "Оңтайландыру"]} current={stepIndex} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard title="Болжам горизонты" value={`${monthsHorizon} ай`} />
          <StatCard title="Айлық бюджет" value={`${monthlyBudget.toLocaleString()} ₸`} />
          <StatCard title="Симуляциялар" value={`${simulations.toLocaleString()}`} />
        </div>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2 p-4 border rounded">
          <h3 className="font-semibold">Параметры риска</h3>
          <select
            value={risk}
            onChange={(e) => setRisk(e.target.value as RiskProfile)}
            className="border rounded px-2 py-1"
          >
            <option value="conservative">Консервативный</option>
            <option value="balanced">Сбалансированный</option>
            <option value="aggressive">Агрессивный</option>
          </select>
          <label className="text-sm">Инфляция, год</label>
          <input
            type="number"
            value={annualInflation}
            step={0.005}
            onChange={(e) => setAnnualInflation(Number(e.target.value || 0))}
            className="border rounded px-2 py-1"
          />
        </div>
        <div className="flex flex-col gap-2 p-4 border rounded">
          <h3 className="font-semibold">Финансы</h3>
          <label className="text-sm">Текущие накопления</label>
          <input
            type="number"
            value={currentSavings}
            onChange={(e) => setCurrentSavings(Number(e.target.value || 0))}
            className="border rounded px-2 py-1"
          />
          <label className="text-sm">Ежемесячный бюджет</label>
          <input
            type="number"
            value={monthlyBudget}
            onChange={(e) => setMonthlyBudget(Number(e.target.value || 0))}
            className="border rounded px-2 py-1"
          />
          <label className="text-sm">Симуляции</label>
          <input
            type="number"
            value={simulations}
            onChange={(e) => setSimulations(Math.max(200, Number(e.target.value || 0)))}
            className="border rounded px-2 py-1"
          />
        </div>
      </section>
      <AnimatePresence mode="wait">
        {activeTab === "setup" && (
          <motion.section
            key="setup"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className="glass-card flex flex-col gap-3 p-5 rounded-2xl"
          >
            <div className="text-sm text-[#065f46]">Тәуекел мен қаржы параметрлерін баптаңыз</div>
            <div className="divider" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm">Тәуекел профилі</label>
                <select value={risk} onChange={(e) => setRisk(e.target.value as RiskProfile)} className="border rounded px-2 py-2">
                  <option value="conservative">Консервативті</option>
                  <option value="balanced">Теңгерімді</option>
                  <option value="aggressive">Агрессивті</option>
                </select>
                <label className="text-sm">Жылдық инфляция</label>
                <input type="number" value={annualInflation} step={0.005} onChange={(e) => setAnnualInflation(Number(e.target.value || 0))} className="border rounded px-2 py-2" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm">Ағымдағы жинақ</label>
                <input type="number" value={currentSavings} onChange={(e) => setCurrentSavings(Number(e.target.value || 0))} className="border rounded px-2 py-2" />
                <label className="text-sm">Айлық бюджет</label>
                <input type="number" value={monthlyBudget} onChange={(e) => setMonthlyBudget(Number(e.target.value || 0))} className="border rounded px-2 py-2" />
                <label className="text-sm">Симуляциялар саны</label>
                <input type="number" value={simulations} onChange={(e) => setSimulations(Math.max(200, Number(e.target.value || 0)))} className="border rounded px-2 py-2" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button className="button-primary rounded-lg px-4 py-2" onClick={() => setActiveTab("goals")}>Келесі →</button>
            </div>
          </motion.section>
        )}

        {activeTab === "goals" && (
          <motion.section
            key="goals"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="glass-card flex flex-col gap-4 p-5 rounded-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Мақсаттар</h3>
              <button className="button-primary rounded-lg px-4 py-2" onClick={addGoal}>➕ Мақсат қосу</button>
            </div>
            <div className="flex flex-col gap-3">
              {goals.map((g) => (
                <motion.div key={g.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                  <GoalInputRow
                    goal={g}
                    onChange={(ng) => setGoals((gs) => gs.map((x) => (x.id === ng.id ? ng : x)))}
                    onRemove={removeGoal}
                  />
                </motion.div>
              ))}
            </div>
            <div className="flex gap-2 justify-between">
              <button className="button-secondary rounded-lg px-4 py-2" onClick={() => setActiveTab("setup")}>← Артқа</button>
              <button className="button-primary rounded-lg px-4 py-2" onClick={() => setActiveTab("results")}>Есептеу</button>
            </div>
          </motion.section>
        )}

        {activeTab === "results" && (
          <motion.section
            key="results"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="glass-card flex flex-col gap-3 p-5 rounded-2xl"
          >
            <h3 className="font-semibold">Мақсаттарға жету ықтималдығы</h3>
            <ul className="flex flex-col gap-2">
              {probabilities.map((p) => {
                const g = goals.find((x) => x.id === p.goalId)!;
                return (
                  <li key={p.goalId} className="flex items-center justify-between border rounded-lg px-3 py-2">
                    <span>{g.name} (шамамен {g.targetMonth} ай)</span>
                    <span className="green-accent font-semibold">{Math.round(p.probability * 100)}%</span>
                  </li>
                );
              })}
            </ul>
            <div className="divider" />
            <h3 className="font-semibold">Портфель болжамы (перцентильдер)</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full border rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-[#f7fdfa]">
                    <th className="text-left p-2 border">Ай</th>
                    <th className="text-left p-2 border">P10</th>
                    <th className="text-left p-2 border">P50</th>
                    <th className="text-left p-2 border">P90</th>
                  </tr>
                </thead>
                <tbody>
                  {percentiles.map((row) => (
                    <tr key={row.month} className="hover:bg-[#f8fffb] transition-colors">
                      <td className="p-2 border">{row.month}</td>
                      <td className="p-2 border">{Math.round(row.p10).toLocaleString()}</td>
                      <td className="p-2 border">{Math.round(row.p50).toLocaleString()}</td>
                      <td className="p-2 border">{Math.round(row.p90).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 justify-between">
              <button className="button-secondary rounded-lg px-4 py-2" onClick={() => setActiveTab("goals")}>← Артқа</button>
              <button className="button-primary rounded-lg px-4 py-2" onClick={() => setShowOptimizeModal(true)}>Оңтайландыру</button>
            </div>
          </motion.section>
        )}

        {activeTab === "optimize" && (
          <motion.section
            key="optimize"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="glass-card flex flex-col gap-3 p-5 rounded-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Айлық жарналарды оңтайландыру</h3>
              <div className="flex gap-2">
                <button className="button-secondary rounded-lg px-4 py-2" onClick={() => setShowOptimizeModal(true)}>Параметрлер</button>
                <button className="button-primary rounded-lg px-4 py-2" onClick={runOptimization}>Есептеу</button>
              </div>
            </div>
            {allocation && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {goals.map((g) => (
                  <motion.div key={g.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between border rounded-xl px-4 py-3">
                    <span>{g.name}</span>
                    <span>
                      {allocation[g.id]?.toLocaleString(undefined, { maximumFractionDigits: 0 })} ₸ / ай
                      {allocationProb && (
                        <span className="text-sm text-[#666]"> — {Math.round((allocationProb[g.id] ?? 0) * 100)}%</span>
                      )}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
            <div className="flex gap-2 justify-start">
              <button className="button-secondary rounded-lg px-4 py-2" onClick={() => setActiveTab("results")}>← Артқа</button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
      <Modal open={showOptimizeModal} title="Оңтайландыру параметрлері" onClose={() => setShowOptimizeModal(false)}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm">Қадам өлшемі (₸)</label>
            <input
              type="number"
              className="border rounded px-2 py-2"
              value={optStep}
              onChange={(e) => setOptStep(Math.max(100, Number(e.target.value || 0)))}
            />
            <span className="text-xs text-gray-500">Есеп жылдамдығы мен дәлдігін теңгеру</span>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm">Мақсатты ықтималдық (%)</label>
            <input
              type="number"
              className="border rounded px-2 py-2"
              value={targetSuccessPct}
              onChange={(e) => setTargetSuccessPct(Math.max(1, Math.min(99, Number(e.target.value || 0))))}
            />
            <span className="text-xs text-gray-500">Барлығы осы шектен асса — ерте тоқтату</span>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-3">
          <button className="button-secondary rounded-lg px-4 py-2" onClick={() => setShowOptimizeModal(false)}>Жабу</button>
          <button className="button-primary rounded-lg px-4 py-2" onClick={() => { setShowOptimizeModal(false); runOptimization(); }}>Есептеу</button>
        </div>
      </Modal>
    </div>
  );
}


