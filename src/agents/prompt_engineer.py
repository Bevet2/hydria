from dataclasses import dataclass
from typing import List

from src.ia_clients.local_model_registry import ChatResult, ModelRegistry


PROMPT_ENGINEER_SYSTEM = """
Tu es l'agent "Prompt Engineer" (Mistral). Tu reformules les demandes pour qu'elles soient claires et exploitables par le modele cible {target}.
Contraintes :
- Reponds uniquement avec le prompt optimise, rien d'autre.
- Garde la langue d'entree (FR/EN) et precise le format attendu.
- Ajoute des instructions specifiques : 
  * coder : precise langage, signature attendue, style concis.
  * vision : decris ce que l'image doit faire ressortir (objets, texte, contexte).
  * image_gen : style visuel, plan, lumieres, sortie en francais ou anglais selon l'entree.
  * audio_stt : precise langue attendue et format de transcription.
  * embedder : liste les textes a vectoriser, un par ligne.
"""


@dataclass
class PromptEngineer:
    registry: ModelRegistry

    def rewrite(self, user_request: str, target: str) -> ChatResult:
        messages: List[dict] = [
            {"role": "system", "content": PROMPT_ENGINEER_SYSTEM.format(target=target)},
            {"role": "user", "content": user_request},
        ]
        return self.registry.chat("prompt_engineer", messages)
