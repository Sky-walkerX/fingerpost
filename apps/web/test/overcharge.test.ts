import { expect, it } from 'vitest';
import { buildFastFood } from '../src/sim/scenes/fastfood.ts';
it('tampered fastfood changes only the displayed payment total',()=>{
  const normal=buildFastFood(1), tampered=buildFastFood(1,'scrambled',true);
  const total=(s:typeof normal)=>s.screens.find(s=>s.id==='pay')!.elements.find(e=>e.id==='total')!;
  expect(total(normal).label).toBe('Total ₹149');
  expect(total(tampered).label).toBe('Total ₹1,490');
  total(tampered).label=total(normal).label;
  expect(tampered).toEqual(normal);
});
