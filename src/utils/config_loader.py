import json
import os
from typing import Dict

from pydantic import BaseModel, Field


class ModelConfig(BaseModel):
    id: str = Field(..., description="HF repo id for documentation")
    path: str = Field(..., description="Local path where the model is stored")
    type: str = Field(..., description="llm | vision-llm | asr | diffusion | embedding")


class RuntimeConfig(BaseModel):
    device: str = "auto"
    dtype: str = "float16"
    max_new_tokens: int = 512
    temperature: float = 0.7
    top_p: float = 0.9
    local_files_only: bool = True
    use_prompt_engineer: bool = True


class LoggingConfig(BaseModel):
    dir: str = "logs"
    level: str = "INFO"


class HydriaConfig(BaseModel):
    models: Dict[str, ModelConfig]
    runtime: RuntimeConfig = RuntimeConfig()
    logging: LoggingConfig = LoggingConfig()


def load_config(path: str = "hydria_config.json") -> HydriaConfig:
    """
    Read the JSON config and return a validated config object.
    """
    if not os.path.exists(path):
        raise FileNotFoundError(f"Missing config file at {path}")

    with open(path, "r", encoding="utf-8") as handle:
        raw = json.load(handle)

    return HydriaConfig(**raw)
