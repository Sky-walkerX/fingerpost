import { expect, it } from 'vitest';
import { ApplianceTask, parseDisplay } from '../src/agent/appliance-task.ts';
import { AgentSession } from '../src/agent/loop.ts';
import { rulesPlanner } from '../src/agent/planner.ts';
import { inferIntent } from '../src/agent/intent.ts';
import type { Layout, LayoutElement } from '@fingerpost/protocol';
const element=(id:string,label:string,role:LayoutElement['role']='button'):LayoutElement=>({id,label,role,confidence:0.95,polygon:[{u:.1,v:.1},{u:.3,v:.1},{u:.3,v:.2},{u:.1,v:.2}]});
const panel=(value:string):Layout=>({type:'layout',id:'l',ts:0,screenType:'appliance',sensitivity:'none',rotation:0,language:'en',source:'model',fingerprint:value,elements:[element('display',value,'text'),element('plus','Plus','icon'),element('minus','Minus','icon')]});
it('reads timer, prefixed power and bare power displays',()=>{
 expect(parseDisplay('2:00')).toEqual({kind:'timer',value:120});
 expect(parseDisplay('P5')).toEqual({kind:'power',value:5});
 expect(parseDisplay('5')).toEqual({kind:'power',value:5});
 expect(parseDisplay('2:99')).toBeNull();
});
it('plans one observed press at a time and finishes at power 3',()=>{
 const task=new ApplianceTask('set power to 3');
 expect(task.next(panel('1'),'1','en')).toMatchObject({kind:'target',element:{id:'plus'}});
 task.pressed();
 expect(task.next(panel('2'),'2','en')).toMatchObject({kind:'target',element:{id:'plus'},readback:expect.stringContaining('2')});
 task.pressed();
 expect(task.next(panel('3'),'3','en')).toMatchObject({kind:'finish',readback:expect.stringContaining('3')});
});
it('asks for stalled, reversed, missing or unknown controls and bounds steps',()=>{
 const task=new ApplianceTask('set power to 3');task.next(panel('1'),'1','en');task.pressed();
 expect(task.next(panel('1'),'1','en').kind).toBe('ask');
 const unknown=panel('1');unknown.elements[1]!.label='Unknown symbol';
 expect(new ApplianceTask('set power to 3').next(unknown,'1','en').kind).toBe('ask');
 expect(new ApplianceTask('set power to 3').next(panel('1'),null,'en').kind).toBe('ask');
 const bounded=new ApplianceTask('set timer to 20 minutes');
 for(let i=0;i<20;i++) bounded.pressed();
 expect(bounded.next(panel('0:10'),'0:10','en').kind).toBe('ask');
});
it('agent uses appliance intent and existing turn types',async()=>{
 expect(inferIntent('set power to 3','auto')).toBe('task');
 const agent=new AgentSession('set power to 3',{planner:rulesPlanner()});
 const first=await agent.decide(panel('1'),undefined,'1');
 expect(first.action).toMatchObject({kind:'target',element:{id:'plus'}});
 if(first.action.kind!=='target') throw new Error('expected target');
 agent.pressed(first.action.element,panel('2'));
 const second=await agent.decide(panel('2'),undefined,'2');
 expect(second.says[0]?.text).toContain('2');
 expect(second.action.kind).toBe('target');
});

import { SessionPipeline } from '../src/session/pipeline.ts';
import { mockModels } from '../src/models/mock/mock-models.ts';
import { readApplianceDisplay } from '../src/agent/tools.ts';
import type { Keyframe,ServerMessage } from '@fingerpost/protocol';
it('pipeline reads local verify OCR, guides 1→2→3 and finishes without new message types',async()=>{
 let level='1';const sent:ServerMessage[]=[];
 const models=mockModels();
 models.parseScreen=async()=>({layout:panel(level),usage:{inputTokens:0,outputTokens:0},latencyMs:0,promptId:'mock'});
 const pipeline=new SessionPipeline({models,send:m=>sent.push(m)});
 pipeline.onGoal('set power to 3');
 const frame=(purpose:Keyframe['purpose']):Keyframe=>({type:'keyframe',id:`k${level}`,ts:1,kind:'screen',purpose,imageSize:{w:1000,h:500},ocrTokens:[{text:level,box:{u:.1,v:.1,w:.2,h:.1}}]});
 await pipeline.onKeyframe(frame('locate'),new Uint8Array([255,216]));
 expect(sent.at(-1)).toMatchObject({type:'target',elementId:'plus'});
 level='2';await pipeline.onKeyframe(frame('verify'),new Uint8Array([255,216]));
 expect(sent.some(m=>m.type==='say'&&m.text==='Display shows 2.')).toBe(true);
 expect(sent.at(-1)).toMatchObject({type:'target',elementId:'plus'});
 level='3';await pipeline.onKeyframe(frame('verify'),new Uint8Array([255,216]));
 expect(sent.at(-1)).toMatchObject({type:'finish',result:'done'});
});
it('readback refuses OCR outside the display and conflicting/duplicate tokens',()=>{
 const p=panel('P5'), token={text:'P5',box:{u:.1,v:.1,w:.1,h:.1}};
 expect(readApplianceDisplay(p.elements,[token])).toBe('P5');
 expect(readApplianceDisplay(p.elements,[token,token])).toBeNull();
 expect(readApplianceDisplay(p.elements,[{...token,box:{u:.8,v:.8,w:.1,h:.1}}])).toBeNull();
});
it('pipeline asks after an unchanged appliance display',async()=>{
 const models=mockModels(panel('1')),sent:ServerMessage[]=[];
 const pipeline=new SessionPipeline({models,send:m=>sent.push(m)});
 pipeline.onGoal('set power to 3');
 const frame:Keyframe={type:'keyframe',id:'k',ts:1,kind:'screen',purpose:'locate',imageSize:{w:1000,h:500},ocrTokens:[{text:'1',box:{u:.1,v:.1,w:.2,h:.1}}]};
 await pipeline.onKeyframe(frame,new Uint8Array([255,216]));
 await pipeline.onKeyframe({...frame,id:'v',purpose:'verify'},new Uint8Array([255,216]));
 expect(sent.at(-1)).toMatchObject({type:'ask'});
});

it('refuses sensitive layouts and numeric keys even when misclassified as buttons',()=>{
 const sensitive=panel('1');sensitive.sensitivity='financial';
 expect(new ApplianceTask('set power to 3').next(sensitive,'1','en').kind).toBe('ask');
 const numeric=panel('1');numeric.elements.push(element('three','3'));
 expect(new ApplianceTask('set power to 3').next(numeric,'1','en').kind).toBe('ask');
});
