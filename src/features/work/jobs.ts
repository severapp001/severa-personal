import { useEffect, useState } from 'react';

import type { Entry } from '@/data/entries';
import type { KindDef } from '@/features/modules/catalog';

// Mis trabajos y la jornada por tramos (usuario, 26-10-2026: «estos días no haré de Uber, iré a un
// minimarket… si a las 7 hago de shopper hasta las 13, luego Uber hasta las 17 y vuelvo a shopper
// hasta las 21»). Viven en el motor común: módulo «trabajo», tipos «trabajo» y «tramo».

export const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export const TRIP_TRADES = ['Conductor de aplicaciones', 'Shopper o repartidor'];

export const JOB_KIND: KindDef = {
  kind: 'trabajo',
  label: 'Mis trabajos',
  one: 'Trabajo',
  empty: 'Agrega cada trabajo que tienes: el de siempre y los de unos días.',
  fields: [
    { key: 'title', label: 'Nombre', kind: 'text', required: true, placeholder: 'Uber, Minimarket Don Pepe…' },
    { key: 'oficio', label: 'Tipo de trabajo', kind: 'choice', options: ['Conductor de aplicaciones', 'Shopper o repartidor', 'Ventas o minimarket', 'Con contrato', 'Servicios o independiente', 'Emprendimiento', 'Otro'] },
    { key: 'pago', label: '¿Cómo te pagan?', kind: 'choice', options: ['Por viaje o pedido', 'Por hora', 'Por día', 'Sueldo mensual', 'Por servicio', 'Comisión'] },
    { key: 'amount', label: 'Monto del pago (por hora, día o mes; opcional)', kind: 'amount' },
    { key: 'contrato', label: 'Contrato', kind: 'choice', options: ['Con contrato', 'Sin contrato', 'Boleta de honorarios'] },
    { key: 'dias', label: 'Días que trabajas', kind: 'multi', options: DAYS },
    { key: 'desde', label: 'Entras', kind: 'time' },
    { key: 'hasta', label: 'Sales', kind: 'time' },
    { key: 'day', label: 'Desde cuándo (opcional)', kind: 'date' },
    { key: 'until', label: 'Hasta cuándo, si es por unos días (opcional)', kind: 'date' },
  ],
};

export type LogItem = { t: number; kind: 'trip' | 'fuel' | 'income'; a: number };

export const nowSec = () => Math.floor(Date.now() / 1000);

/** La hora en segundos, que avanza sola mientras `active` (con el compilador de React, la hora
 *  tiene que venir del estado: si se calcula en el render, queda fija; por eso «el tiempo no corría»). */
export function useNowSec(active: boolean): number {
  const [now, setNow] = useState(nowSec);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(nowSec()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

export const clock = (secs: number) =>
  [Math.floor(secs / 3600), Math.floor(secs / 60) % 60, secs % 60].map((v) => String(Math.max(0, Math.floor(v))).padStart(2, '0')).join(':');

export const logOf = (tramo: Entry): LogItem[] => (Array.isArray(tramo.data.log) ? (tramo.data.log as LogItem[]) : []);
export const startOf = (tramo: Entry) => Number(tramo.data.start) || 0;
export const endOf = (tramo: Entry) => (tramo.data.end ? Number(tramo.data.end) : null);

/** ¿Se paga por viaje? Entonces la jornada muestra «+ Viaje» y «+ Bencina». */
export const byTrips = (job: Entry | null | undefined) => !!job && (job.data.pago === 'Por viaje o pedido' || TRIP_TRADES.includes(String(job.data.oficio ?? '')));

/** Lo ganado en un tramo: viajes e ingresos anotados, o las horas por la tarifa. */
export function tramoEarnings(tramo: Entry, job: Entry | null | undefined, now: number) {
  const log = logOf(tramo);
  const trips = log.filter((l) => l.kind === 'trip');
  const fuel = log.filter((l) => l.kind === 'fuel').reduce((s, l) => s + l.a, 0);
  const noted = log.filter((l) => l.kind !== 'fuel').reduce((s, l) => s + l.a, 0);
  const hours = Math.max(0, ((endOf(tramo) ?? now) - startOf(tramo)) / 3600);
  const rate = Number(job?.amount) || 0;
  const pay = job?.data.pago;
  const earned = pay === 'Por hora' ? Math.round(hours * rate) + noted : pay === 'Por día' ? rate + noted : noted;
  return { trips: trips.length, fuel, earned, net: earned - fuel, hours };
}

/** ¿Trabaja ese día de la semana? (0 = domingo, como Date.getDay). */
export const worksOn = (job: Entry, weekday: number) => {
  const list = Array.isArray(job.data.dias) ? (job.data.dias as string[]) : [];
  return list.includes(DAYS[(weekday + 6) % 7]);
};

/** Trabajos vigentes hoy (sin fecha de término o todavía dentro de ella). */
export const activeJobs = (jobs: Entry[], today: string) => jobs.filter((j) => (!j.day || j.day <= today) && (!j.until || j.until >= today));
