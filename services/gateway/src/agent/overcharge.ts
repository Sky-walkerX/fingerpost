export interface Money { minor: number; currency: string }
const currencies: Record<string,string> = {'₹':'INR',rs:'INR',inr:'INR',rupees:'INR',rupee:'INR','रुपये':'INR','रुपए':'INR','रुपया':'INR','$':'USD',usd:'USD',dollars:'USD','€':'EUR',eur:'EUR',euros:'EUR','£':'GBP',gbp:'GBP'};
const symbols = '₹|rs\\.?|inr|rupees?|रुपये|रुपए|रुपया|\\$|usd|dollars|€|eur|euros|£|gbp';
const pattern = new RegExp(`(${symbols})\\s*([0-9][0-9,]*(?:\\.[0-9]{1,2})?)|([0-9][0-9,]*(?:\\.[0-9]{1,2})?)\\s*(${symbols})`, 'giu');
export function parseMoney(text: string): Money | null {
  const normalized=text.replace(/[०-९٠-٩]/gu,c=>String(c.charCodeAt(0)-(c>='०'&&c<='९'?0x966:0x660)));
  const matches=[...normalized.matchAll(pattern)];
  if(matches.length!==1) return null;
  const m=matches[0]!, currency=currencies[(m[1]??m[4]??'').toLowerCase().replace('.','')];
  const minor=Math.round(Number((m[2]??m[3]??'').replaceAll(',',''))*100);
  return currency&&Number.isSafeInteger(minor)&&minor>=0?{minor,currency}:null;
}
/** Never persisted or logged. Selected prices count only after verified presses. */
export class ExpectedTotal {
  private explicit: Money|null=null;
  private chosen: Money|null=null;
  private mixed=false;
  expect(text: string) { if(/expect|espero|उम्मीद|अपेक्षा/iu.test(text)) this.explicit=parseMoney(text); }
  selected(label: string) {
    const amount=parseMoney(label);
    if(!amount||this.mixed) return;
    if(this.chosen&&this.chosen.currency!==amount.currency) {this.chosen=null;this.mixed=true;return;}
    const minor=(this.chosen?.minor??0)+amount.minor;
    if(!Number.isSafeInteger(minor)) {this.chosen=null;this.mixed=true;return;}
    this.chosen={minor,currency:amount.currency};
  }
  compare(amount: {value:number;currency:string}) {
    const expected=this.explicit??this.chosen;
    const shown={minor:Math.round(amount.value*100),currency:amount.currency};
    return expected&&(expected.minor!==shown.minor||expected.currency!==shown.currency)?{expected:{...expected},shown}:null;
  }
  clear() {this.explicit=null;this.chosen=null;this.mixed=false;}
}
export const moneyText=(m:Money) => `${m.currency} ${(m.minor/100).toFixed(2)}`;
