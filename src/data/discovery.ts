import { useState } from 'react';

import type { Neuron, NeuronState, Synapse, Trade } from '@/core/discovery';
import { bool, invalidateRemote, list, useRows } from './live';
import { supabase } from './supabase';

// Catálogos (solo lectura) y el estado del cerebro de la persona (F30, MD2).

type Raw = Record<string, unknown>;

const toNeuron = (r: Raw): Neuron => ({
  code: String(r.code),
  name: String(r.name),
  hemisphere: r.hemisphere as Neuron['hemisphere'],
  level: Number(r.level),
  minimum: (r.minimum as string) ?? null,
  summary: (r.summary as string) ?? null,
  sensitive: bool(r.sensitive),
  min_age: Number(r.min_age),
  sort_order: Number(r.sort_order),
});

export function useNeurons() {
  const { data, loading } = useRows<Raw>(
    'SELECT * FROM neurons ORDER BY sort_order',
    [],
    () => supabase.from('neurons').select('*').order('sort_order'),
    'neurons',
  );
  return { neurons: data.map(toNeuron), loading };
}

export function useSynapses() {
  const { data } = useRows<Synapse>(
    'SELECT neuron_a, neuron_b FROM synapses',
    [],
    () => supabase.from('synapses').select('neuron_a, neuron_b'),
    'synapses',
  );
  return data;
}

export function useTrades() {
  const { data, loading } = useRows<Raw>(
    "SELECT * FROM trades WHERE status = 'active' ORDER BY sort_order",
    [],
    () => supabase.from('trades').select('*').eq('status', 'active').order('sort_order'),
    'trades',
  );
  const trades: Trade[] = data.map((r) => ({
    code: String(r.code),
    name: String(r.name),
    tools: list(r.tools),
    beta_priority: r.beta_priority == null ? null : Number(r.beta_priority),
    status: String(r.status),
    sort_order: Number(r.sort_order),
  }));
  return { trades, loading };
}

export function useHabitTemplates() {
  const { data } = useRows<Raw>(
    'SELECT * FROM habit_templates ORDER BY sort_order',
    [],
    () => supabase.from('habit_templates').select('*').order('sort_order'),
    'habit_templates',
  );
  return data.map((r) => ({
    code: String(r.code),
    name: String(r.name),
    direction: String(r.direction) as 'good' | 'reduce',
    min_age: Number(r.min_age),
  }));
}

export type Onboarding = {
  goals: string[];
  interests: string[];
  trades: string[];
  path: 'quick' | 'calm' | null;
  plans: string[];
  completed: boolean;
};

export function useOnboarding(accountId: string | undefined): Onboarding | null {
  const { data } = useRows<Raw>(
    'SELECT * FROM onboarding_answers WHERE account_id = ?',
    [accountId ?? ''],
    () => supabase.from('onboarding_answers').select('*').eq('account_id', accountId ?? ''),
    `onboarding:${accountId}`,
  );
  const r = data[0];
  if (!r) return null;
  return {
    goals: list(r.goals),
    interests: list(r.interests),
    trades: list(r.trades),
    path: (r.path as Onboarding['path']) ?? null,
    plans: list(r.plans),
    completed: !!r.completed_at,
  };
}

export function useUserNeurons(accountId: string | undefined): Record<string, NeuronState> {
  const { data } = useRows<Raw>(
    'SELECT neuron_code, state FROM user_neurons WHERE account_id = ?',
    [accountId ?? ''],
    () => supabase.from('user_neurons').select('neuron_code, state').eq('account_id', accountId ?? ''),
    `user_neurons:${accountId}`,
  );
  return Object.fromEntries(data.map((r) => [String(r.neuron_code), r.state as NeuronState]));
}

export async function saveOnboarding(input: {
  goals: string[];
  interests: string[];
  trades: string[];
  path: 'quick' | 'calm';
  plans: string[];
  answers: Record<string, unknown>;
  neurons: Record<string, NeuronState>;
}) {
  const { error } = await supabase.rpc('save_onboarding', {
    p_goals: input.goals,
    p_interests: input.interests,
    p_trades: input.trades,
    p_path: input.path,
    p_plans: input.plans,
    p_answers: input.answers,
    p_neurons: Object.entries(input.neurons).map(([code, state]) => ({ code, state })),
  });
  if (error) throw error;
  invalidateRemote();
}

export async function setNeuronState(code: string, state: NeuronState, how = 'own') {
  const { error } = await supabase.rpc('set_neuron_state', { p_code: code, p_state: state, p_how: how });
  if (error) throw error;
  invalidateRemote();
}

export async function answerSuggestion(code: string, reason: string, answer: 'accepted' | 'later' | 'not_interested') {
  const { error } = await supabase.rpc('answer_suggestion', { p_code: code, p_reason: reason, p_answer: answer });
  if (error) throw error;
  invalidateRemote();
}

/** Neuronas marcadas «no me interesa» en los últimos 30 días (no se vuelven a sugerir). */
export function useNotInterested(accountId: string | undefined): string[] {
  const [since] = useState(() => new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString());
  const { data } = useRows<Raw>(
    "SELECT neuron_code FROM neuron_suggestions WHERE account_id = ? AND answer = 'not_interested' AND answered_at > ?",
    [accountId ?? '', since],
    () =>
      supabase
        .from('neuron_suggestions')
        .select('neuron_code')
        .eq('account_id', accountId ?? '')
        .eq('answer', 'not_interested')
        .gt('answered_at', since),
    `not_interested:${accountId}`,
  );
  return data.map((r) => String(r.neuron_code));
}

/** La persona «yo» de la cuenta: nombre y fecha de nacimiento (reglas de edad). */
export function useSelfPerson(accountId: string | undefined): { name: string; birthDate: string | null } | null {
  const { data } = useRows<Raw>(
    "SELECT name, birth_date FROM people WHERE account_id = ? AND type = 'self'",
    [accountId ?? ''],
    () => supabase.from('people').select('name, birth_date').eq('account_id', accountId ?? '').eq('type', 'self'),
    `self:${accountId}`,
  );
  const r = data[0];
  return r ? { name: String(r.name), birthDate: (r.birth_date as string) ?? null } : null;
}
