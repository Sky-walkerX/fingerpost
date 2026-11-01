"""Glimmer on Modal for Fingerpost private mode (design §5.3, Days 4–7 plan B4-3).

Deploy config only, no business logic: vLLM's OpenAI-compatible server for Glimmer on one L40S,
scale to zero with a 5-minute scaledown window, Modal proxy auth in front, request logging off.

    GLIMMER_HF_ID=<hugging face repo id> modal deploy services/private-models/app.py

The gateway then needs GLIMMER_URL=<printed url>/v1, GLIMMER_TOKEN=<Modal-Key>:<Modal-Secret>
of a proxy-auth token, and GLIMMER_MODEL=glimmer. See README.md.
"""

import os
import subprocess

import modal

# Read on the deploying machine and baked into the image, so the container serves the same weights.
MODEL_ID = os.environ.get("GLIMMER_HF_ID", "")
# "1" when the Glimmer repo is gated: then a Modal secret named "huggingface" must hold HF_TOKEN.
HF_SECRET = os.environ.get("GLIMMER_HF_SECRET", "0")
SERVED_NAME = "glimmer"
PORT = 8000
MINUTES = 60

if modal.is_local() and not MODEL_ID:
    raise SystemExit("Set GLIMMER_HF_ID to Glimmer's Hugging Face repo id before deploying.")

image = (
    modal.Image.debian_slim(python_version="3.12")
    .uv_pip_install("vllm==0.32.0", "huggingface_hub[hf_transfer]")
    .env({"GLIMMER_HF_ID": MODEL_ID, "GLIMMER_HF_SECRET": HF_SECRET, "HF_HUB_ENABLE_HF_TRANSFER": "1"})
)

# Weights are cached between cold starts; nothing user-related is ever written to these volumes.
hf_cache = modal.Volume.from_name("fingerpost-hf-cache", create_if_missing=True)
vllm_cache = modal.Volume.from_name("fingerpost-vllm-cache", create_if_missing=True)

app = modal.App("fingerpost-glimmer")


@app.function(
    image=image,
    gpu="L40S",
    scaledown_window=5 * MINUTES,
    timeout=30 * MINUTES,
    max_containers=1,
    volumes={"/root/.cache/huggingface": hf_cache, "/root/.cache/vllm": vllm_cache},
    secrets=[modal.Secret.from_name("huggingface", required_keys=["HF_TOKEN"])] if HF_SECRET == "1" else [],
)
@modal.concurrent(max_inputs=8)
@modal.web_server(port=PORT, startup_timeout=15 * MINUTES, requires_proxy_auth=True)
def serve() -> None:
    cmd = [
        "vllm", "serve", os.environ["GLIMMER_HF_ID"],
        "--served-model-name", SERVED_NAME,
        "--host", "0.0.0.0", "--port", str(PORT),
        "--max-model-len", "8192",
        "--limit-mm-per-prompt", '{"image": 1}',
        # Frames and prompts must never reach logs: request logging is off by default in vLLM 0.32
        # (no --enable-log-requests) and the per-request access log is disabled too.
        "--disable-uvicorn-access-log",
        "--uvicorn-log-level", "warning",
    ]
    subprocess.Popen(cmd)
