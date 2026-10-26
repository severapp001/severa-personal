import { describe, expect, it } from '@jest/globals';

import {
  accountBalance,
  advice,
  balanceSheet,
  cashFlow,
  debtStatus,
  incomeStatement,
  lastMonths,
  type Account,
  type Category,
  type Debt,
  type Movement,
} from '../finance';

const debit: Account = { id: 'deb', name: 'Cuenta RUT', kind: 'debit', opening_balance: 100000 };
const card: Account = { id: 'tc', name: 'Tarjeta', kind: 'credit_card', opening_balance: 0 };
const cats: Category[] = [
  { id: 'food', name: 'Alimentación', kind: 'expense' },
  { id: 'fuel', name: 'Bencina', kind: 'expense' },
  { id: 'salary', name: 'Sueldo', kind: 'income' },
];
const debt: Debt = {
  id: 'd1',
  kind: 'consumer',
  creditor: 'Banco',
  original_amount: 600000,
  installments_total: 6,
  installment_amount: 110000,
  start_date: '2026-08-10',
  status: 'active',
};

let n = 0;
const mv = (m: Partial<Movement>): Movement => ({
  id: `m${++n}`,
  kind: 'expense',
  occurred_on: '2026-10-05',
  amount: 0,
  account_id: 'deb',
  to_account_id: null,
  category_id: null,
  debt_id: null,
  interest: null,
  ...m,
});

const movements: Movement[] = [
  mv({ kind: 'income', amount: 900000, category_id: 'salary', occurred_on: '2026-10-01' }),
  mv({ kind: 'expense', amount: 50000, category_id: 'food' }),
  mv({ kind: 'expense', amount: 30000, category_id: 'fuel', account_id: 'tc' }),
  mv({ kind: 'transfer', amount: 20000, to_account_id: 'tc', occurred_on: '2026-10-20' }),
  mv({ kind: 'debt_payment', amount: 110000, debt_id: 'd1', interest: 10000, occurred_on: '2026-09-10' }),
  mv({ kind: 'debt_payment', amount: 110000, debt_id: 'd1', interest: 9000, occurred_on: '2026-10-10' }),
  mv({ kind: 'expense', amount: 40000, category_id: 'food', occurred_on: '2026-09-15' }),
];

describe('accountBalance', () => {
  it('suma ingresos y transferencias que entran; resta gastos, transferencias y pagos', () => {
    // 100.000 + 900.000 − 50.000 − 20.000 − 110.000 − 110.000 − 40.000
    expect(accountBalance(debit, movements)).toBe(670000);
  });
  it('en la tarjeta, lo gastado queda como deuda y el pago la baja', () => {
    expect(accountBalance(card, movements)).toBe(-10000);
  });
});

describe('debtStatus', () => {
  it('cuenta las cuotas pagadas, lo que queda y la próxima fecha', () => {
    expect(debtStatus(debt, movements)).toEqual({ paid: 2, remaining: 4, remainingAmount: 440000, nextDue: '2026-11-10', progress: 2 / 6 });
  });
});

describe('incomeStatement', () => {
  it('ingresos, gastos (con intereses, sin transferencias ni capital) y resultado del mes', () => {
    const s = incomeStatement(movements, cats, '2026-10');
    expect(s.income).toBe(900000);
    expect(s.expenses).toBe(50000 + 30000 + 9000);
    expect(s.result).toBe(900000 - 89000);
    expect(s.expensesByCategory.map((c) => c.name)).toEqual(['Alimentación', 'Bencina', 'Intereses de deudas']);
  });
});

describe('balanceSheet', () => {
  it('activos menos pasivos: cuentas, bienes, tarjeta y deuda pendiente', () => {
    const b = balanceSheet([debit, card], movements, [debt], [{ id: 'a', kind: 'vehicle', name: 'Auto', value: 5000000 }]);
    expect(b.totalAssets).toBe(670000 + 5000000);
    expect(b.totalLiabilities).toBe(10000 + 440000);
    expect(b.netWorth).toBe(5670000 - 450000);
  });
});

describe('cashFlow', () => {
  it('el gasto con tarjeta no sale hasta que se paga la tarjeta; el pago de deuda sale completo', () => {
    const [sep, oct] = cashFlow(movements, [debit, card], ['2026-09', '2026-10']);
    expect(sep).toEqual({ month: '2026-09', inflow: 0, outflow: 150000, net: -150000, cumulative: -150000 });
    expect(oct.outflow).toBe(50000 + 20000 + 110000);
    expect(oct.cumulative).toBe(-150000 + 900000 - 180000);
  });
});

describe('advice y meses', () => {
  it('da consejos en palabras simples', () => {
    const oct = incomeStatement(movements, cats, '2026-10');
    const sep = incomeStatement(movements, cats, '2026-09');
    const tips = advice(oct, sep);
    expect(tips[0]).toMatch(/ahorrando el 90 %/);
    expect(tips.some((t) => t.startsWith('Alimentación es tu mayor gasto'))).toBe(true);
    expect(advice(incomeStatement([], cats, '2026-11'), null)[0]).toMatch(/Registra/);
  });
  it('los últimos meses, del más antiguo al actual', () => {
    expect(lastMonths(new Date(2026, 1, 10), 3)).toEqual(['2025-12', '2026-01', '2026-02']);
  });
});
