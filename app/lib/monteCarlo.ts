export type RiskProfile = "conservative" | "balanced" | "aggressive";

export interface SimulationInputs {
  currentSavings: number; // starting balance across all goals or per-goal subaccount
  monthlyContribution: number; // constant monthly contribution into the simulated account
  annualReturnMean: number; // e.g., 0.07 for 7%
  annualReturnVol: number; // e.g., 0.12 for 12%
  annualInflation: number; // e.g., 0.03 for 3%
  months: number; // horizon in months
  simulations: number; // number of Monte Carlo paths
  seed?: number; // optional seed for reproducibility
}

export interface GoalDefinition {
  id: string;
  name: string;
  targetAmountToday: number; // target in today's currency
  targetMonth: number; // months from now when the goal should be reached
  priority: number; // 1..5 higher means more important
}

export interface GoalResult {
  goalId: string;
  probability: number; // probability of reaching inflated target by targetMonth
}

export interface PortfolioPercentilesAtHorizon {
  month: number;
  p10: number;
  p50: number;
  p90: number;
}

export interface SimulationSummary {
  probabilities: GoalResult[];
  percentiles: PortfolioPercentilesAtHorizon[]; // selected months including final horizon
}

// Simple deterministic PRNG for repeatability (Mulberry32)
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Box-Muller to convert uniform(0,1) to standard normal
function normal01(random: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = random();
  while (v === 0) v = random();
  const mag = Math.sqrt(-2.0 * Math.log(u));
  const z = mag * Math.cos(2.0 * Math.PI * v);
  return z;
}

export function getPresetForRisk(profile: RiskProfile): { mean: number; vol: number } {
  if (profile === "conservative") return { mean: 0.045, vol: 0.07 };
  if (profile === "aggressive") return { mean: 0.085, vol: 0.18 };
  return { mean: 0.065, vol: 0.12 };
}

export function inflateToFuture(amountToday: number, annualInflation: number, months: number): number {
  const monthlyInfl = Math.pow(1 + annualInflation, 1 / 12) - 1;
  return amountToday * Math.pow(1 + monthlyInfl, months);
}

export function simulateEndingBalances(inputs: SimulationInputs): number[][] {
  const {
    currentSavings,
    monthlyContribution,
    annualReturnMean,
    annualReturnVol,
    months,
    simulations,
    seed,
  } = inputs;

  const dt = 1 / 12;
  const mu = annualReturnMean;
  const sigma = annualReturnVol;
  const random = mulberry32(seed ?? 123456789);

  const balances: number[][] = new Array(simulations);
  for (let s = 0; s < simulations; s++) {
    let balance = currentSavings;
    const path: number[] = new Array(months + 1);
    path[0] = balance;
    for (let m = 1; m <= months; m++) {
      const z = normal01(random);
      const growth = Math.exp((mu - 0.5 * sigma * sigma) * dt + sigma * Math.sqrt(dt) * z);
      balance = Math.max(0, balance * growth + monthlyContribution); // contribution at month end
      path[m] = balance;
    }
    balances[s] = path;
  }
  return balances;
}

export function computeProbabilities(
  goals: GoalDefinition[],
  balances: number[][],
  annualInflation: number,
): GoalResult[] {
  return goals.map((goal) => {
    const required = inflateToFuture(goal.targetAmountToday, annualInflation, goal.targetMonth);
    let success = 0;
    for (let s = 0; s < balances.length; s++) {
      const path = balances[s];
      const valueAt = path[Math.min(goal.targetMonth, path.length - 1)];
      if (valueAt >= required) success++;
    }
    return { goalId: goal.id, probability: success / balances.length };
  });
}

export function computePercentiles(
  balances: number[][],
  monthsToReport: number[],
): PortfolioPercentilesAtHorizon[] {
  const result: PortfolioPercentilesAtHorizon[] = [];
  for (const month of monthsToReport) {
    const values: number[] = new Array(balances.length);
    for (let s = 0; s < balances.length; s++) {
      const path = balances[s];
      values[s] = path[Math.min(month, path.length - 1)];
    }
    values.sort((a, b) => a - b);
    const p = (q: number) => values[Math.max(0, Math.min(values.length - 1, Math.floor(q * (values.length - 1))))];
    result.push({ month, p10: p(0.1), p50: p(0.5), p90: p(0.9) });
  }
  return result;
}

export function runSimulation(
  goals: GoalDefinition[],
  inputs: SimulationInputs,
  monthsForPercentiles: number[]
): SimulationSummary {
  const balances = simulateEndingBalances(inputs);
  const probabilities = computeProbabilities(goals, balances, inputs.annualInflation);
  const percentiles = computePercentiles(balances, monthsForPercentiles);
  return { probabilities, percentiles };
}

// Heuristic optimizer: allocate monthly budget across independent goal subaccounts
export interface OptimizationInputs {
  goals: GoalDefinition[];
  currentSavingsPerGoal: Record<string, number>;
  monthlyBudget: number;
  annualReturnMean: number;
  annualReturnVol: number;
  annualInflation: number;
  simulations: number;
  seed?: number;
  stepSize?: number; // monthly increment granularity for allocation, default 100
  targetSuccess?: number; // if provided, stop allocating once all goals meet this probability
}

export interface OptimizationResult {
  monthlyContributionPerGoal: Record<string, number>;
  probabilities: Record<string, number>;
}

export function optimizeMonthlyContributions(inputs: OptimizationInputs): OptimizationResult {
  const step = Math.max(10, Math.floor((inputs.stepSize ?? 100)));
  const remainingBudget = { value: inputs.monthlyBudget };
  const perGoalContribution: Record<string, number> = {};
  const perGoalProbability: Record<string, number> = {};

  for (const g of inputs.goals) {
    perGoalContribution[g.id] = 0;
    perGoalProbability[g.id] = 0;
  }

  // Precompute horizons
  const maxMonths = Math.max(...inputs.goals.map((g) => g.targetMonth));

  // Helper to evaluate a goal with a given contribution
  const evaluate = (goal: GoalDefinition, contribution: number): number => {
    const sim: SimulationInputs = {
      currentSavings: inputs.currentSavingsPerGoal[goal.id] ?? 0,
      monthlyContribution: contribution,
      annualReturnMean: inputs.annualReturnMean,
      annualReturnVol: inputs.annualReturnVol,
      annualInflation: inputs.annualInflation,
      months: maxMonths,
      simulations: inputs.simulations,
      seed: inputs.seed,
    };
    const balances = simulateEndingBalances(sim);
    const [res] = computeProbabilities([goal], balances, inputs.annualInflation);
    return res.probability;
  };

  // Initialize current probabilities
  for (const goal of inputs.goals) {
    perGoalProbability[goal.id] = evaluate(goal, 0);
  }

  // Greedy allocation by marginal probability increase per currency unit, weighted by priority
  while (remainingBudget.value >= step) {
    let bestGoalId: string | null = null;
    let bestScore = -Infinity;
    for (const goal of inputs.goals) {
      const current = perGoalContribution[goal.id];
      const p0 = perGoalProbability[goal.id];
      const p1 = evaluate(goal, current + step);
      const delta = Math.max(0, p1 - p0);
      const score = (delta / step) * (1 + goal.priority);
      if (score > bestScore) {
        bestScore = score;
        bestGoalId = goal.id;
      }
    }
    if (!bestGoalId || bestScore <= 0) {
      break; // no further improvement
    }
    perGoalContribution[bestGoalId] += step;
    const g = inputs.goals.find((x) => x.id === bestGoalId)!;
    perGoalProbability[bestGoalId] = evaluate(g, perGoalContribution[bestGoalId]);
    remainingBudget.value -= step;

    // Early stop if target success reached for all goals
    if (
      typeof inputs.targetSuccess === "number" &&
      inputs.goals.every((g) => perGoalProbability[g.id] >= (inputs.targetSuccess as number))
    ) {
      break;
    }
  }

  return { monthlyContributionPerGoal: perGoalContribution, probabilities: perGoalProbability };
}


