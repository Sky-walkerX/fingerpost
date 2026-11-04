import type { Layout, LayoutElement, Locale } from '@fingerpost/protocol';
import { t } from '../i18n/strings.ts';

interface Display {kind:'power'|'timer';value:number}
export function parseDisplay(raw:string):Display|null {
 const text=raw.trim();
 const timer=/^(\d{1,2}):([0-5]\d)$/.exec(text);
 if(timer) return {kind:'timer',value:Number(timer[1])*60+Number(timer[2])};
 const power=/^P?([0-9])$/i.exec(text);
 return power?{kind:'power',value:Number(power[1])}:null;
}
export function applianceGoal(goal:string):Display|null {
 const power=/\b(?:set\s+)?(?:cooktop\s+)?power\s*(?:to\s*)?([1-9])\b/i.exec(goal);
 if(power) return {kind:'power',value:Number(power[1])};
 const timer=/\b(?:set\s+)?(?:microwave\s+(?:to\s*)?|timer\s*(?:to\s*)?)(\d{1,2})\s*(?:minutes?|mins?)\b/i.exec(goal);
 return timer&&Number(timer[1])>0?{kind:'timer',value:Number(timer[1])*60}:null;
}
export type ApplianceStep =
 | {kind:'target';element:LayoutElement;readback?:string}
 | {kind:'ask';readback?:string}
 | {kind:'finish';readback:string};
/** Observed display feedback only. No hidden mode, guessed increments or digit-keypad commands. */
export class ApplianceTask {
 private goal:Display|null;
 private previous:Display|null=null;
 private waiting=false;
 private steps=0;
 constructor(goal:string) {this.goal=applianceGoal(goal);}
 get active() {return this.goal!==null;}
 changed(raw:string|null) {const d=raw===null?null:parseDisplay(raw);return !!d&&!!this.previous&&d.kind===this.previous.kind&&d.value!==this.previous.value;}
 pressed() {this.steps++;}
 next(layout:Layout,raw:string|null,locale:Locale):ApplianceStep {
  const display=raw===null?null:parseDisplay(raw);
  const readback=display?t(locale,'appliance_display',{value:raw!}):undefined;
  const ask=():ApplianceStep=>({kind:'ask',...(readback?{readback}:{})});
  if(!this.goal||!display||display.kind!==this.goal.kind||this.steps>=20||layout.sensitivity!=='none'||layout.elements.some(e=>e.role==='key'||e.role==='input'||(e.role!=='text'&&/^\d$/.test(e.label.trim())))) return ask();
  if(this.waiting&&this.previous&&Math.abs(this.goal.value-display.value)>=Math.abs(this.goal.value-this.previous.value)) return ask();
  this.previous=display;this.waiting=false;
  if(display.value===this.goal.value) return {kind:'finish',readback:readback!};
  // A preset explicitly naming this value is safe; otherwise use a printed Plus/Minus control.
  const preset=layout.elements.find(e=>e.role==='button'&&/^(?:P[1-9]|\d{1,2}:[0-5]\d)$/i.test(e.label.trim())&&parseDisplay(e.label)?.kind===this.goal!.kind&&parseDisplay(e.label)?.value===this.goal!.value);
  const direction=display.value<this.goal.value?'plus':'minus';
  const allowed=direction==='plus'?['plus','+','increase']:['minus','−','-','decrease'];
  const candidates=layout.elements.filter(e=>['button','icon'].includes(e.role)&&allowed.includes(e.label.trim().toLowerCase()));
  const element=preset??(candidates.length===1?candidates[0]:undefined);
  if(!element) return ask();
  this.waiting=true;
  return {kind:'target',element,...(readback?{readback}:{})};
 }
}
