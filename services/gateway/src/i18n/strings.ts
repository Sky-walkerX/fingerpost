import type { ErrorCode, Locale } from '@fingerpost/protocol';

/**
 * Days 4–7 plan, B4-4: every sentence the gateway speaks, in en, hi and es. English is word-for-word the
 * Day 2–5 text. Position words match the phone's (core:guidance OfflinePhrases) so both sides sound alike.
 * Only spoken text lives here; feedback strings for the planner model stay English.
 */
const en = {
  appliance_display: 'Display shows {value}.',
  appliance_stopped: 'The display is unclear or is not moving toward your goal. Check the appliance mode and say what to do next.',
  overcharge_warning: 'Warning: the screen says {shown}, but you chose {expected}. Say yes to continue, or cancel.',
  local_speech: 'Private speech stays on this phone.',
  found: 'Found {label}, {position}.',
  found_short: 'Found {label}.',
  i_see: 'I see {labels}.',
  nothing: 'nothing',
  nothing_to_read: 'nothing I can read',
  nothing_to_press: 'nothing I can press',
  ask_which: 'I see {labels}. Which one?',
  ask_not_found: "I can't find that. I see {labels}. What do you want to press?",
  ask_which_one: 'Which one: {options}?',
  not_found_here: "I can't find that here. I see {labels}.",
  looking: 'Looking at the screen.',
  new_screen: 'New screen. I see {labels}.',
  no_screen: "I can't find the screen. Hold the phone steady and try again.",
  target_unclear: 'Move closer so I can see the button clearly.',
  button_not_found: "I can't find that touch button. Say another button name, or say read the screen.",
  press_only: "Choose a touch button. I can't guide turning or sliding controls.",
  explore_empty: "I can't read anything on this screen. Hold the phone steady and try again.",
  pressed_other: "That pressed something else. Let's find {label} again.",
  verify_done: 'Done.',
  verify_nochange: "The screen didn't change. Press a little firmer.",
  private_unavailable: "Private mode isn't available right now. Turn it off in settings to continue.",
  pin_ready: 'PIN entry is ready.',
  payment_not_confirmed: 'Payment not confirmed.',
  stopped: 'Stopped.',
  not_caught: "I didn't catch that. Please say it again.",
  offline: 'Cloud features are paused; basic mode still works.',
  order_done: 'Done. Your order went through.',
  too_many_steps: 'This is taking too many steps. Please ask someone nearby for help.',
  no_back: "I can't find a Back button.",
  ask_go_back: 'This screen keeps coming back. Should I go back?',
  yes: 'Yes',
  no: 'No',
  not_sure_next: "I'm not sure what to press next. Please ask someone nearby for help.",
  confirm_first: 'I need you to confirm the amount first.',
  your_order: 'Your order',
  and: 'and',
  or: 'or',
  pos_top: 'top',
  pos_middle: 'middle',
  pos_bottom: 'bottom',
  pos_left: 'left',
  pos_right: 'right',
  pos_format: '{row} {col}',
  err_auth_expired: 'Reconnecting.',
  err_quota_exhausted: "You've used today's free tasks. Basic offline mode still works.",
  err_cloud_paused: 'Cloud features are paused today. Basic offline mode still works.',
  err_rate_limited: 'One moment.',
  err_model_unavailable: "I couldn't reach the reading service. Try again in a moment.",
  err_bad_message: 'Something went wrong talking to the server.',
  err_version_unsupported: 'Please update Fingerpost to keep using it.',
};
export type StringKey = keyof typeof en;

const hi: Record<StringKey, string> = {
  appliance_display: 'डिस्प्ले पर {value} है।',
  appliance_stopped: 'डिस्प्ले स्पष्ट नहीं है या लक्ष्य की ओर नहीं बदल रहा। उपकरण का मोड जाँचें और अगला कदम बताएँ।',
  overcharge_warning: 'चेतावनी: स्क्रीन पर {shown} है, लेकिन आपने {expected} चुना था। जारी रखने के लिए हाँ कहें, या रद्द करें।',
  local_speech: 'प्राइवेट आवाज़ पहचान इसी फ़ोन पर होती है।',
  found: '{label} मिला, {position}।',
  found_short: '{label} मिला।',
  i_see: 'मुझे {labels} दिख रहे हैं।',
  nothing: 'कुछ नहीं',
  nothing_to_read: 'कुछ भी पढ़ने लायक नहीं',
  nothing_to_press: 'कुछ भी दबाने लायक नहीं',
  ask_which: 'मुझे {labels} दिख रहे हैं। कौन सा?',
  ask_not_found: 'मुझे वह नहीं मिला। मुझे {labels} दिख रहे हैं। आप क्या दबाना चाहते हैं?',
  ask_which_one: 'कौन सा: {options}?',
  not_found_here: 'मुझे यहाँ वह नहीं मिला। मुझे {labels} दिख रहे हैं।',
  looking: 'स्क्रीन देख रहा हूँ।',
  new_screen: 'नई स्क्रीन। मुझे {labels} दिख रहे हैं।',
  no_screen: 'मुझे स्क्रीन नहीं मिली। फ़ोन को स्थिर रखें और फिर से कोशिश करें।',
  target_unclear: 'फ़ोन थोड़ा पास लाएं ताकि बटन साफ़ दिखे।',
  button_not_found: 'वह टच बटन नहीं मिला। किसी दूसरे बटन का नाम कहें, या स्क्रीन पढ़ने को कहें।',
  press_only: 'कोई टच बटन चुनें। मैं घुमाने या खिसकाने वाले कंट्रोल पर मार्गदर्शन नहीं दे सकता।',
  explore_empty: 'मैं इस स्क्रीन पर कुछ भी नहीं पढ़ सका। फ़ोन को स्थिर रखें और फिर से कोशिश करें।',
  pressed_other: 'कुछ और दब गया। चलिए {label} फिर से ढूंढते हैं।',
  verify_done: 'हो गया।',
  verify_nochange: 'स्क्रीन नहीं बदली। थोड़ा ज़ोर से दबाएं।',
  private_unavailable: 'प्राइवेट मोड अभी उपलब्ध नहीं है। आगे बढ़ने के लिए सेटिंग्स में इसे बंद करें।',
  pin_ready: 'PIN डालने के लिए तैयार है।',
  payment_not_confirmed: 'भुगतान की पुष्टि नहीं हुई।',
  stopped: 'रोक दिया।',
  not_caught: 'मैं समझ नहीं पाया। कृपया फिर से कहें।',
  offline: 'क्लाउड सुविधाएं रुकी हुई हैं; बेसिक मोड अब भी काम करता है।',
  order_done: 'हो गया। आपका ऑर्डर पूरा हुआ।',
  too_many_steps: 'इसमें बहुत ज़्यादा कदम लग रहे हैं। कृपया पास में किसी से मदद मांगें।',
  no_back: 'मुझे वापस जाने का बटन नहीं मिला।',
  ask_go_back: 'यही स्क्रीन बार-बार आ रही है। क्या मैं वापस जाऊँ?',
  yes: 'हाँ',
  no: 'नहीं',
  not_sure_next: 'मुझे पक्का नहीं पता कि आगे क्या दबाना है। कृपया पास में किसी से मदद मांगें।',
  confirm_first: 'पहले मुझे आपसे राशि की पुष्टि चाहिए।',
  your_order: 'आपका ऑर्डर',
  and: 'और',
  or: 'या',
  pos_top: 'ऊपर',
  pos_middle: 'बीच में',
  pos_bottom: 'नीचे',
  pos_left: 'बाईं ओर',
  pos_right: 'दाईं ओर',
  pos_format: '{row} {col}',
  err_auth_expired: 'फिर से जुड़ रहा हूँ।',
  err_quota_exhausted: 'आज के मुफ़्त काम खत्म हो गए। बेसिक ऑफ़लाइन मोड अब भी काम करता है।',
  err_cloud_paused: 'क्लाउड सुविधाएं आज रुकी हुई हैं। बेसिक ऑफ़लाइन मोड अब भी काम करता है।',
  err_rate_limited: 'एक पल।',
  err_model_unavailable: 'मैं पढ़ने वाली सेवा तक नहीं पहुँच सका। थोड़ी देर में फिर कोशिश करें।',
  err_bad_message: 'सर्वर से बात करने में कुछ गड़बड़ हुई।',
  err_version_unsupported: 'Fingerpost इस्तेमाल करते रहने के लिए कृपया इसे अपडेट करें।',
};

const es: Record<StringKey, string> = {
  appliance_display: 'La pantalla muestra {value}.',
  appliance_stopped: 'La pantalla no está clara o no avanza hacia tu objetivo. Comprueba el modo del aparato y di qué hacer.',
  overcharge_warning: 'Aviso: la pantalla dice {shown}, pero elegiste {expected}. Di sí para continuar o cancelar.',
  local_speech: 'El reconocimiento de voz privado se queda en este teléfono.',
  found: 'Encontré {label}, {position}.',
  found_short: 'Encontré {label}.',
  i_see: 'Veo {labels}.',
  nothing: 'nada',
  nothing_to_read: 'nada que pueda leer',
  nothing_to_press: 'nada que pueda pulsar',
  ask_which: 'Veo {labels}. ¿Cuál?',
  ask_not_found: 'No lo encuentro. Veo {labels}. ¿Qué quieres pulsar?',
  ask_which_one: '¿Cuál: {options}?',
  not_found_here: 'No lo encuentro aquí. Veo {labels}.',
  looking: 'Mirando la pantalla.',
  new_screen: 'Pantalla nueva. Veo {labels}.',
  no_screen: 'No encuentro la pantalla. Mantén el teléfono quieto e inténtalo de nuevo.',
  target_unclear: 'Acerca el teléfono para que pueda ver el botón con claridad.',
  button_not_found: 'No encuentro ese botón táctil. Di otro nombre de botón o pide leer la pantalla.',
  press_only: 'Elige un botón táctil. No puedo guiar controles que se giran o deslizan.',
  explore_empty: 'No puedo leer nada en esta pantalla. Mantén el teléfono quieto e inténtalo de nuevo.',
  pressed_other: 'Eso pulsó otra cosa. Busquemos {label} otra vez.',
  verify_done: 'Hecho.',
  verify_nochange: 'La pantalla no cambió. Pulsa un poco más firme.',
  private_unavailable: 'El modo privado no está disponible ahora. Desactívalo en los ajustes para continuar.',
  pin_ready: 'Listo para introducir el PIN.',
  payment_not_confirmed: 'Pago no confirmado.',
  stopped: 'Detenido.',
  not_caught: 'No te entendí. Dilo otra vez, por favor.',
  offline: 'Las funciones en la nube están en pausa; el modo básico sigue funcionando.',
  order_done: 'Hecho. Tu pedido se completó.',
  too_many_steps: 'Esto está llevando demasiados pasos. Pide ayuda a alguien cercano.',
  no_back: 'No encuentro un botón de volver.',
  ask_go_back: 'Esta pantalla sigue apareciendo. ¿Vuelvo atrás?',
  yes: 'Sí',
  no: 'No',
  not_sure_next: 'No sé qué pulsar ahora. Pide ayuda a alguien cercano.',
  confirm_first: 'Primero necesito que confirmes el importe.',
  your_order: 'Tu pedido',
  and: 'y',
  or: 'o',
  pos_top: 'arriba',
  pos_middle: 'en el centro',
  pos_bottom: 'abajo',
  pos_left: 'izquierda',
  pos_right: 'derecha',
  pos_format: '{row}, a la {col}',
  err_auth_expired: 'Reconectando.',
  err_quota_exhausted: 'Ya usaste las tareas gratuitas de hoy. El modo básico sin conexión sigue funcionando.',
  err_cloud_paused: 'Las funciones en la nube están en pausa hoy. El modo básico sin conexión sigue funcionando.',
  err_rate_limited: 'Un momento.',
  err_model_unavailable: 'No pude conectar con el servicio de lectura. Inténtalo de nuevo en un momento.',
  err_bad_message: 'Algo salió mal al hablar con el servidor.',
  err_version_unsupported: 'Actualiza Fingerpost para seguir usándolo.',
};

export const STRINGS: Record<Locale, Record<StringKey, string>> = { en, hi, es };

/** The sentence for [key] in [locale], with each {name} replaced by vars[name]. */
export function t(locale: Locale, key: StringKey, vars: Record<string, string> = {}): string {
  return STRINGS[locale][key].replace(/\{(\w+)\}/g, (whole, name: string) => vars[name] ?? whole);
}

/** "a, b and c" / "a, b o c": no serial comma, like the English Day 2 lists. */
export function joinList(items: readonly string[], word: 'and' | 'or', locale: Locale): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} ${t(locale, word)} ${items.at(-1)}`;
}

/** "bottom right" … "middle": thirds of the polygon's vertex mean (resolve/describe.ts). */
export function positionWords(polygon: readonly { u: number; v: number }[], locale: Locale): string {
  const u = polygon.reduce((sum, p) => sum + p.u, 0) / polygon.length;
  const v = polygon.reduce((sum, p) => sum + p.v, 0) / polygon.length;
  const row = t(locale, v < 1 / 3 ? 'pos_top' : v > 2 / 3 ? 'pos_bottom' : 'pos_middle');
  const col = u < 1 / 3 ? 'pos_left' : u > 2 / 3 ? 'pos_right' : null;
  return col ? t(locale, 'pos_format', { row, col: t(locale, col) }) : row;
}

const RETRYABLE: Record<ErrorCode, boolean> = {
  auth_expired: true, quota_exhausted: false, cloud_paused: false, rate_limited: true,
  model_unavailable: true, bad_message: false, version_unsupported: false,
};

/** An error's spoken text and retry flag in the session's language (docs/protocol.md error codes). */
export function spokenError(code: ErrorCode, locale: Locale): { say: string; retryable: boolean } {
  return { say: t(locale, `err_${code}` as StringKey), retryable: RETRYABLE[code] };
}
