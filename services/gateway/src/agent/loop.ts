import { readFileSync } from 'node:fs';
import { ulid } from 'ulid';
import type { Layout, LayoutElement, Locale, ServerMessage } from '@fingerpost/protocol';
import type { ModelPort } from '../models/port.ts';
import { resolveByText } from '../resolve/match.ts';
import { describePosition, listLabels } from '../resolve/describe.ts';
import { Policy } from './policy.ts';
import { TOOL_DEFS, layoutSummary } from './tools.ts';

export const AGENT_PROMPT_ID = 'agent.v1';
const SYSTEM_PROMPT = readFileSync(new URL(`../../prompts/${AGENT_PROMPT_ID}.md`, import.meta.url), 'utf8');

/** What the caller (SessionPipeline or test) provides. */
export interface AgentDeps {
  models: ModelPort;
  send: (m: ServerMessage) => void;
  now?: () => number;
}

/** Override for tests: the model's tool-call responses are scripted here. */
export interface ToolImpl {
  chat(messages: unknown[], tools: unknown[]): Promise<{ toolCalls: ToolCall[] }>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

interface LayoutSnapshot {
  fingerprint: string;
  elements: LayoutElement[];
}

/**
 * Agent loop for multi-step task intent (design §4.3).
 *
 * The model plans steps, each tool call becomes an fp.v1 message to the device.
 * Policy enforces confirm-before-pay, step budget, and loop detection.
 */
export class AgentSession {
  private goal = '';
  private locale: Locale = 'en';
  private layout: LayoutSnapshot | null = null;
  private layoutHistory: LayoutSnapshot[] = [];
  private readonly policy: Policy;
  private readonly d: AgentDeps;
  private readonly toolImpl: ToolImpl | null;

  // Pending resolvers for device events
  private pendingAnswer: ((text: string) => void) | null = null;
  private pendingConfirm: ((accepted: boolean) => void) | null = null;
  private pendingVerify: ((result: string) => void) | null = null;
  private pendingLayout: ((layout: LayoutSnapshot) => void) | null = null;
  private finished = false;

  constructor(d: AgentDeps & { tools?: ToolImpl }) {
    this.d = d;
    this.toolImpl = d.tools ?? null;
    this.policy = new Policy({ now: d.now });
  }

  private now(): number {
    return this.d.now?.() ?? Date.now();
  }
  private base() {
    return { id: ulid(), ts: this.now() };
  }

  onGoal(text: string, locale?: Locale): void {
    this.goal = text;
    if (locale) this.locale = locale;
    this.finished = false;
  }

  async onLayout(layout: Layout): Promise<void> {
    const snap: LayoutSnapshot = {
      fingerprint: layout.fingerprint,
      elements: [...layout.elements],
    };
    this.layout = snap;
    this.layoutHistory.push(snap);
    if (this.layoutHistory.length > 5) this.layoutHistory.shift();

    // If there's a pending layout resolver, resolve it (device response to a guide/wait)
    if (this.pendingLayout) {
      const resolve = this.pendingLayout;
      this.pendingLayout = null;
      resolve(snap);
      return;
    }

    // Policy checks before running the loop
    const policyResult = this.policy.step(snap.fingerprint);
    if (policyResult === 'budget') {
      this.finished = true;
      this.d.send({
        ...this.base(), type: 'finish',
        result: 'failed',
        say: 'I ran out of steps. Please try a simpler request.',
      });
      return;
    }
    if (policyResult === 'loop') {
      this.d.send({
        ...this.base(), type: 'ask',
        question: 'Should I go back?',
        options: ['Yes', 'No'],
      });
      // Don't return - wait for answer; but don't auto-run loop either
      return;
    }

    // Run the agent loop
    await this.runLoop();
  }

  onAnswer(_re: string, text: string): void {
    if (this.pendingAnswer) {
      const resolve = this.pendingAnswer;
      this.pendingAnswer = null;
      resolve(text);
    }
  }

  onConfirmReply(_re: string, accepted: boolean): void {
    if (this.pendingConfirm) {
      const resolve = this.pendingConfirm;
      this.pendingConfirm = null;
      resolve(accepted);
    }
  }

  async onVerify(result: string): Promise<void> {
    if (this.pendingVerify) {
      const resolve = this.pendingVerify;
      this.pendingVerify = null;
      resolve(result);
    }
  }

  private async runLoop(): Promise<void> {
    if (this.finished || !this.layout) return;

    const impl = this.toolImpl;
    if (!impl) return;

    const messages = this.buildMessages();
    const response = await impl.chat(messages, TOOL_DEFS);

    for (const call of response.toolCalls) {
      if (this.finished) break;
      await this.executeTool(call);
    }
  }

  private buildMessages(): unknown[] {
    const messages: unknown[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Goal: ${this.goal}` },
    ];

    for (const snap of this.layoutHistory) {
      messages.push({
        role: 'assistant',
        content: `Current screen (fingerprint: ${snap.fingerprint}):\n${layoutSummary(snap.elements)}`,
      });
    }

    return messages;
  }

  private async executeTool(call: ToolCall): Promise<void> {
    const args = call.arguments;

    switch (call.name) {
      case 'guide_to': {
        const elementId = args.element_id as string;
        const el = this.layout?.elements.find((e) => e.id === elementId);
        if (!el) {
          this.d.send({
            ...this.base(), type: 'say',
            text: `Element ${elementId} not found on screen.`,
            priority: 'state',
          });
          return;
        }

        const check = this.policy.allowGuide(el);
        if (!check.ok) {
          this.d.send({
            ...this.base(), type: 'say',
            text: check.say,
            priority: 'safety',
          });
          return;
        }

        this.d.send({
          ...this.base(), type: 'target',
          elementId: el.id,
          polygon: el.polygon,
          confidence: el.confidence,
          say: `Found ${el.label}, ${describePosition(el.polygon)}.`,
        });

        // Wait for verify
        const result = await this.waitForVerify();
        if (result === 'ok') {
          // Wait for next layout (screen changed after press)
          await this.waitForLayout();
        }
        return;
      }

      case 'ask_user': {
        const question = args.question as string;
        const options = args.options as string[];
        this.d.send({
          ...this.base(), type: 'ask',
          question, options,
        });
        await this.waitForAnswer();
        return;
      }

      case 'confirm_with_user': {
        const summary = args.summary as string;
        const amountValue = args.amount_value as number;
        const amountCurrency = args.amount_currency as string;
        const elementIds = args.element_ids as string[];
        const confirmId = ulid();

        this.policy.recordConfirm(confirmId, elementIds);

        this.d.send({
          ...this.base(),
          id: confirmId,
          type: 'confirm',
          summary,
          amount: { value: amountValue, currency: amountCurrency },
        });

        const accepted = await this.waitForConfirm();
        if (accepted) {
          this.policy.accept(confirmId);
        }
        return;
      }

      case 'say': {
        const text = args.text as string;
        this.d.send({
          ...this.base(), type: 'say',
          text, priority: 'info',
        });
        return;
      }

      case 'wait_for_screen_change': {
        const expected = args.expected as string;
        this.d.send({
          ...this.base(), type: 'expect',
          description: expected,
        });
        await this.waitForLayout();
        return;
      }

      case 'go_back': {
        const backEl = this.layout?.elements.find((e) => e.role === 'back');
        if (backEl) {
          this.d.send({
            ...this.base(), type: 'target',
            elementId: backEl.id,
            polygon: backEl.polygon,
            confidence: backEl.confidence,
            say: `Going back.`,
          });
          await this.waitForVerify();
          await this.waitForLayout();
        }
        return;
      }

      case 'finish': {
        const result = (args.result as string) === 'done' ? 'done' as const : 'failed' as const;
        const reason = args.reason as string;
        this.finished = true;
        this.d.send({
          ...this.base(), type: 'finish',
          result, say: reason,
        });
        return;
      }

      case 'get_layout': {
        await this.waitForLayout();
        return;
      }

      case 'find_element': {
        const description = args.description as string;
        if (!this.layout) return;
        const resolved = resolveByText(description, this.layout.elements);
        if (resolved.kind === 'match') {
          this.d.send({
            ...this.base(), type: 'say',
            text: `Found ${resolved.element.label}.`,
            priority: 'info',
          });
        } else {
          const labels = listLabels(this.layout.elements.filter((e) => e.role !== 'text'));
          this.d.send({
            ...this.base(), type: 'say',
            text: `I see ${labels || 'nothing'}.`,
            priority: 'info',
          });
        }
        return;
      }
    }
  }

  private waitForVerify(): Promise<string> {
    return new Promise<string>((resolve) => {
      this.pendingVerify = resolve;
    });
  }

  private waitForAnswer(): Promise<string> {
    return new Promise<string>((resolve) => {
      this.pendingAnswer = resolve;
    });
  }

  private waitForConfirm(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.pendingConfirm = resolve;
    });
  }

  private waitForLayout(): Promise<LayoutSnapshot> {
    return new Promise<LayoutSnapshot>((resolve) => {
      this.pendingLayout = resolve;
    });
  }
}
