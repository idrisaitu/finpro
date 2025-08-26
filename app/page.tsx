import GoalPlanner from "./components/GoalPlanner";

export default function Home() {
  return (
    <div className="min-h-screen p-0 sm:p-0 gradient-bg">
      <main className="flex flex-col gap-6 p-6 sm:p-10">
        <div className="glass-card rounded-2xl p-6">
          <h1 className="text-2xl font-semibold green-accent">Жеке қаржылық жоспар</h1>
          <p className="text-sm text-[#4b5563] mt-1">Монте‑Карло модельдеу, жарналарды оңтайландыру және мақсаттарға жету ықтималдығы</p>
        </div>
        <GoalPlanner />
      </main>
    </div>
  );
}
