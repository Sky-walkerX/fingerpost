/** Content-free per-call diagnostics. Never retain bodies, URLs, headers or exception text. */
export interface CallRecord {
  model: string; promptId: string | null; concept: string | null;
  status: number | null; latencyMs: number | null; outcome: 'pending' | 'ok' | 'http-error' | 'error' | 'cancelled';
  inputTokens?: number; outputTokens?: number;
}
const models = new Set(['muse-spark-1.3', 'muse-spark-1.2', 'sam-3.1']);
const prompts = new Set(['parse-screen.v1', 'ground-control.v1']);
const concepts = new Set(['touchscreen display', 'control panel', 'remote control', 'appliance', 'screen']);
export function createFetchRecorder(transport: typeof fetch, cap = 150) {
  if (!Number.isSafeInteger(cap) || cap < 1) throw new Error('Invalid request cap');
  const calls: CallRecord[] = [];
  let reserved = 0;
  const recorded: typeof fetch = async (input, init) => {
    if (reserved >= cap) throw new Error('Request cap reached');
    reserved++;
    const request = new Request(input, init);
    let model = 'unknown', concept: string | null = null;
    try {
      const body = JSON.parse(await request.clone().text());
      if (models.has(body.model)) model = body.model;
      const phrase = body.input?.[0]?.content?.find((c: {type: string}) => c.type === 'input_text')?.text;
      if (typeof phrase === 'string') concept = concepts.has(phrase) ? phrase : 'box';
    } catch { /* Metadata is optional; content is never recorded. */ }
    const prompt = request.headers.get('x-prompt-id');
    const record: CallRecord = { model, promptId: prompt && prompts.has(prompt) ? prompt : null,
      concept, status: null, latencyMs: null, outcome: 'pending' };
    calls.push(record);
    const start = performance.now();
    const done = (outcome: CallRecord['outcome']) => {
      if (record.latencyMs !== null) return;
      record.latencyMs = Math.round(performance.now() - start); record.outcome = outcome;
      request.signal.removeEventListener('abort', abort);
    };
    const abort = () => done('cancelled');
    request.signal.addEventListener('abort', abort, { once: true });
    const usage = (text: string) => {
      try {
        const u = JSON.parse(text).usage;
        for (const [key, value] of [['inputTokens', u?.prompt_tokens ?? u?.input_tokens], ['outputTokens', u?.completion_tokens ?? u?.output_tokens]] as const)
          if (Number.isSafeInteger(value) && value >= 0) record[key] = value;
      } catch { /* Partial stream records and DONE carry no usage. */ }
    };
    try {
      const response = await transport(request);
      record.status = response.status;
      if (!response.body) { done(response.ok ? 'ok' : 'http-error'); return response; }
      const reader = response.body.getReader(), decoder = new TextDecoder();
      const streaming = response.headers.get('content-type')?.includes('event-stream');
      let pending = '';
      const body = new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            const part = await reader.read();
            if (part.done) {
              pending += decoder.decode();
              if (!streaming) usage(pending);
              pending = ''; done(response.ok ? 'ok' : 'http-error'); controller.close(); return;
            }
            pending += decoder.decode(part.value, {stream:true});
            if (streaming) {
              const lines = pending.split('\n'); pending = lines.pop()!;
              for (const line of lines) if (line.startsWith('data: ')) usage(line.slice(6));
            }
            // Bound transient parsing memory even for malformed provider output.
            if (pending.length > 1_048_576) pending = '';
            controller.enqueue(part.value);
          } catch (error) { pending = ''; done('error'); controller.error(error); }
        },
        async cancel(reason) { pending = ''; done('cancelled'); await reader.cancel(reason); },
      });
      return new Response(body, {status:response.status, statusText:response.statusText, headers:response.headers});
    } catch (error) { done('error'); throw error; }
  };
  return { fetch: recorded, calls };
}

/** Unit screen coordinates to the captured image, including perspective. */
export function projectToQuad(q: readonly {x:number;y:number}[], p: {u:number;v:number}) {
  if (q.length !== 4) throw new Error('Invalid quad');
  const unit = [[0,0],[1,0],[1,1],[0,1]];
  const rows = q.flatMap(({x,y}, i) => {
    const [u,v] = unit[i]!;
    return [[u!,v!,1,0,0,0,-x*u!,-x*v!,x],[0,0,0,u!,v!,1,-y*u!,-y*v!,y]];
  });
  for (let c=0;c<8;c++) {
    let pivot=c;
    for(let r=c+1;r<8;r++) if(Math.abs(rows[r]![c]!)>Math.abs(rows[pivot]![c]!)) pivot=r;
    [rows[c],rows[pivot]]=[rows[pivot]!,rows[c]!];
    if(Math.abs(rows[c]![c]!)<1e-10) throw new Error('Degenerate quad');
    for(let r=0;r<8;r++) if(r!==c) {
      const f=rows[r]![c]!/rows[c]![c]!;
      for(let k=c;k<=8;k++) rows[r]![k]!-=f*rows[c]![k]!;
    }
  }
  const h=rows.map((r,i)=>r[8]!/r[i]!);
  const w=h[6]!*p.u+h[7]!*p.v+1;
  if(Math.abs(w)<1e-10) throw new Error('Invalid projection');
  return {x:(h[0]!*p.u+h[1]!*p.v+h[2]!)/w,y:(h[3]!*p.u+h[4]!*p.v+h[5]!)/w};
}

export function matchesExpectedControl(messages: readonly import('@fingerpost/protocol').ServerMessage[], expected:string):boolean {
  const target=messages.at(-1), layout=[...messages].reverse().find(m=>m.type==='layout');
  return target?.type==='target'&&layout?.type==='layout'&&
    layout.elements.find(e=>e.id===target.elementId)?.label.trim().toLowerCase()===expected.toLowerCase();
}

/** Area centroid, independent of how densely a provider samples each polygon edge. */
export function polygonCentroid(polygon:readonly {u:number;v:number}[]) {
  let twiceArea=0,u=0,v=0;
  for(const [i,a] of polygon.entries()) {
    const b=polygon[(i+1)%polygon.length]!, cross=a.u*b.v-b.u*a.v;
    twiceArea+=cross;u+=(a.u+b.u)*cross;v+=(a.v+b.v)*cross;
  }
  if(Math.abs(twiceArea)<1e-10) throw new Error('Degenerate target');
  return {u:u/(3*twiceArea),v:v/(3*twiceArea)};
}
