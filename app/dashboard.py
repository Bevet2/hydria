import os
import sys
from typing import Any, List, Optional

import gradio as gr

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.append(ROOT)

from src.agents.prompt_engineer import PromptEngineer
from src.ia_clients.local_model_registry import ModelRegistry
from src.orchestrator.scheduler import HydriaOrchestrator, UserRequest
from src.utils.config_loader import load_config
from src.utils.logger import setup_logger


config = load_config()
log = setup_logger("dashboard", config.logging.level, config.logging.dir)
registry = ModelRegistry(config)
prompt_engineer = PromptEngineer(registry)
orchestrator = HydriaOrchestrator(registry, prompt_engineer)


def _path_from_upload(upload: Any) -> Optional[str]:
    """
    Gradio passes either a filepath or None depending on component type.
    """
    if upload is None:
        return None
    if isinstance(upload, str):
        return upload
    if hasattr(upload, "name"):
        return upload.name
    return None


def chat_fn(
    message: str,
    history: List[List[str]],
    image: Optional[str],
    audio: Optional[str],
    force_image_gen: bool,
    embeddings_only: bool,
) -> str:
    try:
        image_path = _path_from_upload(image)
        audio_path = _path_from_upload(audio)
        request = UserRequest(
            query=message or "",
            image_path=image_path,
            audio_path=audio_path,
            wants_image=force_image_gen,
            wants_embeddings=embeddings_only,
        )
        resp = orchestrator.process(request)

        extras: List[str] = []
        if resp.task == "image_gen":
            extras.append(f"[image path] {resp.specialist_output}")
        elif resp.task == "audio_stt":
            extras.append(f"[transcript] {resp.specialist_output}")
        elif resp.task == "vision":
            extras.append("[vision] analyse realisee")
        elif resp.task == "embedder":
            size = len(resp.specialist_output) if isinstance(resp.specialist_output, list) else "?"
            extras.append(f"[embeddings] {size} vecteurs generes")

        reply = resp.final_answer
        if extras:
            reply = f"{reply}\n\n" + "\n".join(extras)
        return reply
    except Exception as exc:  # pragma: no cover - UI fallback
        log.exception("Erreur dans l'interface chat")
        return f"Erreur: {exc}"


def build_ui() -> gr.Blocks:
    description = (
        "Hydria : prompt engineer (Mistral) + orchestrateur (Qwen) "
        "qui routent automatiquement vers code (DeepSeek), vision (LLaVA), "
        "audio (Whisper), diffusion (SDXL) ou embeddings (E5). "
        "Uploads facultatifs : image ou audio. "
        "Les modèles se chargent en local et peuvent prendre du temps au premier appel."
    )

    return gr.ChatInterface(
        fn=chat_fn,
        additional_inputs=[
            gr.Image(type="filepath", label="Image (vision)"),
            gr.Audio(type="filepath", label="Audio (Whisper STT)"),
            gr.Checkbox(label="Forcer generation d'image (SDXL)", value=False),
            gr.Checkbox(label="Embeddings seulement (E5)", value=False),
        ],
        title="Hydria - Chat multi-agents local",
        description=description,
        cache_examples=False,
    )


def main():
    ui = build_ui()
    ui.queue().launch(server_name="0.0.0.0", server_port=7991)


if __name__ == "__main__":
    main()
