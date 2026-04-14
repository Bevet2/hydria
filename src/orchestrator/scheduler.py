import os
from dataclasses import dataclass
from typing import List, Optional, Tuple
from uuid import uuid4

from src.agents.prompt_engineer import PromptEngineer
from src.ia_clients.local_model_registry import ChatResult, ModelRegistry
from src.utils.logger import setup_logger


ORCHESTRATOR_SYSTEM = """
Tu es l'orchestrateur Hydria (Qwen). Tu combines les resultats des specialistes pour repondre clairement a l'utilisateur.
Consignes :
- Rappelle la tache choisie (texte, code, vision, audio, image).
- Utilise le prompt optimise fourni par le prompt engineer uniquement comme contexte.
- Si un fichier est produit (image, transcription), donne le chemin et un resume succinct.
- Reponds de maniere concise et actionnable.
"""


@dataclass
class UserRequest:
    query: str
    image_path: Optional[str] = None
    audio_path: Optional[str] = None
    wants_image: bool = False
    wants_embeddings: bool = False


@dataclass
class HydriaResponse:
    task: str
    final_answer: str
    refined_prompt: str
    specialist_model: str
    specialist_output: object


class HydriaOrchestrator:
    def __init__(self, registry: ModelRegistry, prompt_engineer: PromptEngineer):
        self.registry = registry
        self.prompt_engineer = prompt_engineer
        self.log = setup_logger("orchestrator", registry.config.logging.level, registry.config.logging.dir)

    def detect_task(self, request: UserRequest) -> str:
        text = request.query.lower()
        if request.audio_path:
            return "audio_stt"
        if request.image_path and not request.wants_image:
            return "vision"
        if request.wants_image or any(k in text for k in ["image", "dessine", "dessin", "photo", "illustre", "render", "logo"]):
            return "image_gen"
        if request.wants_embeddings or "embedding" in text or "similarite" in text or "similarity" in text:
            return "embedder"
        if "```" in request.query or any(k in text for k in ["code", "bug", "stack trace", "function", "classe", "script"]):
            return "coder"
        return "general"

    def process(self, request: UserRequest) -> HydriaResponse:
        task = self.detect_task(request)

        if self.registry.config.runtime.use_prompt_engineer:
            refined = self.prompt_engineer.rewrite(request.query, target=task)
            refined_prompt = refined.content
            refined_source = refined.model
        else:
            refined_prompt = request.query
            refined_source = "orchestrator"

        specialist_result, evidence = self._dispatch(task, request, refined_prompt)

        if task == "general":
            final = specialist_result
        else:
            final = self._compose_final(task, request, refined_prompt, specialist_result, evidence)

        return HydriaResponse(
            task=task,
            final_answer=final.content,
            refined_prompt=refined_prompt,
            specialist_model=specialist_result.model,
            specialist_output=specialist_result.content,
        )

    def _dispatch(
        self, task: str, request: UserRequest, refined_prompt: str
    ) -> Tuple[ChatResult, str]:
        if task == "audio_stt":
            transcript = self.registry.transcribe(request.audio_path)
            return transcript, "Whisper transcription"

        if task == "vision":
            result = self.registry.vision_chat(
                request.image_path, refined_prompt, system="Analyse factuelle de l'image."
            )
            return result, "Vision reasoning"

        if task == "image_gen":
            output_path = os.path.join("data", "generated", f"{uuid4().hex[:8]}.png")
            result = self.registry.generate_image(refined_prompt, output_path)
            return result, "Image generee"

        if task == "embedder":
            lines = [line.strip() for line in refined_prompt.splitlines() if line.strip()]
            payload = lines or [refined_prompt]
            result = self.registry.embed(payload)
            return result, "Embeddings prets"

        if task == "coder":
            messages: List[dict] = [
                {
                    "role": "system",
                    "content": "Assistant code concis. Donne uniquement le code et breves explications si necessaire.",
                },
                {"role": "user", "content": refined_prompt},
            ]
            result = self.registry.chat("coder", messages)
            return result, "Reponse du modele code"

        # general chat handled by orchestrator model
        messages = [
            {"role": "system", "content": "Assistant general, ton clair et direct."},
            {"role": "user", "content": refined_prompt},
        ]
        result = self.registry.chat("orchestrator", messages)
        return result, "Reponse generale"

    def _compose_final(
        self,
        task: str,
        request: UserRequest,
        refined_prompt: str,
        specialist_result: ChatResult,
        evidence: str,
    ) -> ChatResult:
        messages = [
            {"role": "system", "content": ORCHESTRATOR_SYSTEM},
            {
                "role": "user",
                "content": (
                    f"Demande utilisateur : {request.query}\n"
                    f"Tache selectionnee : {task}\n"
                    f"Prompt optimise : {refined_prompt}\n"
                    f"Sortie specialiste ({specialist_result.model}) : {specialist_result.content}\n"
                    f"Notes : {evidence}"
                ),
            },
        ]
        return self.registry.chat("orchestrator", messages)
