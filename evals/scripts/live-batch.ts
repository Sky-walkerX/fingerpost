import { readFile, writeFile, realpath } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import type { ServerMessage } from '@fingerpost/protocol';
import { createFetchRecorder, projectToQuad, matchesExpectedControl, polygonCentroid } from '../src/live-batch.ts';

const { values } = parseArgs({args: process.argv.slice(2).filter(a=>a!=='--'), options: {help:{type:'boolean'}, cases:{type:'string'}, out:{type:'string'}, cap:{type:'string'}, reasoning:{type:'string'},}, allowPositionals:true});
if (values.help) {
  console.log('live-batch --cases <private cases.json> --out <private results.json> [--cap 150] [--reasoning low|medium|high|default]\nCases: {id,image,goal,refBox:[x1,y1,x2,y2]|refUV:[u,v,w,h]|expected:"ask",quad?}. Task cases may use expected:"finish", expectedDisplay and up to 19 verify frames with image/pressedControl/ocrTokens/kind. Images resolve relative to cases.json. Set META_API_KEY in the environment. Outputs contain no model text.');
} else {
  const point = z.object({x:z.number().finite(),y:z.number().finite()});
  const box = z.tuple([z.number(),z.number(),z.number(),z.number()]);
  const ocrToken=z.object({text:z.string().min(1).max(200),box:z.object({u:z.number().min(0).max(1),v:z.number().min(0).max(1),w:z.number().positive().max(1),h:z.number().positive().max(1)})});
  const casesSchema = z.array(z.object({id:z.string().regex(/^[a-z0-9-]{1,64}$/),image:z.string(),goal:z.string().min(1),refBox:box.optional(),refUV:box.optional(),expected:z.enum(['ask','finish']).optional(), expectedDisplay:z.string().regex(/^(?:P?[0-9]|[0-9]{1,2}:[0-5][0-9])$/).optional(), ocrTokens:z.array(ocrToken).max(200).optional(), kind:z.enum(['full','screen']).optional(), frames:z.array(z.object({image:z.string(),pressedControl:z.enum(['Plus','Minus']),ocrTokens:z.array(ocrToken).max(200),kind:z.enum(['full','screen']).optional()})).max(19).optional(), quad:z.array(point).length(4).optional()}).refine(c=>!!c.expected||!!c.refBox||!!c.refUV).refine(c=>!c.refUV||!!c.quad));
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
    const sent:ServerMessage[]=[];
    const start=performance.now(), first=recorder.calls.length;
    const pipeline=new SessionPipeline({models,route:router,turnTimeoutMs:MODEL_TURN_TIMEOUT_MS,send:m=>sent.push(m)});
    pipeline.onGoal(c.goal);
    let failed=false, controlsMatched=true;
    const frames=[{image:c.image,ocrTokens:c.ocrTokens??[],kind:c.kind},...(c.frames??[])];
    for(const [index,frame] of frames.entries()) {
      if(recorder.calls.length>=cap) break;
      if(index>0) {
        if(sent.at(-1)?.type!=='target') break;
        if(!matchesExpectedControl(sent,c.frames![index-1]!.pressedControl)) {controlsMatched=false;failed=true;break;}
      }
      const bytes=new Uint8Array(await readFile(ensurePrivate(await realpath(resolve(dirname(source),frame.image)))));
      try {
        const size=jpegSize(bytes);
        await pipeline.onKeyframe({type:'keyframe',id:`${c.id}-k${index}`,ts:Date.now(),kind:frame.kind??'full',purpose:index===0?'locate':'verify',imageSize:{w:size.width,h:size.height},ocrTokens:frame.ocrTokens,...(c.quad?{quad:c.quad}:{})},bytes);
      } catch { failed=true; break; }
      finally { bytes.fill(0); }
    }
    const final=[...sent].reverse().find(m=>['target','ask','mode','error','finish','confirm'].includes(m.type));
    const layout=[...sent].reverse().find(m=>m.type==='layout');
    let aligned:boolean|null=null;
    if(final?.type==='target'&&layout?.type==='layout'&&layout.screenQuad) {
      const p=polygonCentroid(final.polygon);
      const anchor=projectToQuad(layout.screenQuad,p);
      if(c.refBox) aligned=anchor.x>=c.refBox[0]&&anchor.x<=c.refBox[2]&&anchor.y>=c.refBox[1]&&anchor.y<=c.refBox[3];
      else if(c.refUV&&c.quad) {
        // Project the returned image point back to the reference unit plane.
        const corners=[{u:c.refUV[0],v:c.refUV[1]},{u:c.refUV[0]+c.refUV[2],v:c.refUV[1]},{u:c.refUV[0]+c.refUV[2],v:c.refUV[1]+c.refUV[3]},{u:c.refUV[0],v:c.refUV[1]+c.refUV[3]}].map(p=>projectToQuad(c.quad!,p));
        aligned=corners.every((a,i)=>{const b=corners[(i+1)%4]!;return (b.x-a.x)*(anchor.y-a.y)-(b.y-a.y)*(anchor.x-a.x)>=-1e-8;});
      }
    }
    const r={id:c.id,final:final?.type??'none',timeMs:Math.round(performance.now()-start),aligned,expected:c.expected??'target',failed,...(c.frames?{controlsMatched}:{}),...(c.expectedDisplay?{displayMatched:layout?.type==='layout'&&layout.elements.filter(e=>e.role==='text').some(e=>e.label.trim()===c.expectedDisplay)}:{}),calls:recorder.calls.slice(first)};
    results.push(r);
    await writeFile(output,JSON.stringify({cap,reasoning,requests:recorder.calls.length,results},null,2),{mode:0o600,flag:results.length===1?'wx':'w'});
    console.log(JSON.stringify({id:r.id,final:r.final,timeMs:r.timeMs,aligned:r.aligned,calls:r.calls.length}));
  }
}
