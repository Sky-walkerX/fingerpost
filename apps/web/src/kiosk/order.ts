/** A fictional self-order kiosk used as a live target for the phone app. Pure state: rendering lives in main.ts. */

export type Screen = 'welcome' | 'menu' | 'item' | 'review' | 'payment' | 'card' | 'pin' | 'processing' | 'approved';
export type Size = 'small' | 'medium' | 'large';
export type Category = 'burgers' | 'sides' | 'drinks' | 'desserts';

export interface MenuItem { id: string; name: string; category: Category; price: number; sized: boolean; emoji: string; }
export interface Line { itemId: string; size: Size | null; qty: number; unit: number; }
export interface KioskState {
  screen: Screen; category: Category; itemId: string | null; cart: Line[];
  pinLength: number; overcharge: boolean; orderNo: number; paidBy: 'card' | 'counter' | null; notice: string | null;
}

export type ButtonKind = 'primary' | 'secondary' | 'danger' | 'tab' | 'item' | 'size' | 'key' | 'clear' | 'enter';
export interface KioskButton { id: string; label: string; kind: ButtonKind; selected?: boolean; disabled?: boolean; price?: string; emoji?: string; }
export interface KioskView {
  screen: Screen; title: string; subtitle?: string; texts: string[]; buttons: KioskButton[];
  total?: string; notice?: string; pinDots?: number;
}

export const CATEGORIES: ReadonlyArray<{ id: Category; label: string; emoji: string }> = [
  { id: 'burgers', label: 'Burgers', emoji: '🍔' },
  { id: 'sides', label: 'Sides', emoji: '🍟' },
  { id: 'drinks', label: 'Drinks', emoji: '🥤' },
  { id: 'desserts', label: 'Desserts', emoji: '🍦' },
];

export const MENU: readonly MenuItem[] = [
  { id: 'classic', name: 'Classic Burger', category: 'burgers', price: 650, sized: false, emoji: '🍔' },
  { id: 'cheese', name: 'Cheese Burger', category: 'burgers', price: 720, sized: false, emoji: '🧀' },
  { id: 'veggie', name: 'Veggie Burger', category: 'burgers', price: 690, sized: false, emoji: '🥬' },
  { id: 'chicken', name: 'Chicken Burger', category: 'burgers', price: 740, sized: false, emoji: '🍗' },
  { id: 'fries', name: 'Fries', category: 'sides', price: 280, sized: true, emoji: '🍟' },
  { id: 'rings', name: 'Onion Rings', category: 'sides', price: 320, sized: false, emoji: '🧅' },
  { id: 'salad', name: 'Side Salad', category: 'sides', price: 350, sized: false, emoji: '🥗' },
  { id: 'cola', name: 'Cola', category: 'drinks', price: 180, sized: true, emoji: '🥤' },
  { id: 'lemonade', name: 'Lemonade', category: 'drinks', price: 220, sized: true, emoji: '🍋' },
  { id: 'juice', name: 'Orange Juice', category: 'drinks', price: 260, sized: false, emoji: '🍊' },
  { id: 'water', name: 'Water', category: 'drinks', price: 120, sized: false, emoji: '💧' },
  { id: 'icecream', name: 'Ice Cream', category: 'desserts', price: 240, sized: false, emoji: '🍦' },
  { id: 'pie', name: 'Apple Pie', category: 'desserts', price: 210, sized: false, emoji: '🥧' },
];

const SIZE_EXTRA: Record<Size, number> = { small: 0, medium: 60, large: 110 };
const SIZES: readonly Size[] = ['small', 'medium', 'large'];
/** The tampered-screen demo adds this to every displayed total, never to the order itself. */
const OVERCHARGE = 200;
const PIN_MIN = 4, PIN_MAX = 6, FIRST_ORDER = 47;

export const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
const itemOf = (id: string | null) => MENU.find((m) => m.id === id);
const lineName = (l: Line) => `${l.size ? `${cap(l.size)} ` : ''}${itemOf(l.itemId)!.name}`;

export function newOrder(o: { overcharge?: boolean } = {}): KioskState {
  return { screen: 'welcome', category: 'burgers', itemId: null, cart: [], pinLength: 0,
    overcharge: o.overcharge ?? false, orderNo: FIRST_ORDER, paidBy: null, notice: null };
}

export const cartTotal = (s: KioskState) => s.cart.reduce((sum, l) => sum + l.unit * l.qty, 0);
export const displayedTotal = (s: KioskState) => cartTotal(s) + (s.overcharge && s.cart.length ? OVERCHARGE : 0);

function addLine(s: KioskState, item: MenuItem, size: Size | null): KioskState {
  const unit = item.price + (size ? SIZE_EXTRA[size] : 0);
  const i = s.cart.findIndex((l) => l.itemId === item.id && l.size === size);
  const cart = i < 0 ? [...s.cart, { itemId: item.id, size, qty: 1, unit }]
    : s.cart.map((l, j) => (j === i ? { ...l, qty: l.qty + 1 } : l));
  const added = lineName({ itemId: item.id, size, qty: 1, unit });
  return { ...s, cart, screen: 'menu', itemId: null, notice: `Added ${added}` };
}

/** Applies one button press (or a timed kiosk event such as 'card-read'). Unknown actions return the same state. */
export function press(state: KioskState, action: string): KioskState {
  const s = { ...state, notice: null };
  const [verb, arg] = action.split(':') as [string, string | undefined];
  switch (state.screen) {
    case 'welcome':
      return action === 'start' ? { ...s, screen: 'menu', category: 'burgers' } : state;
    case 'menu': {
      if (verb === 'tab' && CATEGORIES.some((c) => c.id === arg)) return { ...s, category: arg as Category };
      if (verb === 'item' && itemOf(arg ?? null)) return { ...s, screen: 'item', itemId: arg! };
      if (action === 'review') return state.cart.length ? { ...s, screen: 'review' } : state;
      if (action === 'cancel') return { ...newOrder({ overcharge: state.overcharge }), orderNo: state.orderNo };
      return state;
    }
    case 'item': {
      const item = itemOf(state.itemId)!;
      if (action === 'back') return { ...s, screen: 'menu', itemId: null };
      if (!item.sized && action === 'add') return addLine(s, item, null);
      if (item.sized && verb === 'size' && SIZES.includes(arg as Size)) return addLine(s, item, arg as Size);
      return state;
    }
    case 'review':
      if (action === 'pay') return { ...s, screen: 'payment' };
      if (action === 'more') return { ...s, screen: 'menu' };
      if (action === 'cancel') return { ...newOrder({ overcharge: state.overcharge }), orderNo: state.orderNo };
      return state;
    case 'payment':
      if (action === 'pay:card') return { ...s, screen: 'card' };
      if (action === 'pay:counter') return { ...s, screen: 'approved', paidBy: 'counter', cart: [] };
      if (action === 'back') return { ...s, screen: 'review' };
      return state;
    case 'card':
      if (action === 'card-read') return { ...s, screen: 'pin', pinLength: 0 };
      if (action === 'cancel') return { ...s, screen: 'review' };
      return state;
    case 'pin':
      if (verb === 'key' && /^[0-9]$/.test(arg ?? '')) return state.pinLength < PIN_MAX ? { ...s, pinLength: state.pinLength + 1 } : state;
      if (action === 'clear') return { ...s, pinLength: 0 };
      if (action === 'enter') return state.pinLength >= PIN_MIN ? { ...s, screen: 'processing', pinLength: 0 } : state;
      if (action === 'cancel') return { ...s, screen: 'review', pinLength: 0 };
      return state;
    case 'processing':
      return action === 'processed' ? { ...s, screen: 'approved', paidBy: 'card', cart: [] } : state;
    case 'approved':
      return action === 'new' ? { ...newOrder({ overcharge: state.overcharge }), orderNo: state.orderNo + 1 } : state;
  }
}

function summary(s: KioskState): string {
  const n = s.cart.reduce((sum, l) => sum + l.qty, 0);
  return n ? `${n} ${n === 1 ? 'item' : 'items'}, ${money(displayedTotal(s))}` : 'Your order is empty';
}

/** Everything the screen shows, as data. Typed PIN digits never appear here: only their count. */
export function view(s: KioskState): KioskView {
  const total = money(displayedTotal(s));
  const notice = s.notice ? { notice: s.notice } : {};
  switch (s.screen) {
    case 'welcome':
      return { screen: s.screen, title: 'Juniper Grill', subtitle: 'Order here, pay by card or at the counter', texts: [],
        buttons: [{ id: 'start', label: 'Start order', kind: 'primary' }] };
    case 'menu': {
      const cat = CATEGORIES.find((c) => c.id === s.category)!;
      return { screen: s.screen, title: cat.label, texts: [summary(s)], ...notice, buttons: [
        ...CATEGORIES.map((c) => ({ id: `tab:${c.id}`, label: c.label, kind: 'tab' as const, emoji: c.emoji, selected: c.id === s.category })),
        ...MENU.filter((m) => m.category === s.category).map((m) => ({ id: `item:${m.id}`, label: m.name, kind: 'item' as const,
          emoji: m.emoji, price: m.sized ? `from ${money(m.price)}` : money(m.price) })),
        { id: 'cancel', label: 'Cancel order', kind: 'secondary' },
        { id: 'review', label: 'Review order', kind: 'primary', disabled: s.cart.length === 0 },
      ] };
    }
    case 'item': {
      const item = itemOf(s.itemId)!;
      const buttons: KioskButton[] = item.sized
        ? SIZES.map((z) => ({ id: `size:${z}`, label: cap(z), kind: 'size' as const, price: money(item.price + SIZE_EXTRA[z]) }))
        : [{ id: 'add', label: 'Add to order', kind: 'primary', price: money(item.price) }];
      return { screen: s.screen, title: item.name, subtitle: item.sized ? 'Choose a size' : money(item.price), texts: [],
        buttons: [...buttons, { id: 'back', label: 'Back to menu', kind: 'secondary' }] };
    }
    case 'review':
      return { screen: s.screen, title: 'Your order', texts: s.cart.map((l) => `${l.qty > 1 ? `${l.qty} × ` : ''}${lineName(l)} ${money(l.unit * l.qty)}`),
        total, buttons: [
          { id: 'cancel', label: 'Cancel order', kind: 'danger' },
          { id: 'more', label: 'Add more items', kind: 'secondary' },
          { id: 'pay', label: 'Pay now', kind: 'primary' },
        ] };
    case 'payment':
      return { screen: s.screen, title: 'How would you like to pay?', texts: [], total, buttons: [
        { id: 'pay:card', label: 'Pay by card', kind: 'primary', emoji: '💳' },
        { id: 'pay:counter', label: 'Pay at the counter', kind: 'secondary', emoji: '🧾' },
        { id: 'back', label: 'Back', kind: 'secondary' },
      ] };
    case 'card':
      return { screen: s.screen, title: 'Insert, tap or swipe your card', texts: ['Amount due'], total,
        buttons: [{ id: 'cancel', label: 'Cancel payment', kind: 'danger' }] };
    case 'pin':
      return { screen: s.screen, title: 'Enter your PIN', subtitle: 'Cover the keypad while you type', texts: ['Amount'], total,
        pinDots: s.pinLength, buttons: [
          ...['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => ({ id: `key:${d}`, label: d, kind: 'key' as const })),
          { id: 'clear', label: 'Clear', kind: 'clear' },
          { id: 'key:0', label: '0', kind: 'key' },
          { id: 'enter', label: 'Enter', kind: 'enter', disabled: s.pinLength < PIN_MIN },
          { id: 'cancel', label: 'Cancel', kind: 'danger' },
        ] };
    case 'processing':
      return { screen: s.screen, title: 'Processing payment', texts: ['Please wait, do not remove your card'], buttons: [] };
    case 'approved':
      return s.paidBy === 'counter'
        ? { screen: s.screen, title: 'Pay at the counter', subtitle: `Order number ${s.orderNo}`, texts: ['Show this number to the cashier'],
          buttons: [{ id: 'new', label: 'Start new order', kind: 'primary' }] }
        : { screen: s.screen, title: 'Payment approved', subtitle: `Order number ${s.orderNo}`, texts: ['Please take your receipt'],
          buttons: [{ id: 'new', label: 'Start new order', kind: 'primary' }] };
  }
}
