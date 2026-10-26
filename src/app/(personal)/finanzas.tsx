import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import {
  accountBalance,
  advice,
  balanceSheet,
  cashFlow,
  cashFlowByYear,
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
import { fonts } from '@/theme/tokens';
import { AppText, Button, EyeButton, Screen } from '@/ui';
import { BarRow, ChipRow, DateField, Empty, Kicker, Panel, PillTabs, Row, todayIso } from '@/ui/kit';

// Finanzas (F09, con la primera versión como referencia): resumen del mes, movimientos,
// informes (estado de resultados, balance general y flujo de caja), deudas con cuotas y cuentas.
// 26-10-2026 (revisión del usuario): pestañas con el nombre completo, estado de resultados
// consolidado con fechas a elección, balance con activos y pasivos que se agregan ahí mismo, y
// flujo de caja en columnas hacia el lado, por meses o por años.

type Tab = 'summary' | 'moves' | 'reports' | 'debts' | 'accounts';
type Report = 'income' | 'balance' | 'cash';
type Range = 'month' | 'last' | 'quarter' | 'year' | 'custom';

const DAY = (iso: string) => `${iso.slice(8, 10)}-${iso.slice(5, 7)}`;
const pad = (n: number) => String(n).padStart(2, '0');

function rangeOf(r: Range, today: Date, custom: { from: string | null; to: string | null }): { from: string; to: string; label: string } {
  const y = today.getFullYear();
  const m = today.getMonth();
  const end = (yy: number, mm: number) => `${yy}-${pad(mm + 1)}-${pad(new Date(yy, mm + 1, 0).getDate())}`;
  if (r === 'last') {
    const d = new Date(y, m - 1, 1);
    return { from: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`, to: end(d.getFullYear(), d.getMonth()), label: monthName(monthKey(d)) };
  }
  if (r === 'quarter') {
    const d = new Date(y, m - 2, 1);
    return { from: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`, to: end(y, m), label: 'últimos 3 meses' };
  }
  if (r === 'year') return { from: `${y}-01-01`, to: end(y, m), label: `en lo que va de ${y}` };
  if (r === 'custom' && custom.from && custom.to) return { from: custom.from, to: custom.to, label: `${DAY(custom.from)}-${custom.from.slice(0, 4)} al ${DAY(custom.to)}-${custom.to.slice(0, 4)}` };
  return { from: `${y}-${pad(m + 1)}-01`, to: end(y, m), label: monthName(monthKey(today)) };
}

export default function FinanzasScreen() {
  const { colors } = useTheme();
  const f = useFinance();
  const money = useAmountVisibility();
  const $ = (n: number) => displayAmount(n, money.visible);
  const [tab, setTab] = useState<Tab>('summary');
  const [report, setReport] = useState<Report>('income');
  const [range, setRange] = useState<Range>('month');
  const [custom, setCustom] = useState<{ from: string | null; to: string | null }>({ from: null, to: todayIso() });
  const [flowBy, setFlowBy] = useState<'month' | 'year'>('month');
  // Desde el registro rápido (+) se llega con ?nuevo=expense o ?nuevo=income.
  const { nuevo } = useLocalSearchParams<{ nuevo?: string }>();
  const [sheet, setSheet] = useState<'move' | 'account' | 'debt' | 'asset' | null>(nuevo ? 'move' : null);

  const today = new Date();
  const month = monthKey(today);
  const months12 = lastMonths(today, 12);
  const months3 = lastMonths(today, 3);
  // El compilador de React memoriza estos cálculos.
  const catNames = new Map(f.categories.map((c) => [c.id, c.name]));
  const accNames = new Map(f.accounts.map((a) => [a.id, a.name]));
  const current = incomeStatement(f.movements, f.categories, month);
  const previous = incomeStatement(f.movements, f.categories, months3[1]);
  const period = rangeOf(range, today, custom);
  const consolidated = incomeStatement(f.movements, f.categories, { from: period.from, to: period.to });
  const balance = balanceSheet(f.accounts, f.movements, f.debts, f.assets);
  const years = Array.from(new Set([today.getFullYear(), ...f.movements.map((m) => Number(m.occurred_on.slice(0, 4)))])).sort();
  const flow = flowBy === 'month' ? cashFlow(f.movements, f.accounts, months12) : cashFlowByYear(f.movements, f.accounts, years);
  const tips = advice(current, previous);

  const confirmDelete = (table: 'fin_movements' | 'fin_accounts' | 'fin_debts' | 'fin_assets', id: string, what: string) =>
    Alert.alert('¿Borrar?', `Se borra ${what}.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => f.remove(table, id) },
    ]);

  const hiddenHint = !money.visible ? (
    <AppText variant="caption" muted>
      Los montos están ocultos: toca el ojo de arriba para verlos.
    </AppText>
  ) : null;

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
        <Button label="+ Registrar" onPress={() => setSheet('move')} />
      </Panel>
      <PaydayPanel />
      <Panel>
        <Kicker>¿En qué se fue la plata?</Kicker>
        {current.expensesByCategory.length ? (
          current.expensesByCategory.slice(0, 6).map((c) => <BarRow key={c.name} label={c.name} value={c.total} max={current.expensesByCategory[0].total} text={$(c.total)} />)
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
        f.movements.slice(0, 150).map((m) => {
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
      <Kicker>{`Estado de resultados · ${period.label}`}</Kicker>
      <ChipRow
        options={[
          { value: 'month', label: 'Este mes' },
          { value: 'last', label: 'Mes pasado' },
          { value: 'quarter', label: '3 meses' },
          { value: 'year', label: 'Este año' },
          { value: 'custom', label: 'Elegir fechas' },
        ]}
        value={range}
        onChange={setRange}
      />
      {range === 'custom' ? (
        <View style={{ gap: 8 }}>
          <DateField label="Desde" value={custom.from} onChange={(v) => setCustom((c) => ({ ...c, from: v }))} />
          <DateField label="Hasta" value={custom.to} onChange={(v) => setCustom((c) => ({ ...c, to: v }))} />
        </View>
      ) : null}
      {hiddenHint}
      <Kicker color={colors.ok}>{`Ingresos · ${$(consolidated.income)}`}</Kicker>
      {consolidated.incomeByCategory.map((c) => (
        <Row key={`i-${c.name}`} title={c.name} right={<AppText variant="label">{$(c.total)}</AppText>} />
      ))}
      <Kicker color={colors.bad}>{`Gastos · ${$(consolidated.expenses)}`}</Kicker>
      {consolidated.expensesByCategory.map((c) => (
        <Row key={`e-${c.name}`} title={c.name} right={<AppText variant="label">{$(c.total)}</AppText>} />
      ))}
      <View style={[styles.total, { borderTopColor: colors.line }]}>
        <AppText variant="subtitle" style={{ flex: 1 }}>
          Resultado
        </AppText>
        <AppText variant="subtitle" color={consolidated.result < 0 ? colors.bad : colors.ok}>
          {$(consolidated.result)}
        </AppText>
      </View>
      {!consolidated.income && !consolidated.expenses ? <Empty text="Sin movimientos en este período." /> : null}
    </Panel>
  );

  const balanceReport = (
    <Panel>
      <Kicker>Balance general · hoy</Kicker>
      <AppText variant="caption" muted>
        Patrimonio
      </AppText>
      <AppText variant="title" color={balance.netWorth < 0 ? colors.bad : colors.text}>
        {$(balance.netWorth)}
      </AppText>
      <AppText variant="caption" muted>
        Lo que tienes (activos) menos lo que debes (pasivos).
      </AppText>
      {hiddenHint}
      <View style={styles.between}>
        <Kicker color={colors.ok}>{`Activos · ${$(balance.totalAssets)}`}</Kicker>
        <AppText variant="label" color={colors.accent} onPress={() => setSheet('asset')}>
          + Activo
        </AppText>
      </View>
      {balance.assets.length ? balance.assets.map((l) => <Row key={`a-${l.name}`} title={l.name} right={<AppText variant="label">{$(l.amount)}</AppText>} />) : <Empty text="Tus cuentas con saldo y tus bienes (auto, casa, inversiones)." />}
      <AppText variant="caption" color={colors.accent} onPress={() => setSheet('account')}>
        + Cuenta (efectivo, cuenta RUT, ahorro)
      </AppText>
      <View style={styles.between}>
        <Kicker color={colors.bad}>{`Pasivos · ${$(balance.totalLiabilities)}`}</Kicker>
        <AppText variant="label" color={colors.accent} onPress={() => setSheet('debt')}>
          + Pasivo
        </AppText>
      </View>
      {balance.liabilities.length ? balance.liabilities.map((l) => <Row key={`p-${l.name}`} title={l.name} right={<AppText variant="label">{$(l.amount)}</AppText>} />) : <Empty text="Créditos, compras en cuotas y lo que debes en tarjetas." />}
    </Panel>
  );

  const maxFlow = Math.max(...flow.map((m) => Math.max(m.inflow, m.outflow)), 1);
  const cashReport = (
    <Panel>
      <Kicker>{flowBy === 'month' ? 'Flujo de caja · últimos 12 meses' : 'Flujo de caja · por año'}</Kicker>
      <ChipRow
        options={[
          { value: 'month', label: 'Por mes' },
          { value: 'year', label: 'Por año' },
        ]}
        value={flowBy}
        onChange={setFlowBy}
      />
      <AppText variant="caption" muted>
        La plata que entró y salió de verdad. Un gasto con tarjeta sale cuando pagas la tarjeta. Desliza hacia el lado.
      </AppText>
      {hiddenHint}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
        {flow.map((m) => (
          <View key={m.month} style={[styles.col, { backgroundColor: colors.surface2 }]}>
            <View style={styles.colBars}>
              <View style={[styles.colBar, { height: `${(m.inflow / maxFlow) * 100}%`, backgroundColor: colors.ok }]} />
              <View style={[styles.colBar, { height: `${(m.outflow / maxFlow) * 100}%`, backgroundColor: colors.bad }]} />
            </View>
            <AppText variant="label" style={{ fontSize: 12 }}>
              {flowBy === 'month' ? monthName(m.month).slice(0, 3) : m.month}
            </AppText>
            <AppText variant="caption" style={{ fontSize: 11, fontFamily: fonts.bold }} color={m.net < 0 ? colors.bad : colors.ok} numberOfLines={1}>
              {$(m.net)}
            </AppText>
          </View>
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 14 }}>
        <AppText variant="caption" color={colors.ok}>
          ■ Entró
        </AppText>
        <AppText variant="caption" color={colors.bad}>
          ■ Salió
        </AppText>
        <AppText variant="caption" muted style={{ flex: 1, textAlign: 'right' }}>{`Acumulado: ${$(flow.at(-1)?.cumulative ?? 0)}`}</AppText>
      </View>
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
                sub={d.status === 'paid' || !s.remaining ? 'Pagada' : `${s.paid} de ${d.installments_total} cuotas · quedan ${$(s.remainingAmount)}${s.nextDue ? ` · próxima ${DAY(s.nextDue)}` : ''}`}
                onLongPress={() => confirmDelete('fin_debts', d.id, `la deuda con ${d.creditor}`)}
                right={<AppText variant="label">{$(Number(d.installment_amount))}</AppText>}
              />
              <BarRow label="Avance" value={s.paid} max={Number(d.installments_total)} text={`${Math.round(s.progress * 100)} %`} tone="ok" />
            </View>
          );
        })
      ) : (
        <Empty text="Agrega tus créditos y compras en cuotas. Cada pago se registra con «Pagar una deuda»." />
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
      <PillTabs
        options={[
          { value: 'summary', label: 'Resumen' },
          { value: 'moves', label: 'Movimientos' },
          { value: 'reports', label: 'Informes' },
          { value: 'debts', label: 'Deudas' },
          { value: 'accounts', label: 'Cuentas y bienes' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'summary' ? summary : null}
      {tab === 'moves' ? moves : null}
      {tab === 'reports' ? (
        <>
          <PillTabs
            options={[
              { value: 'income', label: 'Estado de resultados' },
              { value: 'balance', label: 'Balance general' },
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

const styles = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  total: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  col: { width: 68, borderRadius: 14, padding: 8, alignItems: 'center', gap: 4 },
  colBars: { height: 120, flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  colBar: { width: 16, borderRadius: 5, minHeight: 2 },
});
