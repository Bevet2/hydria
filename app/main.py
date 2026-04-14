import argparse
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.append(ROOT)

from src.agents.prompt_engineer import PromptEngineer
from src.orchestrator.scheduler import HydriaOrchestrator, UserRequest
from src.ia_clients.local_model_registry import ModelRegistry
from src.utils.config_loader import load_config
from src.utils.logger import setup_logger


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Hydria multi-agents runner")
    parser.add_argument("-q", "--query", required=True, help="Demande utilisateur")
    parser.add_argument("--image", help="Chemin d'une image a analyser")
    parser.add_argument("--audio", help="Chemin d'un fichier audio a transcrire")
    parser.add_argument(
        "--image-gen", action="store_true", help="Forcer la generation d'image"
    )
    parser.add_argument(
        "--embed", action="store_true", help="Retourner des embeddings plutot que du texte"
    )
    return parser.parse_args()


def main():
    args = parse_args()
    config = load_config()
    setup_logger("agents", config.logging.level, config.logging.dir)
    registry = ModelRegistry(config)
    prompt_engineer = PromptEngineer(registry)
    orchestrator = HydriaOrchestrator(registry, prompt_engineer)

    request = UserRequest(
        query=args.query,
        image_path=args.image,
        audio_path=args.audio,
        wants_image=args.image_gen,
        wants_embeddings=args.embed,
    )
    response = orchestrator.process(request)

    print("--- Hydria ---")
    print(f"Tache : {response.task}")
    print(f"Model specialiste : {response.specialist_model}")
    print(f"Prompt optimise : {response.refined_prompt}")
    print(f"Sortie brute : {response.specialist_output}")
    print("\nReponse finale :")
    print(response.final_answer)


if __name__ == "__main__":
    main()
