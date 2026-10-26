// Finanzas (F09, MD3): el usuario registra movimientos y Severa calcula los informes.
// Estado de resultados, balance general y flujo de caja salen de los movimientos; no se guardan.
// Dominio puro: sin React ni base de datos. Los meses son de calendario («AAAA-MM»).

export type MovementKind = 'expense' | 'income' | 'transfer' | 'debt_payment' | 'adjustment';
export type AccountKind = 'cash' | 'debit' | 'checking' | 'savings' | 'investment' | 'credit_card' | 'business';

export type Movement = {
  id: string;
  kind: MovementKind;
  occurred_on: string;
  amount: number;
  account_id: string | null;
  to_account_id: string | null;
  category_id: string | null;
  debt_id: string | null;
  interest: number | null;
  description?: string | null;
  person_id?: string | null;
  is_salary?: number | boolean | null;
};
export type Account = { id: string; name: string; kind: AccountKind; opening_balance: number; credit_limit?: number | null; archived?: number | boolean | null };
export type Debt = {
  id: string;
  kind: string;
  creditor: string;
  original_amount: number;
  installments_total: number;
  installment_amount: number;
  start_date: string;
  status: string;
};
export type Asset = { id: string; kind: string; name: string; value: number };
export type Category = { id: string; name: string; kind: 'expense' | 'income'; icon?: string | null; for_work?: number | boolean | null };

export const monthOf = (date: string) => date.slice(0, 7);
export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** Los últimos `n` meses hasta `today`, del más antiguo al actual. */
export function lastMonths(today: Date, n: number): string[] {
  return Array.from({ length: n }, (_, i) => monthKey(new Date(today.getFullYear(), today.getMonth() - (n - 1 - i), 1)));
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const monthName = (key: string) => MONTHS[Number(key.slice(5, 7)) - 1] ?? key;

// ─── Saldos ──────────────────────────────────────────────────────────────────

/** Saldo de una cuenta: el inicial más lo que entró menos lo que salió. En una tarjeta, negativo = lo que se debe. */
export function accountBalance(account: Account, movements: Movement[]): number {
  let balance = Number(account.opening_balance) || 0;
  for (const m of movements) {
    const a = Number(m.amount);
    if (m.account_id === account.id) {
      // Ingreso y ajuste suman; gasto, transferencia y pago de deuda restan.
      balance += m.kind === 'income' || m.kind === 'adjustment' ? a : -a;
    }
    if (m.kind === 'transfer' && m.to_account_id === account.id) balance += a;
  }
  return balance;
}

// ─── Deudas ──────────────────────────────────────────────────────────────────

export type DebtStatus = {
  paid: number;
  remaining: number;
  remainingAmount: number;
  nextDue: string | null;
  progress: number;
};

const addMonths = (date: string, n: number) => {
  const [y, m, d] = date.split('-').map(Number);
  const last = new Date(y, m - 1 + n + 1, 0).getDate();
  const r = new Date(y, m - 1 + n, Math.min(d, last));
  return `${r.getFullYear()}-${String(r.getMonth() + 1).padStart(2, '0')}-${String(r.getDate()).padStart(2, '0')}`;
};

/** Cuotas pagadas, las que faltan, cuánto queda y cuándo vence la próxima. */
export function debtStatus(debt: Debt, movements: Movement[]): DebtStatus {
  const total = Number(debt.installments_total) || 1;
  const paid = Math.min(total, movements.filter((m) => m.kind === 'debt_payment' && m.debt_id === debt.id).length);
  const remaining = total - paid;
  return {
    paid,
    remaining,
    remainingAmount: remaining * Number(debt.installment_amount),
    nextDue: remaining > 0 ? addMonths(debt.start_date, paid + 1) : null,
    progress: paid / total,
  };
}

// ─── Estado de resultados ────────────────────────────────────────────────────

export type CategoryTotal = { id: string | null; name: string; total: number };
export type IncomeStatement = {
  month: string;
  income: number;
  expenses: number;
  interest: number;
  result: number;
  incomeByCategory: CategoryTotal[];
  expensesByCategory: CategoryTotal[];
};

function byCategory(list: Movement[], names: Map<string, string>, fallback: string): CategoryTotal[] {
  const totals = new Map<string | null, number>();
  for (const m of list) totals.set(m.category_id, (totals.get(m.category_id) ?? 0) + Number(m.amount));
  return [...totals.entries()]
    .map(([id, total]) => ({ id, name: (id && names.get(id)) || fallback, total }))
    .sort((a, b) => b.total - a.total);
}

/** Lo que se ganó y se gastó en el mes. Las transferencias no cuentan; de un pago de deuda, solo los intereses. */
export function incomeStatement(movements: Movement[], categories: Category[], month: string): IncomeStatement {
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const inMonth = movements.filter((m) => monthOf(m.occurred_on) === month);
  const incomes = inMonth.filter((m) => m.kind === 'income');
  const expenses = inMonth.filter((m) => m.kind === 'expense');
  const interest = inMonth.filter((m) => m.kind === 'debt_payment').reduce((s, m) => s + (Number(m.interest) || 0), 0);
  const income = incomes.reduce((s, m) => s + Number(m.amount), 0);
  const spent = expenses.reduce((s, m) => s + Number(m.amount), 0) + interest;
  const expensesByCategory = byCategory(expenses, names, 'Sin categoría');
  if (interest) expensesByCategory.push({ id: null, name: 'Intereses de deudas', total: interest });
  return {
    month,
    income,
    expenses: spent,
    interest,
    result: income - spent,
    incomeByCategory: byCategory(incomes, names, 'Sin categoría'),
    expensesByCategory: expensesByCategory.sort((a, b) => b.total - a.total),
  };
}

// ─── Balance general ─────────────────────────────────────────────────────────

export type BalanceLine = { name: string; amount: number };
export type BalanceSheet = { assets: BalanceLine[]; liabilities: BalanceLine[]; totalAssets: number; totalLiabilities: number; netWorth: number };

/** Lo que tengo (cuentas con saldo y bienes) menos lo que debo (tarjetas y deudas). */
export function balanceSheet(accounts: Account[], movements: Movement[], debts: Debt[], assets: Asset[]): BalanceSheet {
  const assetLines: BalanceLine[] = [];
  const liabilityLines: BalanceLine[] = [];
  for (const a of accounts) {
    const b = accountBalance(a, movements);
    if (a.kind === 'credit_card') {
      if (b < 0) liabilityLines.push({ name: a.name, amount: -b });
    } else if (b > 0) assetLines.push({ name: a.name, amount: b });
    else if (b < 0) liabilityLines.push({ name: `${a.name} (sobregiro)`, amount: -b });
  }
  for (const x of assets) assetLines.push({ name: x.name, amount: Number(x.value) });
  for (const d of debts) {
    if (d.status === 'paid') continue;
    const s = debtStatus(d, movements);
    if (s.remainingAmount > 0) liabilityLines.push({ name: d.creditor, amount: s.remainingAmount });
  }
  const totalAssets = assetLines.reduce((s, l) => s + l.amount, 0);
  const totalLiabilities = liabilityLines.reduce((s, l) => s + l.amount, 0);
  return { assets: assetLines, liabilities: liabilityLines, totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities };
}

// ─── Flujo de caja ───────────────────────────────────────────────────────────

export type CashFlowMonth = { month: string; inflow: number; outflow: number; net: number; cumulative: number };

/**
 * La plata que entró y salió de verdad, mes a mes. Un gasto con tarjeta sale el día que se paga
 * la tarjeta (transferencia hacia ella); los pagos de deuda salen completos.
 */
export function cashFlow(movements: Movement[], accounts: Account[], months: string[]): CashFlowMonth[] {
  const card = new Set(accounts.filter((a) => a.kind === 'credit_card').map((a) => a.id));
  let cumulative = 0;
  return months.map((month) => {
    let inflow = 0;
    let outflow = 0;
    for (const m of movements) {
      if (monthOf(m.occurred_on) !== month) continue;
      const a = Number(m.amount);
      if (m.kind === 'income') inflow += a;
      else if (m.kind === 'expense' && !(m.account_id && card.has(m.account_id))) outflow += a;
      else if (m.kind === 'debt_payment') outflow += a;
      else if (m.kind === 'transfer' && m.to_account_id && card.has(m.to_account_id) && !(m.account_id && card.has(m.account_id))) outflow += a;
    }
    cumulative += inflow - outflow;
    return { month, inflow, outflow, net: inflow - outflow, cumulative };
  });
}

// ─── Consejos (como la «retroalimentación financiera» de la primera versión) ──

export function advice(current: IncomeStatement, previous: IncomeStatement | null): string[] {
  const tips: string[] = [];
  if (!current.income && !current.expenses) return ['Registra tus primeros movimientos del mes y aquí verás cómo vas.'];
  if (current.income && current.result < 0) tips.push('Este mes gastaste más de lo que ganaste. Revisa la categoría más grande.');
  if (current.income && current.result >= 0) {
    const rate = Math.round((current.result / current.income) * 100);
    tips.push(rate >= 20 ? `Vas ahorrando el ${rate} % de tus ingresos. ¡Bien!` : `Te queda el ${rate} % de tus ingresos. La meta sana es el 20 %.`);
  }
  const top = current.expensesByCategory[0];
  if (top && current.expenses) tips.push(`${top.name} es tu mayor gasto: ${Math.round((top.total / current.expenses) * 100)} % del total.`);
  if (previous && previous.expenses && current.expenses) {
    const diff = Math.round(((current.expenses - previous.expenses) / previous.expenses) * 100);
    if (Math.abs(diff) >= 10) tips.push(diff > 0 ? `Gastaste ${diff} % más que el mes pasado.` : `Gastaste ${-diff} % menos que el mes pasado.`);
  }
  if (current.interest) tips.push('Pagaste intereses: adelantar cuotas o pagar la tarjeta completa los reduce.');
  return tips;
}
