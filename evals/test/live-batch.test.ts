import { describe, expect, it } from 'vitest';
import { createFetchRecorder, projectToQuad, matchesExpectedControl, polygonCentroid } from '../src/live-batch.ts';

describe('content-free live measurement', () => {
  it('records streamed completion and usage without request or response content', async () => {
    const recorder = createFetchRecorder(async () => new Response('data: {"usage":{"prompt_tokens":12,"completion_tokens":3},"text":"SECRET"}\n\ndata: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } }), 1);
    await (await recorder.fetch('https://api.meta.ai/v1/chat/completions', { method: 'POST', body: JSON.stringify({ model: 'muse-spark-1.3', messages: ['SECRET'] }), headers: { 'x-prompt-id': 'UNTRUSTED SECRET' } })).text();
    expect(recorder.calls).toEqual([{ model: 'muse-spark-1.3', promptId: null, concept: null, status: 200, latencyMs: expect.any(Number), outcome: 'ok', inputTokens: 12, outputTokens: 3 }]);
    expect(JSON.stringify(recorder.calls)).not.toContain('SECRET');
    await expect(recorder.fetch('https://api.meta.ai/v1/responses')).rejects.toThrow('Request cap reached');
    expect(recorder.calls).toHaveLength(1);
  });
  it('reserves the cap before concurrent body reads', async () => {
    let requests = 0;
    const recorder = createFetchRecorder(async () => { requests++; return new Response('{}'); }, 1);
    const results = await Promise.allSettled([recorder.fetch('https://api.meta.ai/v1/responses'),recorder.fetch('https://api.meta.ai/v1/responses')]);
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    expect(requests).toBe(1);
  });
  it('records failures without retaining exception messages', async () => {
    const recorder = createFetchRecorder(async () => { throw new Error('SECRET'); }, 1);
    await expect(recorder.fetch('https://api.meta.ai/v1/responses')).rejects.toThrow();
    expect(recorder.calls[0]?.outcome).toBe('error');
    expect(JSON.stringify(recorder.calls)).not.toContain('SECRET');
  });
  it('projects through perspective, and rejects degenerate planes', () => {
    const quad = [{x:10,y:20},{x:110,y:20},{x:90,y:100},{x:30,y:100}];
    expect(projectToQuad(quad, {u:0,v:0})).toEqual({x:10,y:20});
    expect(projectToQuad(quad, {u:1,v:1}).x).toBeCloseTo(90);
    expect(projectToQuad(quad, {u:0.5,v:0.5}).y).toBeCloseTo(70);
    expect(() => projectToQuad(Array(4).fill({x:0,y:0}), {u:0,v:0})).toThrow();
  });
});

it('does not advance prepared task frames after a wrong or absent control target',()=>{
  expect(matchesExpectedControl([], 'Plus')).toBe(false);
  const messages: import('@fingerpost/protocol').ServerMessage[] = [
    {type:'layout',id:'l',ts:0,screenType:'appliance',sensitivity:'none',rotation:0,language:'en',source:'model',fingerprint:'f',elements:[{id:'plus',label:'Plus',role:'button',confidence:1,polygon:[{u:0,v:0},{u:1,v:0},{u:1,v:1}]}]},
    {type:'target',id:'t',ts:0,elementId:'plus',polygon:[{u:0,v:0},{u:1,v:0},{u:1,v:1}],confidence:1,say:'Synthetic target'},
  ];
  expect(matchesExpectedControl(messages,'Plus')).toBe(true);
  expect(matchesExpectedControl(messages,'Minus')).toBe(false);
});

it('uses an area centroid rather than the mean of sampled vertices',()=>{
 const center=polygonCentroid([{u:0,v:0},{u:1,v:0},{u:1,v:1},{u:0,v:.5}]);
 expect(center.u).toBeCloseTo(5/9);expect(center.v).toBeCloseTo(7/18);
 expect(()=>polygonCentroid([{u:0,v:0},{u:0,v:0},{u:0,v:0}])).toThrow();
});
