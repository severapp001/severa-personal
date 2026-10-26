import { useState } from 'react';
import { View } from 'react-native';

import type { MovementKind } from '@/core/finance';
import { useEntries } from '@/data/entries';
import type { Finance } from '@/data/finance';
import { authErrorMessage } from '@/features/account/authErrors';
import { groupPeople } from '@/features/modules/catalog';
import { AppText, Button, Notice } from '@/ui';
import { tap } from '@/ui/haptics';
import { AmountField, ChipRow, DateField, Field, PillTabs, Sheet, todayIso } from '@/ui/kit';

// Registrar un movimiento (F03, F09): el usuario elige entre pocas opciones y Severa lleva la
// contabilidad por detrás. 26-10-2026 (usuario: «las categorías ocupan mucho espacio… tampoco se
// selecciona si el gasto es compartido… no entiendo "Mover"»): pestañas con el nombre completo,
// categorías y cuentas en filas que se deslizan, y «¿Es compartido?» con los grupos de Gastos
// compartidos (tu parte queda como gasto y el resto, como lo que te deben).

const KINDS: { value: MovementKind; label: string }[] = [
  { value: 'expense', label: 'Gasto' },
  { value: 'income', label: 'Ingreso' },
  { value: 'transfer', label: 'Pasar entre mis cuentas' },
  { value: 'debt_payment', label: 'Pagar una deuda' },
];

export function MovementSheet({ f, visible, onClose, initialKind = 'expense' }: { f: Finance; visible: boolean; onClose: () => void; initialKind?: MovementKind }) {
  const shared = useEntries('gastos_compartidos');
  const groups = shared.of('grupo');
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
  const [group, setGroup] = useState<string>('no');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cats = f.categories.filter((c) => c.kind === (kind === 'income' ? 'income' : 'expense'));
  const accounts = f.accounts.filter((a) => !a.archived);
  const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name }));
  const debts = f.debts.filter((d) => d.status !== 'paid');
  const chosenAccount = account ?? accounts[0]?.id ?? null;
  const chosenGroup = groups.find((g) => g.id === group) ?? null;
  const people = groupPeople(chosenGroup);
  const myShare = chosenGroup ? Math.round(amount / people.length) : amount;

  const reset = () => {
    setAmount(0);
    setCategory(null);
    setDebt(null);
    setInterest(0);
    setNote('');
    setSalary(false);
    setGroup('no');
    setError(null);
  };

  async function save() {
    if (!amount) return setError('Escribe el monto.');
    if (kind === 'transfer' && (!toAccount || toAccount === chosenAccount)) return setError('Elige a qué cuenta pasa la plata.');
    if (kind === 'debt_payment' && !debt) return setError('Elige qué deuda pagaste.');
    setBusy(true);
    setError(null);
    try {
      const day = date ?? todayIso();
      const what = note.trim() || null;
      if (kind === 'expense' && chosenGroup) {
        // Compartido: el gasto completo queda en el grupo (pagaste tú, entre todos) y en Finanzas
        // queda tu parte.
        await shared.add({ kind: 'gasto', parent_id: chosenGroup.id, title: what ?? (cats.find((c) => c.id === category)?.name ?? 'Gasto'), amount, day, data: { pago: 'Yo', entre: [] } });
      }
      await f.addMovement({
        kind,
        amount: kind === 'expense' && chosenGroup ? myShare : amount,
        occurred_on: day,
        account_id: chosenAccount,
        to_account_id: kind === 'transfer' ? toAccount : null,
        category_id: kind === 'expense' || kind === 'income' ? category : null,
        debt_id: kind === 'debt_payment' ? debt : null,
        interest: kind === 'debt_payment' && interest ? interest : null,
        description: chosenGroup ? `${what ?? 'Compartido'} · ${chosenGroup.title}: tu parte de ${amount.toLocaleString('es-CL')}` : what,
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
      <PillTabs
        options={KINDS}
        value={kind}
        onChange={(k) => {
          setKind(k);
          setCategory(null);
        }}
      />
      <AmountField label={kind === 'debt_payment' ? 'Cuánto pagaste (la cuota completa)' : 'Monto'} value={amount} onChange={setAmount} autoFocus />
      {kind === 'expense' || kind === 'income' ? (
        <>
          <Field label={kind === 'income' ? '¿De qué?' : '¿En qué?'} value={note} onChangeText={setNote} placeholder={kind === 'income' ? 'Sueldo, venta, devolución…' : 'Almuerzo, luz, bencina…'} />
          <View style={{ gap: 6 }}>
            <AppText variant="caption" muted>
              Categoría
            </AppText>
            <ChipRow options={cats.map((c) => ({ value: c.id, label: c.name }))} value={category} onChange={setCategory} />
          </View>
        </>
      ) : null}
      {kind === 'debt_payment' ? (
        <View style={{ gap: 6 }}>
          <AppText variant="caption" muted>
            Deuda
          </AppText>
          {debts.length ? (
            <ChipRow options={debts.map((d) => ({ value: d.id, label: d.creditor }))} value={debt} onChange={setDebt} />
          ) : (
            <AppText variant="caption" muted>
              Primero agrega la deuda en la pestaña Deudas.
            </AppText>
          )}
          <AmountField label="De eso, intereses o comisiones (opcional)" value={interest} onChange={setInterest} />
        </View>
      ) : null}
      {kind === 'transfer' ? (
        <AppText variant="caption" muted>
          Para pasar plata de una cuenta tuya a otra (por ejemplo, de la cuenta RUT al efectivo) o para pagar la tarjeta de crédito. No cuenta como gasto.
        </AppText>
      ) : null}
      {accountOptions.length ? (
        <View style={{ gap: 6 }}>
          <AppText variant="caption" muted>
            {kind === 'income' ? 'Entra a' : 'Sale de'}
          </AppText>
          <ChipRow options={accountOptions} value={chosenAccount} onChange={setAccount} />
        </View>
      ) : (
        <AppText variant="caption" muted>
          Sin cuentas todavía: el movimiento cuenta en los informes, pero no mueve ningún saldo. Agrega tus cuentas en «Cuentas y bienes».
        </AppText>
      )}
      {kind === 'transfer' ? (
        <View style={{ gap: 6 }}>
          <AppText variant="caption" muted>
            Va a (para pagar la tarjeta, elige la tarjeta)
          </AppText>
          <ChipRow options={accountOptions.filter((a) => a.value !== chosenAccount)} value={toAccount} onChange={setToAccount} />
        </View>
      ) : null}
      {kind === 'income' ? <ChipRow options={[{ value: 'yes', label: salary ? '✓ Es mi sueldo' : 'Es mi sueldo' }]} value={salary ? 'yes' : null} onChange={() => setSalary(!salary)} /> : null}
      {kind === 'expense' ? (
        <View style={{ gap: 6 }}>
          <AppText variant="caption" muted>
            ¿Es compartido?
          </AppText>
          <ChipRow options={[{ value: 'no', label: 'Solo mío' }, ...groups.map((g) => ({ value: g.id, label: g.title ?? 'Grupo' }))]} value={group} onChange={setGroup} />
          {chosenGroup && amount ? <AppText variant="caption" muted>{`Se divide entre ${people.length}: tu parte es ${myShare.toLocaleString('es-CL')} y el resto te lo deben (queda en el grupo).`}</AppText> : null}
          {!groups.length ? (
            <AppText variant="caption" muted>
              Crea grupos (depto, familia, amigos) en Gastos compartidos.
            </AppText>
          ) : null}
        </View>
      ) : null}
      <DateField label="Fecha" value={date} onChange={setDate} />
      {kind === 'transfer' || kind === 'debt_payment' ? <Field label="Nota (opcional)" value={note} onChangeText={setNote} /> : null}
      {error ? <Notice text={error} /> : null}
      <Button label="Guardar" loading={busy} onPress={save} />
    </Sheet>
  );
}
