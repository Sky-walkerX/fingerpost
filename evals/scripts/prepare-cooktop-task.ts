/** Synthetic screenshots and supplied display annotations, never phone OCR/recognition evidence. */
import { chromium } from 'playwright';
import { mkdir,writeFile } from 'node:fs/promises';
const root=new URL('../datasets/private/impact-cooktop/',import.meta.url);
await mkdir(root); // Refuse to replace an existing take.
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:1024,height:640}});
 await page.goto('http://127.0.0.1:5175/sim/?scene=cooktop&seed=1');
 for(let value=1;value<=3;value++) {
  if(await page.locator('.el.text').textContent()!==String(value)) throw new Error('Unexpected synthetic display');
  await page.screenshot({path:new URL(`level-${value}.jpg`,root).pathname,type:'jpeg',quality:80});
  if(value<3) await page.getByText('Plus',{exact:true}).click();
 }
 // Manual glyph bounds on the fixed 1024×640 synthetic canvas; not the whole display rectangle.
 const tokens=(value:number)=>[{text:String(value),box:{u:504/1024,v:190/640,w:16/1024,h:24/640}}];
 const cases=[{id:'cooktop-power-3',image:'level-1.jpg',goal:'set power to 3',kind:'screen',ocrTokens:tokens(1),
  expected:'finish',expectedDisplay:'3',frames:[2,3].map(value=>({image:`level-${value}.jpg`,pressedControl:'Plus',kind:'screen',ocrTokens:tokens(value)}))}];
 await writeFile(new URL('cases.json',root),JSON.stringify(cases,null,2),{flag:'wx',mode:0o600});
 console.log('Prepared synthetic cooktop task in datasets/private/impact-cooktop.');
} finally {await browser.close();}
