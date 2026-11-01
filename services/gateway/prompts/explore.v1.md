# Explore summary (explore.v1)

No model call: the summary is built from the parsed layout by `src/explore/summary.ts`, so it is fast,
free and can't invent controls. This id is recorded with explore turns so a later model-written summary
can be compared against it.

- Group elements by their centre into top / middle / bottom thirds, then left / right halves.
- One sentence per region, read top to bottom, left to right; at most 5 labels, then "and N more".
- Text elements are included: they give context ("Welcome to Fingerburger", "Total ₹149").
- First answer: up to 3 regions, then "Say more for details." Each "more" (or "más", "और") reads the next region.
- Languages: en, hi, es. Labels are read as the screen shows them (`labelLocal` when the parser supplied one).
