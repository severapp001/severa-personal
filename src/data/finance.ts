import type { Account, Asset, Category, Debt, Movement } from '@/core/finance';
import { useAuth } from './auth';
import { useRows } from './live';
import { deleteRecord, insertRecord, updateRecord, usePersonalSpace, useRecords } from './records';
import { supabase } from './supabase';

// Finanzas (MD3): cuentas, categorías (de fábrica y propias), movimientos, deudas y bienes.

export function useFinance() {
  const { session } = useAuth();
  const accountId = session?.user.id;
  const space = usePersonalSpace();
  const accounts = useRecords<Account>('fin_accounts', space, 'archived, name');
  const movements = useRecords<Movement & { description: string | null }>('fin_movements', space, 'occurred_on DESC, created_at DESC');
  const debts = useRecords<Debt>('fin_debts', space, 'status, start_date DESC');
  const assets = useRecords<Asset>('fin_assets', space, 'name');
  const { data: categories } = useRows<Category & { sort_order: number }>(
    'SELECT * FROM fin_categories WHERE (space_id IS NULL OR space_id = ?) AND deleted_at IS NULL ORDER BY kind, sort_order, name',
    [space ?? ''],
    () => supabase.from('fin_categories').select('*').is('deleted_at', null).order('sort_order'),
    `fin_categories:${space}`,
  );

  const add = (table: string, values: Record<string, string | number | boolean | null>) => {
    if (!space) throw new Error('Todavía no se carga tu espacio personal. Prueba de nuevo en un momento.');
    return insertRecord(table, space, accountId, values);
  };

  return {
    space,
    accounts,
    movements,
    debts,
    assets,
    categories,
    addMovement: (v: {
      kind: Movement['kind'];
      amount: number;
      occurred_on: string;
      account_id: string | null;
      to_account_id?: string | null;
      category_id?: string | null;
      debt_id?: string | null;
      interest?: number | null;
      description?: string | null;
      is_salary?: boolean;
    }) => add('fin_movements', { ...v, to_account_id: v.to_account_id ?? null, category_id: v.category_id ?? null, debt_id: v.debt_id ?? null, interest: v.interest ?? null, description: v.description ?? null, is_salary: v.is_salary ?? false }),
    addAccount: (v: { name: string; kind: Account['kind']; opening_balance: number; credit_limit?: number | null }) =>
      add('fin_accounts', { ...v, credit_limit: v.credit_limit ?? null, archived: false }),
    addDebt: (v: { kind: string; creditor: string; original_amount: number; installments_total: number; installment_amount: number; start_date: string; account_id?: string | null }) =>
      add('fin_debts', { ...v, account_id: v.account_id ?? null, status: 'active' }),
    addAsset: (v: { kind: string; name: string; value: number }) => add('fin_assets', v),
    markDebtPaid: (id: string) => updateRecord('fin_debts', id, { status: 'paid' }),
    remove: (table: 'fin_movements' | 'fin_accounts' | 'fin_debts' | 'fin_assets', id: string) => deleteRecord(table, id),
  };
}

export type Finance = ReturnType<typeof useFinance>;
