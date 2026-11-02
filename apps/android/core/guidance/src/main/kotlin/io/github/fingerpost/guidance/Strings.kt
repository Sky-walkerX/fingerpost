package io.github.fingerpost.guidance

import java.util.Locale

/**
 * All localized string keys for guidance prompts, phrases, and task turns.
 * Used across English, Hindi, and Spanish (A4-4).
 */
enum class Key {
    MOVE_FINGER, CHEST_FRAME, CHEST_CLOSER, CHEST_BACK,
    // Prompts (GuidanceStateMachine)
    ASK_GOAL,
    ASK_GOAL_AGAIN,
    GIVE_UP_LISTENING,
    FRAMING_TIPS,
    LOCATE_FAILED,
    RAISE_FINGER,
    TAP,
    PRESS_NOW,
    OFFER_EXPLORE,
    HOLD_STEADY,

    // Phrases (Cue directions and qualifiers)
    DIR_UP,
    DIR_DOWN,
    DIR_LEFT,
    DIR_RIGHT,
    DIR_FORWARD,
    DIR_BACK,
    UP,
    DOWN,
    LEFT,
    RIGHT,
    FORWARD,
    BACK,
    SLOW_DOWN,
    A_LOT,
    A_LITTLE,
    AND,

    // TaskPrompts (A4-1 task turns)
    SAY_YES_OR_NO,
    PAYMENT_NOT_CONFIRMED,
    CONFIRM_FIRST,
    LOST_TRACK,
    ASK_AGAIN_GIVE_UP,
    DONE,

    // A4-3 Keypad & PIN mode
    KEYPAD_PHONE,
    KEYPAD_CALCULATOR,
    KEYPAD_SCRAMBLED,
    CONNECT_EARPHONES,
    EARPHONES_DISCONNECTED,
    PIN_PAD_DETECTED,
    BACK_ONLINE,

    // A4-4 TTS missing voice notices (spoken in English per spec)
    HINDI_VOICE_MISSING,
    SPANISH_VOICE_MISSING,

    // Verification & guidance messages
    SCREEN_NO_CHANGE,
    CAMERA_TRACKING_FAILED,
    MIC_PERMISSION_NEEDED,
    GLARE_WARNING,
    UNCERTAIN_PREFIX,
    UNCERTAIN_SUFFIX,

    // A5-1 explore and touch-explore
    EXPLORE_HINT,
    TOUCH_EXPLORE_ON,
    TOUCH_EXPLORE_NEEDS_SCREEN,
    TEXT_PREFIX,

    // A6-1 offline basic mode
    POS_TOP,
    POS_MIDDLE,
    POS_BOTTOM,
    POS_LEFT,
    POS_RIGHT,
    POS_FORMAT,
    OFFLINE_FOUND,
    OFFLINE_WHICH,
    OFFLINE_NOT_FOUND,
    OFFLINE_NOT_FOUND_EMPTY,
    BASIC_MODE,
    ICON_NEEDS_CLOUD,
    OFFLINE_DWELL_DONE,
    OFFLINE_ASR_UNAVAILABLE,
    UPDATE_AVAILABLE,
    SPEECH_UNAVAILABLE,
    CAMERA_RECOVERY,
    FRAME_NO_SCREEN,
    FRAME_CUT_LEFT,
    FRAME_CUT_RIGHT,
    FRAME_CUT_TOP,
    FRAME_CUT_BOTTOM,
    FRAME_MOVE_CLOSER,
    FRAME_MOVE_BACK,
    FRAME_MOVE_LEFT,
    FRAME_MOVE_RIGHT,
    FRAME_MOVE_UP,
    FRAME_MOVE_DOWN,
}

typealias StringKey = Key

/**
 * Localized guidance strings for English, Hindi and Spanish (A4-4).
 */
object Strings {
    val HI: Locale = Locale.forLanguageTag("hi")
    val ES: Locale = Locale.forLanguageTag("es")
    val EN: Locale = Locale.ENGLISH

    private val en: Map<Key, String> = mapOf(
        Key.MOVE_FINGER to "Move your finger",
        Key.CHEST_FRAME to "Stand about an arm's length from the screen and point your chest-mounted camera at it.",
        Key.CHEST_CLOSER to "Step closer.",
        Key.CHEST_BACK to "Step back a little.",
        Key.ASK_GOAL to "What do you want to press?",
        Key.ASK_GOAL_AGAIN to "Say what you want to press, for example: start.",
        Key.GIVE_UP_LISTENING to "Tap the screen when you're ready.",
        Key.FRAMING_TIPS to "Hold the phone about an arm's length from the screen, and point it straight at it.",
        Key.LOCATE_FAILED to "I couldn't read the screen. Let's try again.",
        Key.RAISE_FINGER to "Raise your pointing finger into view.",
        Key.TAP to "Tap.",
        Key.PRESS_NOW to "Press now.",
        Key.OFFER_EXPLORE to "Having trouble? Say explore to hear what's on the screen.",
        Key.HOLD_STEADY to "Hold the phone steady.",

        Key.DIR_UP to "up",
        Key.DIR_DOWN to "down",
        Key.DIR_LEFT to "left",
        Key.DIR_RIGHT to "right",
        Key.DIR_FORWARD to "forward",
        Key.DIR_BACK to "back",
        Key.UP to "up",
        Key.DOWN to "down",
        Key.LEFT to "left",
        Key.RIGHT to "right",
        Key.FORWARD to "forward",
        Key.BACK to "back",
        Key.SLOW_DOWN to "Slow down.",
        Key.A_LOT to "a lot",
        Key.A_LITTLE to "a little",
        Key.AND to "and",

        Key.SAY_YES_OR_NO to "Say yes to pay, or no to cancel.",
        Key.PAYMENT_NOT_CONFIRMED to "Payment not confirmed.",
        Key.CONFIRM_FIRST to "I need you to confirm the amount first.",
        Key.LOST_TRACK to "I lost track. What do you want to do?",
        Key.ASK_AGAIN_GIVE_UP to "Tell me what you want to do.",
        Key.DONE to "Done.",

        Key.KEYPAD_PHONE to "Phone layout. 5 is in the centre.",
        Key.KEYPAD_CALCULATOR to "Calculator layout. 5 is in the centre.",
        Key.KEYPAD_SCRAMBLED to "The keys are scrambled. Slide your finger and I'll say each digit.",
        Key.CONNECT_EARPHONES to "Connect earphones for PIN help.",
        Key.EARPHONES_DISCONNECTED to "Earphones disconnected. Connect earphones for PIN help.",
        Key.PIN_PAD_DETECTED to "PIN pad detected. I'll stay offline while you enter it.",
        Key.BACK_ONLINE to "Back online.",

        Key.HINDI_VOICE_MISSING to "Hindi voice not installed; using English.",
        Key.SPANISH_VOICE_MISSING to "Spanish voice not installed; using English.",

        Key.SCREEN_NO_CHANGE to "The screen didn't change. Press a little firmer.",
        Key.CAMERA_TRACKING_FAILED to "Camera tracking couldn't start.",
        Key.MIC_PERMISSION_NEEDED to "Microphone access is needed. Open settings to allow it.",
        Key.GLARE_WARNING to "There's glare. Tilt the phone a little.",
        Key.UNCERTAIN_PREFIX to "I think this is",
        Key.UNCERTAIN_SUFFIX to "but I'm not sure.",
        Key.EXPLORE_HINT to "Say more, touch explore, or what you want to press.",
        Key.TOUCH_EXPLORE_ON to "Touch explore on. Slide your finger over the screen.",
        Key.TOUCH_EXPLORE_NEEDS_SCREEN to "Say explore first, so I can read the screen.",
        Key.TEXT_PREFIX to "Text",
        Key.POS_TOP to "top",
        Key.POS_MIDDLE to "middle",
        Key.POS_BOTTOM to "bottom",
        Key.POS_LEFT to "left",
        Key.POS_RIGHT to "right",
        Key.POS_FORMAT to "{row} {col}",
        Key.OFFLINE_FOUND to "Found {label}, {position}.",
        Key.OFFLINE_WHICH to "I see {a} and {b}. Which one?",
        Key.OFFLINE_NOT_FOUND to "I can't find {goal}. I can see {list}.",
        Key.OFFLINE_NOT_FOUND_EMPTY to "I can't find {goal}. Point the phone at the screen.",
        Key.BASIC_MODE to "Basic mode: text buttons only.",
        Key.ICON_NEEDS_CLOUD to "Icons need the cloud. In basic mode I can only find buttons with words on them.",
        Key.OFFLINE_DWELL_DONE to "I think that pressed it.",
        Key.OFFLINE_ASR_UNAVAILABLE to "Offline speech isn't set up on this phone. Turn on offline speech recognition in Android settings.",
        Key.UPDATE_AVAILABLE to "An update is available",
        Key.SPEECH_UNAVAILABLE to "Speech unavailable. Reopen Fingerpost.",
        Key.CAMERA_RECOVERY to "Camera tracking couldn't start. Reopen Fingerpost.",
        Key.FRAME_NO_SCREEN to "I can't see a screen. Point the phone at it.",
        Key.FRAME_CUT_LEFT to "The screen's left edge is cut off. Move the phone left.",
        Key.FRAME_CUT_RIGHT to "The screen's right edge is cut off. Move the phone right.",
        Key.FRAME_CUT_TOP to "The screen's top edge is cut off. Move the phone up.",
        Key.FRAME_CUT_BOTTOM to "The screen's bottom edge is cut off. Move the phone down.",
        Key.FRAME_MOVE_CLOSER to "Move closer.",
        Key.FRAME_MOVE_BACK to "Move back a little.",
        Key.FRAME_MOVE_LEFT to "Move the phone left.",
        Key.FRAME_MOVE_RIGHT to "Move the phone right.",
        Key.FRAME_MOVE_UP to "Move the phone up.",
        Key.FRAME_MOVE_DOWN to "Move the phone down.",
    )

    private val hi: Map<Key, String> = mapOf(
        Key.MOVE_FINGER to "अपनी उंगली ले जाएँ",
        Key.CHEST_FRAME to "स्क्रीन से लगभग एक हाथ की दूरी पर खड़े हों और सीने पर लगे कैमरे को उसकी ओर करें।",
        Key.CHEST_CLOSER to "थोड़ा पास जाएँ।",
        Key.CHEST_BACK to "थोड़ा पीछे जाएँ।",
        Key.ASK_GOAL to "आप क्या दबाना चाहते हैं?",
        Key.ASK_GOAL_AGAIN to "बताएं कि आप क्या दबाना चाहते हैं, उदाहरण के लिए: स्टार्ट।",
        Key.GIVE_UP_LISTENING to "तैयार होने पर स्क्रीन पर टैप करें।",
        Key.FRAMING_TIPS to "फ़ोन को स्क्रीन से लगभग एक हाथ की दूरी पर रखें, और इसे सीधे उसकी ओर रखें।",
        Key.LOCATE_FAILED to "मैं स्क्रीन नहीं पढ़ सका। फिर से प्रयास करें।",
        Key.RAISE_FINGER to "अपनी तर्जनी उंगली को सामने लाएं।",
        Key.TAP to "टैप करें।",
        Key.PRESS_NOW to "अब दबाएं।",
        Key.OFFER_EXPLORE to "परेशानी हो रही है? स्क्रीन पर क्या है सुनने के लिए एक्सप्लोर कहें।",
        Key.HOLD_STEADY to "फ़ोन को स्थिर रखें।",

        Key.DIR_UP to "ऊपर",
        Key.DIR_DOWN to "नीचे",
        Key.DIR_LEFT to "बाएं",
        Key.DIR_RIGHT to "दाएं",
        Key.DIR_FORWARD to "आगे",
        Key.DIR_BACK to "पीछे",
        Key.UP to "ऊपर",
        Key.DOWN to "नीचे",
        Key.LEFT to "बाएं",
        Key.RIGHT to "दाएं",
        Key.FORWARD to "आगे",
        Key.BACK to "पीछे",
        Key.SLOW_DOWN to "धीमे करें।",
        Key.A_LOT to "काफ़ी",
        Key.A_LITTLE to "थोड़ा",
        Key.AND to "और",

        Key.SAY_YES_OR_NO to "भुगतान के लिए हाँ, या रद्द करने के लिए नहीं कहें।",
        Key.PAYMENT_NOT_CONFIRMED to "भुगतान की पुष्टि नहीं हुई।",
        Key.CONFIRM_FIRST to "मुझे पहले आपसे राशि की पुष्टि चाहिए।",
        Key.LOST_TRACK to "संपर्क टूट गया। आप क्या करना चाहते हैं?",
        Key.ASK_AGAIN_GIVE_UP to "मुझे बताएं कि आप क्या करना चाहते हैं।",
        Key.DONE to "हो गया।",

        Key.KEYPAD_PHONE to "फ़ोन लेआउट। 5 केंद्र में है।",
        Key.KEYPAD_CALCULATOR to "कैलकुलेटर लेआउट। 5 केंद्र में है।",
        Key.KEYPAD_SCRAMBLED to "कुंजियाँ बदली हुई हैं। अपनी उंगली फिसलाएं और मैं प्रत्येक अंक बोलूंगा।",
        Key.CONNECT_EARPHONES to "पिन सहायता के लिए इयरफ़ोन कनेक्ट करें।",
        Key.EARPHONES_DISCONNECTED to "इयरफ़ोन डिस्कनेक्ट हो गए। पिन सहायता के लिए इयरफ़ोन कनेक्ट करें।",
        Key.PIN_PAD_DETECTED to "पिन पैड मिला। आपके दर्ज करते समय मैं ऑफ़लाइन रहूँगा।",
        Key.BACK_ONLINE to "वापस ऑनलाइन।",

        Key.HINDI_VOICE_MISSING to "Hindi voice not installed; using English.",
        Key.SPANISH_VOICE_MISSING to "Spanish voice not installed; using English.",

        Key.SCREEN_NO_CHANGE to "स्क्रीन नहीं बदली। थोड़ा और ज़ोर से दबाएं।",
        Key.CAMERA_TRACKING_FAILED to "कैमरा ट्रैकिंग शुरू नहीं हो सकी।",
        Key.MIC_PERMISSION_NEEDED to "माइक्रोफ़ोन एक्सेस आवश्यक है। अनुमति देने के लिए सेटिंग्स खोलें।",
        Key.GLARE_WARNING to "चमक आ रही है। फ़ोन को थोड़ा झुकाएं।",
        Key.UNCERTAIN_PREFIX to "मुझे लगता है यह",
        Key.UNCERTAIN_SUFFIX to "लेकिन मुझे पक्का यकीन नहीं है।",
        Key.EXPLORE_HINT to "आगे सुनने के लिए और कहें, उंगली से जानने के लिए टच एक्सप्लोर कहें, या बताएं कि क्या दबाना है।",
        Key.TOUCH_EXPLORE_ON to "टच एक्सप्लोर चालू है। स्क्रीन पर उंगली फिराएं।",
        Key.TOUCH_EXPLORE_NEEDS_SCREEN to "पहले एक्सप्लोर कहें, ताकि मैं स्क्रीन पढ़ सकूं।",
        Key.TEXT_PREFIX to "टेक्स्ट",
        Key.POS_TOP to "ऊपर",
        Key.POS_MIDDLE to "बीच में",
        Key.POS_BOTTOM to "नीचे",
        Key.POS_LEFT to "बाईं ओर",
        Key.POS_RIGHT to "दाईं ओर",
        Key.POS_FORMAT to "{row} {col}",
        Key.OFFLINE_FOUND to "{label} मिला, {position}।",
        Key.OFFLINE_WHICH to "मुझे {a} और {b} दिख रहे हैं। कौन सा?",
        Key.OFFLINE_NOT_FOUND to "मुझे {goal} नहीं मिला। मुझे {list} दिख रहे हैं।",
        Key.OFFLINE_NOT_FOUND_EMPTY to "मुझे {goal} नहीं मिला। फ़ोन को स्क्रीन की ओर करें।",
        Key.BASIC_MODE to "बेसिक मोड: सिर्फ़ शब्दों वाले बटन।",
        Key.ICON_NEEDS_CLOUD to "आइकन के लिए क्लाउड चाहिए। बेसिक मोड में मैं सिर्फ़ शब्दों वाले बटन ढूंढ सकता हूँ।",
        Key.OFFLINE_DWELL_DONE to "मुझे लगता है यह दब गया।",
        Key.OFFLINE_ASR_UNAVAILABLE to "इस फ़ोन पर ऑफ़लाइन आवाज़ पहचान चालू नहीं है। Android सेटिंग्स में इसे चालू करें।",
        Key.UPDATE_AVAILABLE to "एक अपडेट उपलब्ध है",
        Key.SPEECH_UNAVAILABLE to "आवाज़ उपलब्ध नहीं है। Fingerpost फिर से खोलें।",
        Key.CAMERA_RECOVERY to "कैमरा ट्रैकिंग शुरू नहीं हो सकी। Fingerpost फिर से खोलें।",
        Key.FRAME_NO_SCREEN to "स्क्रीन नहीं दिख रही है। फ़ोन को उसकी ओर करें।",
        Key.FRAME_CUT_LEFT to "स्क्रीन का बायां किनारा कट रहा है। फ़ोन को बाईं ओर करें।",
        Key.FRAME_CUT_RIGHT to "स्क्रीन का दायां किनारा कट रहा है। फ़ोन को दाईं ओर करें।",
        Key.FRAME_CUT_TOP to "स्क्रीन का ऊपर का किनारा कट रहा है। फ़ोन को ऊपर करें।",
        Key.FRAME_CUT_BOTTOM to "स्क्रीन का नीचे का किनारा कट रहा है। फ़ोन को नीचे करें।",
        Key.FRAME_MOVE_CLOSER to "थोड़ा पास आएं।",
        Key.FRAME_MOVE_BACK to "थोड़ा पीछे जाएं।",
        Key.FRAME_MOVE_LEFT to "फ़ोन को बाईं ओर करें।",
        Key.FRAME_MOVE_RIGHT to "फ़ोन को दाईं ओर करें।",
        Key.FRAME_MOVE_UP to "फ़ोन को ऊपर करें।",
        Key.FRAME_MOVE_DOWN to "फ़ोन को नीचे करें।",
    )

    private val es: Map<Key, String> = mapOf(
        Key.MOVE_FINGER to "Mueve el dedo",
        Key.CHEST_FRAME to "Ponte a un brazo de distancia de la pantalla y apunta la cámara del pecho hacia ella.",
        Key.CHEST_CLOSER to "Da un paso hacia la pantalla.",
        Key.CHEST_BACK to "Da un paso atrás.",
        Key.ASK_GOAL to "¿Qué quieres pulsar?",
        Key.ASK_GOAL_AGAIN to "Di qué quieres pulsar, por ejemplo: iniciar.",
        Key.GIVE_UP_LISTENING to "Toca la pantalla cuando estés listo.",
        Key.FRAMING_TIPS to "Sostén el teléfono a la distancia de un brazo de la pantalla y apunta directamente hacia ella.",
        Key.LOCATE_FAILED to "No pude leer la pantalla. Intentémoslo de nuevo.",
        Key.RAISE_FINGER to "Levanta el dedo índice a la vista.",
        Key.TAP to "Toca.",
        Key.PRESS_NOW to "Pulsa ahora.",
        Key.OFFER_EXPLORE to "¿Tienes problemas? Di explorar para escuchar lo que hay en la pantalla.",
        Key.HOLD_STEADY to "Mantén el teléfono quieto.",

        Key.DIR_UP to "arriba",
        Key.DIR_DOWN to "abajo",
        Key.DIR_LEFT to "izquierda",
        Key.DIR_RIGHT to "derecha",
        Key.DIR_FORWARD to "adelante",
        Key.DIR_BACK to "atrás",
        Key.UP to "arriba",
        Key.DOWN to "abajo",
        Key.LEFT to "izquierda",
        Key.RIGHT to "derecha",
        Key.FORWARD to "adelante",
        Key.BACK to "atrás",
        Key.SLOW_DOWN to "Más despacio.",
        Key.A_LOT to "mucho",
        Key.A_LITTLE to "un poco",
        Key.AND to "y",

        Key.SAY_YES_OR_NO to "Di sí para pagar, o no para cancelar.",
        Key.PAYMENT_NOT_CONFIRMED to "Pago no confirmado.",
        Key.CONFIRM_FIRST to "Primero necesito que confirmes el importe.",
        Key.LOST_TRACK to "He perdido el hilo. ¿Qué quieres hacer?",
        Key.ASK_AGAIN_GIVE_UP to "Dime qué quieres hacer.",
        Key.DONE to "Hecho.",

        Key.KEYPAD_PHONE to "Disposición telefónica. El 5 está en el centro.",
        Key.KEYPAD_CALCULATOR to "Disposición de calculadora. El 5 está en el centro.",
        Key.KEYPAD_SCRAMBLED to "Las teclas están desordenadas. Desliza el dedo y diré cada dígito.",
        Key.CONNECT_EARPHONES to "Conecta auriculares para ayuda con el PIN.",
        Key.EARPHONES_DISCONNECTED to "Auriculares desconectados. Conecta auriculares para ayuda con el PIN.",
        Key.PIN_PAD_DETECTED to "Teclado PIN detectado. Permaneceré sin conexión mientras lo introduces.",
        Key.BACK_ONLINE to "De nuevo en línea.",

        Key.HINDI_VOICE_MISSING to "Hindi voice not installed; using English.",
        Key.SPANISH_VOICE_MISSING to "Spanish voice not installed; using English.",

        Key.SCREEN_NO_CHANGE to "La pantalla no ha cambiado. Pulsa un poco más firme.",
        Key.CAMERA_TRACKING_FAILED to "No se pudo iniciar el seguimiento de cámara.",
        Key.MIC_PERMISSION_NEEDED to "Se necesita acceso al micrófono. Abre los ajustes para permitirlo.",
        Key.GLARE_WARNING to "Hay reflejos. Inclina un poco el teléfono.",
        Key.UNCERTAIN_PREFIX to "Creo que esto es",
        Key.UNCERTAIN_SUFFIX to "pero no estoy seguro.",
        Key.EXPLORE_HINT to "Di más, exploración táctil, o lo que quieres pulsar.",
        Key.TOUCH_EXPLORE_ON to "Exploración táctil activada. Desliza el dedo por la pantalla.",
        Key.TOUCH_EXPLORE_NEEDS_SCREEN to "Primero di explorar, para que pueda leer la pantalla.",
        Key.TEXT_PREFIX to "Texto",
        Key.POS_TOP to "arriba",
        Key.POS_MIDDLE to "en el centro",
        Key.POS_BOTTOM to "abajo",
        Key.POS_LEFT to "izquierda",
        Key.POS_RIGHT to "derecha",
        Key.POS_FORMAT to "{row}, a la {col}",
        Key.OFFLINE_FOUND to "Encontré {label}, {position}.",
        Key.OFFLINE_WHICH to "Veo {a} y {b}. ¿Cuál?",
        Key.OFFLINE_NOT_FOUND to "No encuentro {goal}. Veo {list}.",
        Key.OFFLINE_NOT_FOUND_EMPTY to "No encuentro {goal}. Apunta el teléfono a la pantalla.",
        Key.BASIC_MODE to "Modo básico: solo botones con texto.",
        Key.ICON_NEEDS_CLOUD to "Los iconos necesitan la nube. En modo básico solo encuentro botones con palabras.",
        Key.OFFLINE_DWELL_DONE to "Creo que se pulsó.",
        Key.OFFLINE_ASR_UNAVAILABLE to "El reconocimiento de voz sin conexión no está activado. Actívalo en los ajustes de Android.",
        Key.UPDATE_AVAILABLE to "Hay una actualización disponible",
        Key.SPEECH_UNAVAILABLE to "La voz no está disponible. Vuelve a abrir Fingerpost.",
        Key.CAMERA_RECOVERY to "No se pudo iniciar el seguimiento de la cámara. Vuelve a abrir Fingerpost.",
        Key.FRAME_NO_SCREEN to "No veo una pantalla. Apunta el teléfono hacia ella.",
        Key.FRAME_CUT_LEFT to "El borde izquierdo de la pantalla queda fuera. Mueve el teléfono a la izquierda.",
        Key.FRAME_CUT_RIGHT to "El borde derecho de la pantalla queda fuera. Mueve el teléfono a la derecha.",
        Key.FRAME_CUT_TOP to "El borde superior de la pantalla queda fuera. Mueve el teléfono hacia arriba.",
        Key.FRAME_CUT_BOTTOM to "El borde inferior de la pantalla queda fuera. Mueve el teléfono hacia abajo.",
        Key.FRAME_MOVE_CLOSER to "Acércate.",
        Key.FRAME_MOVE_BACK to "Aléjate un poco.",
        Key.FRAME_MOVE_LEFT to "Mueve el teléfono a la izquierda.",
        Key.FRAME_MOVE_RIGHT to "Mueve el teléfono a la derecha.",
        Key.FRAME_MOVE_UP to "Mueve el teléfono hacia arriba.",
        Key.FRAME_MOVE_DOWN to "Mueve el teléfono hacia abajo.",
    )

    val strings: Map<Locale, Map<Key, String>> = mapOf(
        EN to en,
        HI to hi,
        ES to es,
    )

    val all: Map<Locale, Map<Key, String>> get() = strings
    val STRINGS: Map<Locale, Map<Key, String>> get() = strings

    operator fun get(locale: Locale): Map<Key, String> =
        strings[locale]
            ?: strings.entries.firstOrNull { it.key.language.equals(locale.language, ignoreCase = true) }?.value
            ?: strings.getValue(EN)

    operator fun get(locale: Locale, key: Key): String =
        get(locale)[key] ?: strings.getValue(EN).getValue(key)

    fun get(key: Key, locale: Locale = EN): String =
        get(locale, key)

    fun get(key: Key, localeTag: String): String {
        val tag = localeTag.trim().lowercase()
        val loc = when {
            tag.startsWith("hi") -> HI
            tag.startsWith("es") -> ES
            else -> EN
        }
        return get(loc, key)
    }

    fun framing(cue: FramingCue, locale: Locale = EN, chestMount: Boolean = false): String {
        if (chestMount && cue != FramingCue.GOOD) {
            val direction = when (cue) {
                FramingCue.CUT_LEFT, FramingCue.MOVE_LEFT -> Dir.LEFT
                FramingCue.CUT_RIGHT, FramingCue.MOVE_RIGHT -> Dir.RIGHT
                FramingCue.CUT_TOP, FramingCue.MOVE_UP -> Dir.UP
                FramingCue.CUT_BOTTOM, FramingCue.MOVE_DOWN -> Dir.DOWN
                else -> null
            }
            if (direction != null) return when (locale.language) {
                "hi" -> "अपने शरीर को ${Strings.direction(direction, locale)} घुमाएँ।"
                "es" -> "Gira el cuerpo hacia ${Strings.direction(direction, locale)}."
                else -> "${if (direction == Dir.UP || direction == Dir.DOWN) "Tilt" else "Turn"} your body ${Strings.direction(direction, locale)}."
            }
            return get(when (cue) { FramingCue.MOVE_CLOSER -> Key.CHEST_CLOSER; FramingCue.MOVE_BACK -> Key.CHEST_BACK; else -> Key.CHEST_FRAME }, locale)
        }
        return when (cue) {
        FramingCue.NO_SCREEN -> get(Key.FRAME_NO_SCREEN, locale)
        FramingCue.CUT_LEFT -> get(Key.FRAME_CUT_LEFT, locale)
        FramingCue.CUT_RIGHT -> get(Key.FRAME_CUT_RIGHT, locale)
        FramingCue.CUT_TOP -> get(Key.FRAME_CUT_TOP, locale)
        FramingCue.CUT_BOTTOM -> get(Key.FRAME_CUT_BOTTOM, locale)
        FramingCue.MOVE_CLOSER -> get(Key.FRAME_MOVE_CLOSER, locale)
        FramingCue.MOVE_BACK -> get(Key.FRAME_MOVE_BACK, locale)
        FramingCue.MOVE_LEFT -> get(Key.FRAME_MOVE_LEFT, locale)
        FramingCue.MOVE_RIGHT -> get(Key.FRAME_MOVE_RIGHT, locale)
        FramingCue.MOVE_UP -> get(Key.FRAME_MOVE_UP, locale)
        FramingCue.MOVE_DOWN -> get(Key.FRAME_MOVE_DOWN, locale)
        FramingCue.GOOD -> ""
        }
    }

    fun direction(dir: Dir, locale: Locale = EN): String = when (dir) {
        Dir.UP -> get(Key.DIR_UP, locale)
        Dir.DOWN -> get(Key.DIR_DOWN, locale)
        Dir.LEFT -> get(Key.DIR_LEFT, locale)
        Dir.RIGHT -> get(Key.DIR_RIGHT, locale)
        Dir.FORWARD -> get(Key.DIR_FORWARD, locale)
        Dir.BACK -> get(Key.DIR_BACK, locale)
    }
}
