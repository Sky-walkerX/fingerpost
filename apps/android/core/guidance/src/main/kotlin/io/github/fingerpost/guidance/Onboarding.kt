package io.github.fingerpost.guidance

data class TutorialPrompt(val id: Long, val text: String)

class OnboardingGuide {
    private val lines = listOf(
        "Fingerpost helps you press buttons on touchscreens.",
        "Hold the phone in one hand about an arm's length from the screen, or wear it on a chest mount.",
        "Point with your other index finger. Higher tones mean closer. A strong buzz means tap. Directions follow the screen.",
        "Say what you want to press after the question.",
    )
    private var index = 0
    private var sequence = 1L
    val prompt: TutorialPrompt? get() = lines.getOrNull(index)?.let { TutorialPrompt(sequence, it) }
    val complete: Boolean get() = index >= lines.size

    fun repeat(): TutorialPrompt? { if (!complete) sequence++; return prompt }

    fun speechDone(id: Long): TutorialPrompt? {
        if (!complete && id == sequence) { index++; sequence++ }
        return prompt
    }

    fun skip() { index = lines.size; sequence++ }
}
