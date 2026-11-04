package io.github.fingerpost.guidance

import java.math.BigDecimal
import java.util.Locale

enum class AmountOutput { NORMAL, EARPHONES }
fun amountOutput(pin: Boolean) = if (pin) AmountOutput.EARPHONES else AmountOutput.NORMAL

data class Money(val minor: Long, val currency: String) {
    fun spoken() = "$currency ${BigDecimal.valueOf(minor,2).toPlainString()}"
}

/** IF-6: amounts live only in session memory; this class has no persistence or logging API. */
class ExpectedTotal {
    private var explicit: Money? = null
    private var chosen: Money? = null
    private var mixed = false
    fun expect(text: String) { if (Regex("expect|espero|उम्मीद|अपेक्षा",RegexOption.IGNORE_CASE).containsMatchIn(text)) explicit = parseMoney(text) }
    fun selected(label: String) {
        val amount = parseMoney(label) ?: return
        if (mixed) return
        if (chosen != null && chosen!!.currency != amount.currency) { chosen = null; mixed = true; return }
        val sum = runCatching { Math.addExact(chosen?.minor ?: 0, amount.minor) }.getOrNull()
        if (sum == null) { chosen = null; mixed = true } else chosen = Money(sum,amount.currency)
    }
    fun warning(labels: List<String>, locale: Locale): String? {
        val expected = explicit ?: chosen ?: return null
        val amounts = labels.mapNotNull { label -> parseMoney(label)?.let { label to it } }
        val totals = amounts.filter { Regex("total|amount|कुल|importe",RegexOption.IGNORE_CASE).containsMatchIn(it.first) }
        val shown = (if (totals.size == 1) totals else amounts).singleOrNull()?.second ?: return null
        if (shown == expected) return null
        return Strings.get(Key.OVERCHARGE_WARNING,locale).replace("{shown}",shown.spoken()).replace("{expected}",expected.spoken())
    }
    fun clear() { explicit = null; chosen = null; mixed = false }
}

private val currency = mapOf("₹" to "INR","rs" to "INR","inr" to "INR","rupee" to "INR","rupees" to "INR",
    "रुपये" to "INR","रुपए" to "INR","रुपया" to "INR","$" to "USD","usd" to "USD","dollars" to "USD",
    "€" to "EUR","eur" to "EUR","euros" to "EUR","£" to "GBP","gbp" to "GBP")
private const val SYMBOLS = "₹|rs\\.?|inr|rupees?|रुपये|रुपए|रुपया|\\$|usd|dollars|€|eur|euros|£|gbp"
private val moneyPattern = Regex("($SYMBOLS)\\s*([0-9][0-9,]*(?:\\.[0-9]{1,2})?)|([0-9][0-9,]*(?:\\.[0-9]{1,2})?)\\s*($SYMBOLS)",RegexOption.IGNORE_CASE)
fun parseMoney(text: String): Money? {
    val normalized = text.map { c -> if (c in '०'..'९' || c in '٠'..'٩') ('0'.code+c.digitToInt()).toChar() else c }.joinToString("")
    val m = moneyPattern.findAll(normalized).toList().singleOrNull() ?: return null
    val symbol = (m.groups[1]?.value ?: m.groups[4]?.value)?.lowercase(Locale.ROOT)?.replace(".","") ?: return null
    val value = (m.groups[2]?.value ?: m.groups[3]?.value)?.replace(",","") ?: return null
    val minor = runCatching { BigDecimal(value).movePointRight(2).longValueExact() }.getOrNull() ?: return null
    return currency[symbol]?.let { Money(minor,it) }
}
