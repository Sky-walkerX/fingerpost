import { expect, test } from 'vitest';
import type { Layout, LayoutElement } from '@fingerpost/protocol';
import { AgentSession } from '../src/agent/loop.ts';
import { rulesPlanner, stateMessage, type AgentState } from '../src/agent/planner.ts';
import { layoutFingerprint } from '../src/session/pipeline.ts';

const el = (id: string, label: string, role: LayoutElement['role']): LayoutElement => ({
  id, label, role, confidence: 0.95, textNorm: label.toLowerCase(),
  polygon: [{ u: 0.1, v: 0.1 }, { u: 0.3, v: 0.1 }, { u: 0.3, v: 0.2 }, { u: 0.1, v: 0.2 }],
});
const layout = (elements: LayoutElement[]): Layout => ({
  id: 'l', ts: 0, type: 'layout', fingerprint: layoutFingerprint(elements), screenType: 'menu', rotation: 0, language: 'en',
  sensitivity: 'none', elements, source: 'model',
});
const state = (over: Partial<AgentState>): AgentState => ({ goal: 'order something', answers: [], history: [], confirmed: [], feedback: null,
  screen: { fingerprint: 'f', screenType: 'menu', elements: [el('a', 'Small', 'button'), el('b', 'Large', 'button')] }, ...over });

test('hindi task: the go-back question and its options are hindi', async () => {
  const menu = layout([el('drinks', 'Drinks', 'button'), el('back', 'Back', 'back')]);
  const agent = new AgentSession('order a cola', { planner: rulesPlanner(), locale: 'hi' });
  await agent.decide(menu); await agent.decide(menu);
  expect((await agent.decide(menu)).action).toMatchObject({ kind: 'ask', question: 'यही स्क्रीन बार-बार आ रही है। क्या मैं वापस जाऊँ?', options: ['हाँ', 'नहीं'] });
  expect(agent.onTranscript('हाँ')).toBe('answered');
});

test('rules planner asks and gives up in the session language', async () => {
  expect((await rulesPlanner().next(state({ locale: 'es' }))).call).toMatchObject({ name: 'ask_user', arguments: { question: '¿Cuál: Small o Large?' } });
  expect((await rulesPlanner().next(state({}))).call).toMatchObject({ name: 'ask_user', arguments: { question: 'Which one: Small or Large?' } });
  const none = state({ locale: 'hi', answers: ['x', 'y'], screen: { fingerprint: 'f', screenType: 'menu', elements: [el('t', 'Total', 'text')] } });
  expect((await rulesPlanner().next(none)).call).toMatchObject({ name: 'finish', arguments: { reason: 'मुझे यहाँ वह नहीं मिला। मुझे कुछ भी दबाने लायक नहीं दिख रहे हैं।' } });
});

test('the Spark planner is told to reply in the user language, and English state is unchanged', () => {
  expect(JSON.parse(stateMessage(state({ locale: 'hi' })))).toMatchObject({ reply_language: 'Hindi' });
  expect(JSON.parse(stateMessage(state({ locale: 'en' })))).not.toHaveProperty('reply_language');
  expect(JSON.parse(stateMessage(state({})))).not.toHaveProperty('reply_language');
});
