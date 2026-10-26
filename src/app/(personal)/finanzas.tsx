import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';

import {
  accountBalance,
  advice,
  balanceSheet,
  cashFlow,
  debtStatus,
  incomeStatement,
  lastMonths,
  monthKey,
  monthName,
} from '@/core/finance';
import { displayAmount } from '@/core/money';
import { useFinance } from '@/data/finance';
import { AccountSheet, AssetSheet, DebtSheet, ACCOUNT_KINDS } from '@/features/finance/FinanceSheets';
import { MovementSheet } from '@/features/finance/MovementSheet';
import { PaydayPanel } from '@/features/finance/PaydayPanel';
import { useAmountVisibility } from '@/features/privacy/useAmountVisibility';
import { ModuleHeader } from '@/features/space/ModuleHeader';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText, Button, EyeButton, Screen } from '@/ui';
import { BarRow, Empty, Kicker, Panel, Row, Segmented } from '@/ui/kit';

// Finanzas (F09, con la primera versión como referencia): resumen del mes, movimientos,
// informes (estado de resultados, balance general y flujo de caja), deudas con cuotas y cuentas.

type Tab = 'summary' | 'moves' | 'reports' | 'debts' | 'accounts';
type Report = 'income' | 'balance' | 'cash';

const DAY = (iso: string) => `${iso.slice(8, 10)}-${iso.slice(5, 7)}`;

export default function FinanzasScreen() {
  const { colors } = useTheme();
  const f = useFinance();
  const money = useAmountVisibility();
  const $ = (n: number) => displayAmount(n, money.visible);
  const [tab, setTab] = useState<Tab>('summary');
  const [report, setReport] = useState<Report>('income');
  // Desde el registro rápido (+) se llega con ?nuevo=expense o ?nuevo=income.
  const { nuevo } = useLocalSearchParams<{ nuevo?: string }>();
  const [sheet, setSheet] = useState<'move' | 'account' | 'debt' | 'asset' | null>(nuevo ? 'move' : null);

  const today = new Date();
  const month = monthKey(today);
  const months6 = lastMonths(today, 6);
  const months3 = lastMonths(today, 3);
  const catNames = useMemo(() => new Map(f.categories.map((c) => [c.id, c.name])), [f.categories]);
  const accNames = useMemo(() => new Map(f.accounts.map((a) => [a.id, a.name])), [f.accounts]);
  const current = useMemo(() => incomeStatement(f.movements, f.categories, month), [f.movements, f.categories, month]);
  const previous = useMemo(() => incomeStatement(f.movements, f.categories, months3[1]), [f.movements, f.categories, months3]);
  const statements = useMemo(() => months3.map((m) => incomeStatement(f.movements, f.categories, m)), [f.movements, f.categories, months3]);
  const balance = useMemo(() => balanceSheet(f.accounts, f.movements, f.debts, f.assets), [f.accounts, f.movements, f.debts, f.assets]);
  const flow = useMemo(() => cashFlow(f.movements, f.accounts, months6), [f.movements, f.accounts, months6]);
  const tips = advice(current, previous);

  const confirmDelete = (table: 'fin_movements' | 'fin_accounts' | 'fin_debts' | 'fin_assets', id: string, what: string) =>
    Alert.alert('¿Borrar?', `Se borra ${what}.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => f.remove(table, id) },
    ]);

  const summary = (
    <>
      <Panel>
        <Kicker>{`${monthName(month)} · resultado del mes`}</Kicker>
        <AppText variant="title" color={current.result < 0 ? colors.bad : colors.text}>
          {$(current.result)}
        </AppText>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <AppText variant="caption" muted>{`Ingresos ${$(current.income)}`}</AppText>
          <AppText variant="caption" muted>{`Gastos ${$(current.expenses)}`}</AppText>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button label="+ Registrar" onPress={() => setSheet('move')} />
          </View>
        </View>
      </Panel>
      <PaydayPanel />
      <Panel>
        <Kicker>¿En qué se fue la plata?</Kicker>
        {current.expensesByCategory.length ? (
          current.expensesByCategory.slice(0, 6).map((c) => (
            <BarRow key={c.name} label={c.name} value={c.total} max={current.expensesByCategory[0].total} text={$(c.total)} />
          ))
        ) : (
          <Empty text="Todavía no registras gastos este mes." />
        )}
      </Panel>
      <Panel>
        <Kicker>Consejos</Kicker>
        {tips.map((t) => (
          <AppText key={t} variant="body" style={{ fontSize: 15 }}>
            {`• ${t}`}
          </AppText>
        ))}
      </Panel>
    </>
  );

  const moves = (
    <Panel>
      <Button label="+ Registrar movimiento" onPress={() => setSheet('move')} />
      {f.movements.length ? (
        f.movements.slice(0, 120).map((m) => {
          const sign = m.kind === 'income' ? '+' : m.kind === 'transfer' ? '⇄ ' : '−';
          const what =
            m.kind === 'transfer'
              ? `${accNames.get(m.account_id ?? '') ?? 'Cuenta'} → ${accNames.get(m.to_account_id ?? '') ?? 'Cuenta'}`
              : m.kind === 'debt_payment'
                ? `Pago: ${f.debts.find((d) => d.id === m.debt_id)?.creditor ?? 'deuda'}`
                : (catNames.get(m.category_id ?? '') ?? (m.kind === 'income' ? 'Ingreso' : 'Gasto'));
          return (
            <Row
              key={m.id}
              title={m.description ? `${what} · ${m.description}` : what}
              sub={`${DAY(m.occurred_on)}${m.account_id ? ` · ${accNames.get(m.account_id) ?? ''}` : ''}`}
              onLongPress={() => confirmDelete('fin_movements', m.id, 'este movimiento')}
              right={
                <AppText variant="label" color={m.kind === 'income' ? colors.ok : colors.text} style={{ fontVariant: ['tabular-nums'] }}>
                  {`${sign}${$(Number(m.amount))}`}
                </AppText>
              }
            />
          );
        })
      ) : (
        <Empty text="Aquí aparecen tus gastos, ingresos y pagos. Mantén presionado uno para borrarlo." />
      )}
    </Panel>
  );

  const incomeReport = (
    <Panel>
      <Kicker>Estado de resultados · últimos 3 meses</Kicker>
      {statements.map((s) => (
        <View key={s.month} style={{ gap: 6 }}>
          <AppText variant="label">{monthName(s.month)}</AppText>
          <BarRow label="Ingresos" value={s.income} max={Math.max(...statements.map((x) => Math.max(x.income, x.expenses)), 1)} text={$(s.income)} tone="ok" />
          <BarRow label="Gastos" value={s.expenses} max={Math.max(...statements.map((x) => Math.max(x.income, x.expenses)), 1)} text={$(s.expenses)} tone="bad" />
          <AppText variant="caption" color={s.result < 0 ? colors.bad : colors.ok}>{`Resultado: ${$(s.result)}`}</AppText>
        </View>
      ))}
      <Kicker>{`Detalle de ${monthName(month)}`}</Kicker>
      {current.incomeByCategory.map((c) => (
        <Row key={`i-${c.name}`} title={c.name} sub="Ingreso" right={<AppText variant="label">{$(c.total)}</AppText>} />
      ))}
      {current.expensesByCategory.map((c) => (
        <Row key={`e-${c.name}`} title={c.name} sub="Gasto" right={<AppText variant="label">{$(c.total)}</AppText>} />
      ))}
      {!current.income && !current.expenses ? <Empty text="Sin movimientos este mes." /> : null}
    </Panel>
  );

  const balanceReport = (
    <Panel>
      <Kicker>Balance general · hoy</Kicker>
      <AppText variant="title" color={balance.netWorth < 0 ? colors.bad : colors.text}>
        {$(balance.netWorth)}
      </AppText>
      <AppText variant="caption" muted>
        Patrimonio: lo que tienes menos lo que debes.
      </AppText>
      <Kicker color={colors.ok}>{`Activos · ${$(balance.totalAssets)}`}</Kicker>
      {balance.assets.length ? balance.assets.map((l) => <Row key={`a-${l.name}`} title={l.name} right={<AppText variant="label">{$(l.amount)}</AppText>} />) : <Empty text="Agrega tus cuentas y bienes." />}
      <Kicker color={colors.bad}>{`Pasivos · ${$(balance.totalLiabilities)}`}</Kicker>
      {balance.liabilities.length ? balance.liabilities.map((l) => <Row key={`p-${l.name}`} title={l.name} right={<AppText variant="label">{$(l.amount)}</AppText>} />) : <Empty text="Sin deudas registradas." />}
    </Panel>
  );

  const maxFlow = Math.max(...flow.map((m) => Math.max(m.inflow, m.outflow)), 1);
  const cashReport = (
    <Panel>
      <Kicker>Flujo de caja · últimos 6 meses</Kicker>
      <AppText variant="caption" muted>
        La plata que entró y salió de verdad. Un gasto con tarjeta sale cuando pagas la tarjeta.
      </AppText>
      {flow.map((m) => (
        <View key={m.month} style={{ gap: 6 }}>
          <AppText variant="label">{`${monthName(m.month)} · neto ${$(m.net)}`}</AppText>
          <BarRow label="Entró" value={m.inflow} max={maxFlow} text={$(m.inflow)} tone="ok" />
          <BarRow label="Salió" value={m.outflow} max={maxFlow} text={$(m.outflow)} tone="bad" />
        </View>
      ))}
      <AppText variant="caption" muted>{`Acumulado en 6 meses: ${$(flow.at(-1)?.cumulative ?? 0)}`}</AppText>
    </Panel>
  );

  const debts = (
    <Panel>
      <Button label="+ Agregar deuda" kind="secondary" onPress={() => setSheet('debt')} />
      {f.debts.length ? (
        f.debts.map((d) => {
          const s = debtStatus(d, f.movements);
          return (
            <View key={d.id} style={{ gap: 6, paddingVertical: 6 }}>
              <Row
                title={d.creditor}
                sub={
                  d.status === 'paid' || !s.remaining
                    ? 'Pagada'
                    : `${s.paid} de ${d.installments_total} cuotas · quedan ${$(s.remainingAmount)}${s.nextDue ? ` · próxima ${DAY(s.nextDue)}` : ''}`
                }
                onLongPress={() => confirmDelete('fin_debts', d.id, `la deuda con ${d.creditor}`)}
                right={<AppText variant="label">{$(Number(d.installment_amount))}</AppText>}
              />
              <BarRow label="Avance" value={s.paid} max={Number(d.installments_total)} text={`${Math.round(s.progress * 100)} %`} tone="ok" />
            </View>
          );
        })
      ) : (
        <Empty text="Agrega tus créditos y compras en cuotas. Cada pago se registra con «Pagar deuda»." />
      )}
    </Panel>
  );

  const accounts = (
    <>
      <Panel>
        <Button label="+ Agregar cuenta" kind="secondary" onPress={() => setSheet('account')} />
        {f.accounts.length ? (
          f.accounts.map((a) => {
            const b = accountBalance(a, f.movements);
            return (
              <Row
                key={a.id}
                title={a.name}
                sub={ACCOUNT_KINDS.find((k) => k.value === a.kind)?.label}
                onLongPress={() => confirmDelete('fin_accounts', a.id, `la cuenta ${a.name}`)}
                right={
                  <AppText variant="label" color={b < 0 ? colors.bad : colors.text}>
                    {a.kind === 'credit_card' && b < 0 ? `Debes ${$(-b)}` : $(b)}
                  </AppText>
                }
              />
            );
          })
        ) : (
          <Empty text="Agrega efectivo, tu cuenta RUT o tus tarjetas para ver los saldos." />
        )}
      </Panel>
      <Panel>
        <Button label="+ Agregar bien" kind="secondary" onPress={() => setSheet('asset')} />
        {f.assets.map((x) => (
          <Row key={x.id} title={x.name} sub="Bien" onLongPress={() => confirmDelete('fin_assets', x.id, x.name)} right={<AppText variant="label">{$(Number(x.value))}</AppText>} />
        ))}
        {!f.assets.length ? <Empty text="Auto, casa o inversiones, para el balance general." /> : null}
      </Panel>
    </>
  );

  return (
    <Screen>
      <ModuleHeader kicker="Personal" title="Finanzas" right={<EyeButton visible={money.visible} onPress={money.toggle} />} />
      <Segmented
        options={[
          { value: 'summary', label: 'Resumen' },
          { value: 'moves', label: 'Movim.' },
          { value: 'reports', label: 'Informes' },
          { value: 'debts', label: 'Deudas' },
          { value: 'accounts', label: 'Cuentas' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'summary' ? summary : null}
      {tab === 'moves' ? moves : null}
      {tab === 'reports' ? (
        <>
          <Segmented
            options={[
              { value: 'income', label: 'Resultados' },
              { value: 'balance', label: 'Balance' },
              { value: 'cash', label: 'Flujo de caja' },
            ]}
            value={report}
            onChange={setReport}
          />
          {report === 'income' ? incomeReport : report === 'balance' ? balanceReport : cashReport}
        </>
      ) : null}
      {tab === 'debts' ? debts : null}
      {tab === 'accounts' ? accounts : null}
      <MovementSheet f={f} visible={sheet === 'move'} onClose={() => setSheet(null)} initialKind={nuevo === 'income' ? 'income' : 'expense'} />
      <AccountSheet f={f} visible={sheet === 'account'} onClose={() => setSheet(null)} />
      <DebtSheet f={f} visible={sheet === 'debt'} onClose={() => setSheet(null)} />
      <AssetSheet f={f} visible={sheet === 'asset'} onClose={() => setSheet(null)} />
    </Screen>
  );
}
