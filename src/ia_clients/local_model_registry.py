import os
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import torch
from diffusers import AutoPipelineForText2Image
from PIL import Image
from sentence_transformers import SentenceTransformer
from transformers import (
    AutoModelForCausalLM,
    AutoProcessor,
    AutoTokenizer,
    logging as hf_logging,
    pipeline,
)
import tqdm

from src.utils.config_loader import HydriaConfig
from src.utils.logger import setup_logger


@dataclass
class ChatResult:
    content: Any
    model: str


class ModelRegistry:
    """
    Lazy loader for all local models referenced in hydria_config.json.
    """

    def __init__(self, config: HydriaConfig):
        self.config = config
        self.log = setup_logger("registry", config.logging.level, config.logging.dir)
        self.torch_dtype = getattr(torch, config.runtime.dtype, torch.float16)
        self._text_cache: Dict[str, Dict[str, object]] = {}
        self._vision_cache: Optional[Dict[str, object]] = None
        self._asr_pipe = None
        self._diffusion_pipe = None
        self._embedder = None

        if config.runtime.local_files_only:
            os.environ["TRANSFORMERS_OFFLINE"] = "1"
        # Avoid tqdm writing to broken streams in threaded contexts (Gradio queue)
        os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"
        os.environ["TQDM_DISABLE"] = "1"
        os.environ["TOKENIZERS_PARALLELISM"] = "false"
        hf_logging.disable_progress_bar()
        # Make logging.tqdm a no-op to avoid Errno 22 on Windows pipes
        hf_logging.tqdm = lambda iterable=None, *args, **kwargs: iterable
        tqdm.tqdm = lambda iterable=None, *args, **kwargs: iterable

    def _get_entry(self, key: str):
        if key not in self.config.models:
            raise KeyError(f"Model key '{key}' missing in config.")
        return self.config.models[key]

    def _pipeline_device(self) -> str:
        if self.config.runtime.device == "auto":
            return "cuda:0" if torch.cuda.is_available() else "cpu"
        return self.config.runtime.device

    def _load_text_model(self, key: str) -> Dict[str, object]:
        if key in self._text_cache:
            return self._text_cache[key]

        entry = self._get_entry(key)
        tokenizer = AutoTokenizer.from_pretrained(
            entry.path,
            use_fast=True,
            trust_remote_code=True,
            local_files_only=self.config.runtime.local_files_only,
        )
        device_map = "auto" if self.config.runtime.device == "auto" else None
        model = AutoModelForCausalLM.from_pretrained(
            entry.path,
            device_map=device_map,
            torch_dtype=self.torch_dtype,
            trust_remote_code=True,
            local_files_only=self.config.runtime.local_files_only,
        )
        if device_map is None and self.config.runtime.device:
            model.to(self.config.runtime.device)
        self._text_cache[key] = {"tokenizer": tokenizer, "model": model}
        return self._text_cache[key]

    def chat(self, model_key: str, messages: List[Dict[str, str]]) -> ChatResult:
        handle = self._load_text_model(model_key)
        tokenizer = handle["tokenizer"]
        model = handle["model"]

        try:
            prompt = tokenizer.apply_chat_template(
                messages, tokenize=False, add_generation_prompt=True
            )
        except Exception:
            prompt = messages[-1]["content"]
        inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
        gen_ids = model.generate(
            **inputs,
            max_new_tokens=self.config.runtime.max_new_tokens,
            do_sample=True,
            temperature=self.config.runtime.temperature,
            top_p=self.config.runtime.top_p,
            pad_token_id=tokenizer.eos_token_id,
        )
        generated = tokenizer.decode(
            gen_ids[0][inputs["input_ids"].shape[1] :], skip_special_tokens=True
        ).strip()
        return ChatResult(content=generated, model=model_key)

    def vision_chat(
        self, image_path: str, prompt: str, system: Optional[str] = None
    ) -> ChatResult:
        if not self._vision_cache:
            entry = self._get_entry("vision")
            processor = AutoProcessor.from_pretrained(
                entry.path, local_files_only=self.config.runtime.local_files_only
            )
            device_map = "auto" if self.config.runtime.device == "auto" else None
            model = AutoModelForCausalLM.from_pretrained(
                entry.path,
                torch_dtype=self.torch_dtype,
                device_map=device_map,
                trust_remote_code=True,
                local_files_only=self.config.runtime.local_files_only,
            )
            if device_map is None and self.config.runtime.device:
                model.to(self.config.runtime.device)
            self._vision_cache = {"processor": processor, "model": model}

        processor = self._vision_cache["processor"]
        model = self._vision_cache["model"]

        text_prompt = f"{system}\n{prompt}" if system else prompt
        image = Image.open(image_path).convert("RGB")
        inputs = processor(images=image, text=text_prompt, return_tensors="pt").to(
            model.device
        )
        gen_ids = model.generate(
            **inputs,
            max_new_tokens=self.config.runtime.max_new_tokens,
            pad_token_id=processor.tokenizer.eos_token_id,
        )
        response = processor.batch_decode(gen_ids, skip_special_tokens=True)[0]
        return ChatResult(content=response, model="vision")

    def transcribe(self, audio_path: str) -> ChatResult:
        if not self._asr_pipe:
            entry = self._get_entry("audio_stt")
            self._asr_pipe = pipeline(
                "automatic-speech-recognition",
                model=entry.path,
                torch_dtype=self.torch_dtype,
                device=self._pipeline_device(),
            )
        result = self._asr_pipe(audio_path)
        return ChatResult(content=result["text"], model="audio_stt")

    def generate_image(
        self, prompt: str, output_path: str, num_inference_steps: int = 4
    ) -> ChatResult:
        if not self._diffusion_pipe:
            entry = self._get_entry("image_gen")
            self._diffusion_pipe = AutoPipelineForText2Image.from_pretrained(
                entry.path,
                torch_dtype=self.torch_dtype,
                local_files_only=self.config.runtime.local_files_only,
            ).to(self._pipeline_device())

        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        image = self._diffusion_pipe(
            prompt,
            num_inference_steps=num_inference_steps,
            guidance_scale=0.0,
        ).images[0]
        image.save(output_path)
        return ChatResult(content=output_path, model="image_gen")

    def embed(self, texts: List[str]) -> ChatResult:
        if not self._embedder:
            entry = self._get_entry("embedder")
            device = None if self.config.runtime.device == "auto" else self.config.runtime.device
            self._embedder = SentenceTransformer(
                entry.path, device=device, trust_remote_code=True
            )
        vectors = self._embedder.encode(texts, normalize_embeddings=True).tolist()
        return ChatResult(content=vectors, model="embedder")
