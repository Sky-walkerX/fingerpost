/** Tool definitions for the agent loop (design §4.3). */

import type { LayoutElement } from '@fingerpost/protocol';

export interface ToolDef {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    strict: boolean;
  };
}

export const TOOL_DEFS: ToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'guide_to',
      description: 'Guide the user\'s finger to an element on screen.',
      parameters: {
        type: 'object',
        properties: {
          element_id: { type: 'string', description: 'id of the element to guide to' },
          why: { type: 'string', description: 'Brief reason shown to the user' },
        },
        required: ['element_id', 'why'],
        additionalProperties: false,
      },
      strict: true,
    },
  },
  {
    type: 'function',
    function: {
      name: 'ask_user',
      description: 'Ask the user a question and wait for their answer.',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
        },
        required: ['question', 'options'],
        additionalProperties: false,
      },
      strict: true,
    },
  },
  {
    type: 'function',
    function: {
      name: 'confirm_with_user',
      description: 'Read the total amount and ask the user to confirm before payment. The summary must include the amount from the screen.',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'What the user is paying for, including the amount from the screen' },
          amount_value: { type: 'number', description: 'Numeric amount' },
          amount_currency: { type: 'string', description: '3-letter ISO currency code' },
          element_ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'Element ids this confirmation covers (pay/confirm/submit buttons)',
          },
        },
        required: ['summary', 'amount_value', 'amount_currency', 'element_ids'],
        additionalProperties: false,
      },
      strict: true,
    },
  },
  {
    type: 'function',
    function: {
      name: 'say',
      description: 'Speak something to the user.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string' },
        },
        required: ['text'],
        additionalProperties: false,
      },
      strict: true,
    },
  },
  {
    type: 'function',
    function: {
      name: 'wait_for_screen_change',
      description: 'Wait for the screen to change after a press.',
      parameters: {
        type: 'object',
        properties: {
          expected: { type: 'string', description: 'What the screen should show after the press' },
        },
        required: ['expected'],
        additionalProperties: false,
      },
      strict: true,
    },
  },
  {
    type: 'function',
    function: {
      name: 'go_back',
      description: 'Press the Back button on screen.',
      parameters: {
        type: 'object',
        properties: {},
        required: [] as string[],
        additionalProperties: false,
      },
      strict: true,
    },
  },
  {
    type: 'function',
    function: {
      name: 'finish',
      description: 'End the task.',
      parameters: {
        type: 'object',
        properties: {
          result: { type: 'string', enum: ['done', 'failed'] },
          reason: { type: 'string' },
        },
        required: ['result', 'reason'],
        additionalProperties: false,
      },
      strict: true,
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_layout',
      description: 'Request a fresh screen parse.',
      parameters: {
        type: 'object',
        properties: {},
        required: [] as string[],
        additionalProperties: false,
      },
      strict: true,
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_element',
      description: 'Search the current layout for an element by description.',
      parameters: {
        type: 'object',
        properties: {
          description: { type: 'string' },
        },
        required: ['description'],
        additionalProperties: false,
      },
      strict: true,
    },
  },
];

/** Find a tool call argument by name. */
export function toolArg(args: Record<string, unknown>, name: string): unknown {
  return args[name];
}

/** Summarize elements for the LLM context window. */
export function layoutSummary(elements: readonly LayoutElement[]): string {
  return elements.map((el) => `[${el.id}] "${el.label}" role=${el.role}`).join('\n');
}


/** Read only a unique local OCR token inside the parsed appliance display. */
export function readApplianceDisplay(elements: readonly LayoutElement[], tokens: readonly {text:string;box:{u:number;v:number;w:number;h:number}}[]): string|null {
  const displays=elements.filter(e=>e.role==='text'&&/^(?:P?[0-9]|\d{1,2}:[0-5]\d)$/i.test(e.label.trim()));
  if(displays.length!==1) return null;
  const display=displays[0]!, xs=display.polygon.map(p=>p.u),ys=display.polygon.map(p=>p.v);
  const found=tokens.filter(token=>{
    const x=token.box.u+token.box.w/2,y=token.box.v+token.box.h/2;
    return x>=Math.min(...xs)&&x<=Math.max(...xs)&&y>=Math.min(...ys)&&y<=Math.max(...ys)&&token.text.trim()===display.label.trim();
  });
  return found.length===1?found[0]!.text.trim():null;
}
