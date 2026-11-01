# Private models: Glimmer on Modal

Private mode (design §3.2, §5.3) reads the screen with **Glimmer** on our own Modal GPU. A private
session never calls the Meta API. This folder holds only the deploy config: vLLM's
OpenAI-compatible server on one L40S, scaled to zero.

| Setting | Value |
|---|---|
| GPU | L40S (switch to A100-80GB in `app.py` if BF16 is needed) |
| Server | `vllm==0.32.0`, `vllm serve`, served model name `glimmer` |
| Scaling | scale to zero, `scaledown_window` 5 min, one container |
| Auth | Modal proxy auth (`requires_proxy_auth=True`) |
| Logging | request logging off (vLLM default) and the uvicorn access log disabled |

The gateway adapter is `services/gateway/src/parse/glimmer-parse.ts`. It sends the same prompt and
strict JSON schema as Spark, so a private layout has the same shape. Glimmer has no SAM, so target
outlines come from Glimmer's box (and device OCR).

## Deploy (human step: needs Modal credits)
1. `pip install modal==1.6.3` and `modal setup`.
2. If Glimmer's Hugging Face repo is gated: `modal secret create huggingface HF_TOKEN=<token>`, then add `GLIMMER_HF_SECRET=1` to the next command.
3. `GLIMMER_HF_ID=<Glimmer's Hugging Face repo id> modal deploy services/private-models/app.py`. It prints the URL of `serve`.
4. In the Modal dashboard, create a **proxy auth token** (Settings → Proxy Auth Tokens). It has a key (`wk-…`) and a secret (`ws-…`).
5. In the gateway `.env` (never commit it):
   ```
   GLIMMER_URL=https://<printed-url>/v1
   GLIMMER_TOKEN=wk-...:ws-...
   GLIMMER_MODEL=glimmer
   ```
   Set all three or none; the gateway refuses to start with a partial set. Glimmer is only called in `MODEL_MODE=live`.

## Check it
```bash
curl -s "$GLIMMER_URL/models" -H "Modal-Key: ${GLIMMER_TOKEN%%:*}" -H "Modal-Secret: ${GLIMMER_TOKEN#*:}"
```
The first call after idle cold-starts the GPU (minutes). Warm it before a demo.

A phone session started in private mode should get `ready.flags.privateAvailable: true`, and the
gateway should make no Meta API call for that session.

## Eval (B4-3 live step)
`pnpm --filter @fingerpost/evals eval --set day1 --mode private` → record parse p50 and element recall in
`docs/evals/report-glimmer-day4.md`.

## Prize evidence
Modal's usage page shows the GPU time for `fingerpost-glimmer`. Keep a screenshot for the README's
"verified by partner" section.
