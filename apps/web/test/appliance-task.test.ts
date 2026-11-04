import { expect,it } from 'vitest';
import { buildCooktop } from '../src/sim/scenes/cooktop.ts';
import { newRun,currentScreen,applyTouch } from '../src/sim/log.ts';
it('cooktop Plus/Minus update a visible display one press at a time',()=>{
 const run=newRun('test',buildCooktop(1));
 const display=()=>currentScreen(run).elements.find(e=>e.id==='display')!.label;
 const press=(id:string)=>{const e=currentScreen(run).elements.find(e=>e.id===id)!;applyTouch(run,{x:e.rect.x+e.rect.w/2,y:e.rect.y+e.rect.h/2,pointerId:1,ts:1});};
 expect(display()).toBe('1');press('plus');expect(display()).toBe('2');press('plus');expect(display()).toBe('3');press('minus');expect(display()).toBe('2');
});
