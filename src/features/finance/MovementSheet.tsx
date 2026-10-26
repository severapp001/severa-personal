import { useState } from 'react';
import { View } from 'react-native';

import type { MovementKind } from '@/core/finance';
import type { Finance } from '@/data/finance';
import { authErrorMessage } from '@/features/account/authErrors';
import { AppText, Button, Notice } from '@/ui';
import { tap } from '@/ui/haptics';
import { AmountField, Chips, DateField, Field, Segmented, Sheet, todayIso } from '@/ui/kit';

// Registrar un movimiento (F03, F09): el usuario elige entre pocas opciones y Severa lleva la
// contabilidad por detrás.

const KINDS: { value: MovementKind; label: string }[] = [
  { value: 'expense', label: 'Gasto' },
  { value: 'income', label: 'Ingreso' },
  { value: 'transfer', label: 'Mover' },
  { value: 'debt_payment', label: 'Pagar deuda' },
];

export function MovementSheet({ f, visible, onClose, initialKind = 'expense' }: { f: Finance; visible: boolean; onClose: () => void; initialKind?: MovementKind }) {
  const [kind, setKind] = useState<MovementKind>(initialKind);
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState<string | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [toAccount, setToAccount] = useState<string | null>(null);
  const [debt, setDebt] = useState<string | null>(null);
  const [interest, setInterest] = useState(0);
  const [date, setDate] = useState<string | null>(todayIso());
  const [note, setNote] = useState('');
  const [salary, setSalary] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cats = f.categories.filter((c) => c.kind === (kind === 'income' ? 'income' : 'expense'));
  const accounts = f.accounts.filter((a) => !a.archived);
  const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name }));
  const debts = f.debts.filter((d) => d.status !== 'paid');
  const chosenAccount = account ?? accounts[0]?.id ?? null;

  const reset = () => {
    setAmount(0);
    setCategory(null);
    setDebt(null);
    setInterest(0);
    setNote('');
    setSalary(false);
    setError(null);
  };

  async function save() {
    if (!amount) return setError('Escribe el monto.');
    if (kind === 'transfer' && (!toAccount || toAccount === chosenAccount)) return setError('Elige a qué cuenta se mueve la plata.');
    if (kind === 'debt_payment' && !debt) return setError('Elige qué deuda pagaste.');
    setBusy(true);
    setError(null);
    try {
      await f.addMovement({
        kind,
        amount,
        occurred_on: date ?? todayIso(),
        account_id: chosenAccount,
        to_account_id: kind === 'transfer' ? toAccount : null,
        category_id: kind === 'expense' || kind === 'income' ? category : null,
        debt_id: kind === 'debt_payment' ? debt : null,
        interest: kind === 'debt_payment' && interest ? interest : null,
        description: note.trim() || null,
        is_salary: kind === 'income' && salary,
      });
      tap();
      reset();
      onClose();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} title="Registrar" onClose={onClose}>
      <Segmented options={KINDS} value={kind} onChange={(k) => { setKind(k); setCategory(null); }} />
      <AmountField label={kind === 'debt_payment' ? 'Cuánto pagaste (la cuota completa)' : 'Monto'} value={amount} onChange={setAmount} autoFocus />
      {kind === 'expense' || kind === 'income' ? (
        <View style={{ gap: 6 }}>
          <AppText variant="caption" muted>
            Categoría
          </AppText>
          <Chips options={cats.map((c) => ({ value: c.id, label: c.name }))} value={category} onChange={setCategory} />
        </View>
      ) : null}
      {kind === 'debt_payment' ? (
        <View style={{ gap: 6 }}>
          <AppText variant="caption" muted>
            Deuda
          </AppText>
          {debts.length ? (
            <Chips options={debts.map((d) => ({ value: d.id, label: d.creditor }))} value={debt} onChange={setDebt} />
          ) : (
            <AppText variant="caption" muted>
              Primero agrega la deuda en la pestaña Deudas.
            </AppText>
          )}
          <AmountField label="De eso, intereses o comisiones (opcional)" value={interest} onChange={setInterest} />
        </View>
      ) : null}
      {accountOptions.length ? (
        <View style={{ gap: 6 }}>
          <AppText variant="caption" muted>
            {kind === 'income' ? 'Entra a' : kind === 'transfer' ? 'Sale de' : 'Sale de'}
          </AppText>
          <Chips options={accountOptions} value={chosenAccount} onChange={setAccount} />
        </View>
      ) : (
        <AppText variant="caption" muted>
          Sin cuentas todavía: el movimiento cuenta en los informes, pero no mueve ningún saldo. Agrega tus cuentas en la pestaña Cuentas.
        </AppText>
      )}
      {kind === 'transfer' ? (
        <View style={{ gap: 6 }}>
          <AppText variant="caption" muted>
            Va a (para pagar la tarjeta, elige la tarjeta)
          </AppText>
          <Chips options={accountOptions.filter((a) => a.value !== chosenAccount)} value={toAccount} onChange={setToAccount} />
        </View>
      ) : null}
      {kind === 'income' ? (
        <Chips options={[{ value: 'yes', label: salary ? '✓ Es mi sueldo' : 'Es mi sueldo' }]} value={salary ? 'yes' : null} onChange={() => setSalary(!salary)} />
      ) : null}
      <DateField label="Fecha" value={date} onChange={setDate} />
      <Field label="Nota (opcional)" value={note} onChangeText={setNote} placeholder="Por ejemplo: almuerzo con el equipo" />
      {error ? <Notice text={error} /> : null}
      <Button label="Guardar" loading={busy} onPress={save} />
    </Sheet>
  );
}
