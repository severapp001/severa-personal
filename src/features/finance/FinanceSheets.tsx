import { useState } from 'react';

import type { AccountKind } from '@/core/finance';
import { formatCLP } from '@/core/money';
import type { Finance } from '@/data/finance';
import { authErrorMessage } from '@/features/account/authErrors';
import { Button, Notice } from '@/ui';
import { tap } from '@/ui/haptics';
import { AmountField, Chips, DateField, Field, Sheet, todayIso } from '@/ui/kit';

// Hojas para agregar cuentas, deudas y bienes (MD3).

export const ACCOUNT_KINDS: { value: AccountKind; label: string }[] = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'debit', label: 'Cuenta vista o RUT' },
  { value: 'checking', label: 'Cuenta corriente' },
  { value: 'savings', label: 'Ahorro' },
  { value: 'investment', label: 'Inversión' },
  { value: 'credit_card', label: 'Tarjeta de crédito' },
];

function useSave(onDone: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      tap();
      onDone();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

export function AccountSheet({ f, visible, onClose }: { f: Finance; visible: boolean; onClose: () => void }) {
  const [kind, setKind] = useState<AccountKind>('debit');
  const [name, setName] = useState('');
  const [balance, setBalance] = useState(0);
  const [limit, setLimit] = useState(0);
  const s = useSave(() => {
    setName('');
    setBalance(0);
    setLimit(0);
    onClose();
  });
  const card = kind === 'credit_card';
  return (
    <Sheet visible={visible} title="Nueva cuenta" onClose={onClose}>
      <Chips options={ACCOUNT_KINDS} value={kind} onChange={setKind} />
      <Field label="Nombre" value={name} onChangeText={setName} placeholder={card ? 'Por ejemplo: Visa del banco' : 'Por ejemplo: Cuenta RUT'} />
      <AmountField label={card ? 'Lo que debes hoy en la tarjeta' : 'Saldo de hoy'} value={balance} onChange={setBalance} />
      {card ? <AmountField label="Cupo (opcional)" value={limit} onChange={setLimit} /> : null}
      {s.error ? <Notice text={s.error} /> : null}
      <Button
        label="Guardar"
        loading={s.busy}
        onPress={() => {
          if (!name.trim()) return s.setError('Ponle un nombre.');
          s.run(() => f.addAccount({ name: name.trim(), kind, opening_balance: card ? -balance : balance, credit_limit: card && limit ? limit : null }));
        }}
      />
    </Sheet>
  );
}

const DEBT_KINDS = [
  { value: 'consumer', label: 'Crédito de consumo' },
  { value: 'installments', label: 'Compra en cuotas' },
  { value: 'mortgage', label: 'Hipotecario' },
  { value: 'person', label: 'Con una persona' },
];

export function DebtSheet({ f, visible, onClose }: { f: Finance; visible: boolean; onClose: () => void }) {
  const [kind, setKind] = useState('consumer');
  const [creditor, setCreditor] = useState('');
  const [total, setTotal] = useState(0);
  const [count, setCount] = useState('12');
  const [quota, setQuota] = useState(0);
  const [start, setStart] = useState<string | null>(todayIso());
  const s = useSave(() => {
    setCreditor('');
    setTotal(0);
    setQuota(0);
    onClose();
  });
  const n = Math.max(1, Number(count) || 1);
  const suggested = total ? Math.round(total / n) : 0;
  return (
    <Sheet visible={visible} title="Nueva deuda" onClose={onClose}>
      <Chips options={DEBT_KINDS} value={kind} onChange={setKind} />
      <Field label="¿Con quién o qué es?" value={creditor} onChangeText={setCreditor} placeholder="Por ejemplo: Banco, Ripley, mi hermano" />
      <AmountField label="Monto total" value={total} onChange={setTotal} />
      <Field label="Número de cuotas" value={count} onChangeText={(v) => setCount(v.replace(/\D/g, ''))} keyboardType="number-pad" />
      <AmountField label={suggested && !quota ? `Valor de la cuota (sin interés serían ${formatCLP(suggested)})` : 'Valor de la cuota'} value={quota} onChange={setQuota} />
      <DateField label="Primera cuota (o fecha del crédito)" value={start} onChange={setStart} />
      {s.error ? <Notice text={s.error} /> : null}
      <Button
        label="Guardar"
        loading={s.busy}
        onPress={() => {
          if (!creditor.trim() || !total) return s.setError('Escribe con quién es y el monto.');
          s.run(() =>
            f.addDebt({ kind, creditor: creditor.trim(), original_amount: total, installments_total: n, installment_amount: quota || suggested, start_date: start ?? todayIso() }),
          );
        }}
      />
    </Sheet>
  );
}

const ASSET_KINDS = [
  { value: 'vehicle', label: 'Vehículo' },
  { value: 'property', label: 'Propiedad' },
  { value: 'investment', label: 'Inversión' },
  { value: 'other', label: 'Otro' },
];

export function AssetSheet({ f, visible, onClose }: { f: Finance; visible: boolean; onClose: () => void }) {
  const [kind, setKind] = useState('vehicle');
  const [name, setName] = useState('');
  const [value, setValue] = useState(0);
  const s = useSave(() => {
    setName('');
    setValue(0);
    onClose();
  });
  return (
    <Sheet visible={visible} title="Nuevo bien" onClose={onClose}>
      <Chips options={ASSET_KINDS} value={kind} onChange={setKind} />
      <Field label="Nombre" value={name} onChangeText={setName} placeholder="Por ejemplo: Auto, Depto, Fondo mutuo" />
      <AmountField label="Cuánto vale hoy (aproximado)" value={value} onChange={setValue} />
      {s.error ? <Notice text={s.error} /> : null}
      <Button
        label="Guardar"
        loading={s.busy}
        onPress={() => {
          if (!name.trim()) return s.setError('Ponle un nombre.');
          s.run(() => f.addAsset({ kind, name: name.trim(), value }));
        }}
      />
    </Sheet>
  );
}
