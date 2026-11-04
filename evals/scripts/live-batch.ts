import { readFile, writeFile, realpath } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import type { ServerMessage } from '@fingerpost/protocol';
import { createFetchRecorder, projectToQuad } from '../src/live-batch.ts';

const { values } = parseArgs({args: process.argv.slice(2).filter(a=>a!=='--'), options: {help:{type:'boolean'}, cases:{type:'string'}, out:{type:'string'}, cap:{type:'string'}, reasoning:{type:'string'},}, allowPositionals:true});
if (values.help) {
  console.log('live-batch --cases <private cases.json> --out <private results.json> [--cap 150] [--reasoning low|medium|high|default]\nCases: {id,image,goal,refBox:[x1,y1,x2,y2]|refUV:[u,v,w,h]|expected:"ask",quad?}. Images resolve relative to cases.json. Set META_API_KEY in the environment. Outputs contain no model text.');
} else {
  const point = z.object({x:z.number().finite(),y:z.number().finite()});
  const box = z.tuple([z.number(),z.number(),z.number(),z.number()]);
  const casesSchema = z.array(z.object({id:z.string().regex(/^[a-z0-9-]{1,64}$/),image:z.string(),goal:z.string().min(1),refBox:box.optional(),refUV:box.optional(),expected:z.literal('ask').optional(),quad:z.array(point).length(4).optional()}).refine(c=>c.expected==='ask'||!!c.refBox||!!c.refUV).refine(c=>!c.refUV||!!c.quad));
  const reasoning = z.enum(['low','medium','high','default']).parse(values.reasoning ?? 'low');
  const cap = z.coerce.number().int().positive().parse(values.cap ?? 150);
  if (!values.cases || !values.out || !process.env.META_API_KEY) throw new Error('Require --cases, --out and META_API_KEY');
  const privateRoot = await realpath(new URL('../datasets/private/',import.meta.url));
  const ensurePrivate = (path:string) => { const rel=relative(privateRoot,path); if(rel.startsWith('..')||isAbsolute(rel)) throw new Error('Inputs and outputs must stay in datasets/private'); return path; };
  const source=ensurePrivate(await realpath(resolve(values.cases)));
  const output=resolve(values.out);
  ensurePrivate(await realpath(dirname(output)));
  const cases=casesSchema.parse(JSON.parse(await readFile(source,'utf8')));
  if(new Set(cases.map(c=>c.id)).size!==cases.length) throw new Error('Duplicate case id');
  const recorder=createFetchRecorder(globalThis.fetch,cap);
  globalThis.fetch=recorder.fetch;
  const {createMetaClient,liveModels,createRouter,SessionPipeline,MODEL_TURN_TIMEOUT_MS,jpegSize}=await import('@fingerpost/gateway/eval-api');
  const models=liveModels(createMetaClient(process.env.META_API_KEY),reasoning==='default'?{}:{parseReasoning:reasoning});
  const router=createRouter({meta:models});
  const results=[];
  for(const c of cases) {
    if(recorder.calls.length>=cap) break;
    const bytes=new Uint8Array(await readFile(ensurePrivate(await realpath(resolve(dirname(source),c.image)))));
    const size=jpegSize(bytes), sent:ServerMessage[]=[];
    const start=performance.now(), first=recorder.calls.length;
    const pipeline=new SessionPipeline({models,route:router,turnTimeoutMs:MODEL_TURN_TIMEOUT_MS,send:m=>sent.push(m)});
    pipeline.onGoal(c.goal);
    let failed=false;
    try { await pipeline.onKeyframe({type:'keyframe',id:`${c.id}-k1`,ts:Date.now(),kind:'full',purpose:'locate',imageSize:{w:size.width,h:size.height},ocrTokens:[],...(c.quad?{quad:c.quad}:{})},bytes); }
    catch { failed=true; }
    finally { bytes.fill(0); }
    const final=[...sent].reverse().find(m=>['target','ask','mode','error','finish','confirm'].includes(m.type));
    const layout=[...sent].reverse().find(m=>m.type==='layout');
    let aligned:boolean|null=null;
    if(final?.type==='target'&&layout?.type==='layout'&&layout.screenQuad) {
      const p={u:final.polygon.reduce((s,p)=>s+p.u,0)/final.polygon.length,v:final.polygon.reduce((s,p)=>s+p.v,0)/final.polygon.length};
      const anchor=projectToQuad(layout.screenQuad,p);
      if(c.refBox) aligned=anchor.x>=c.refBox[0]&&anchor.x<=c.refBox[2]&&anchor.y>=c.refBox[1]&&anchor.y<=c.refBox[3];
      else if(c.refUV&&c.quad) {
        // Project the returned image point back to the reference unit plane.
        const corners=[{u:c.refUV[0],v:c.refUV[1]},{u:c.refUV[0]+c.refUV[2],v:c.refUV[1]},{u:c.refUV[0]+c.refUV[2],v:c.refUV[1]+c.refUV[3]},{u:c.refUV[0],v:c.refUV[1]+c.refUV[3]}].map(p=>projectToQuad(c.quad!,p));
        aligned=corners.every((a,i)=>{const b=corners[(i+1)%4]!;return (b.x-a.x)*(anchor.y-a.y)-(b.y-a.y)*(anchor.x-a.x)>=-1e-8;});
      }
    }
    const r={id:c.id,final:final?.type??'none',timeMs:Math.round(performance.now()-start),aligned,expected:c.expected??'target',failed,calls:recorder.calls.slice(first)};
    results.push(r);
    await writeFile(output,JSON.stringify({cap,reasoning,requests:recorder.calls.length,results},null,2),{mode:0o600,flag:results.length===1?'wx':'w'});
    console.log(JSON.stringify({id:r.id,final:r.final,timeMs:r.timeMs,aligned:r.aligned,calls:r.calls.length}));
  }
}
