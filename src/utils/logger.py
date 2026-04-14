import logging
import os
from logging.handlers import RotatingFileHandler


def setup_logger(name: str, level: str = "INFO", log_dir: str = "logs") -> logging.Logger:
    """
    Configure a logger that writes to stdout and a rotating file.
    """
    os.makedirs(log_dir, exist_ok=True)
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger

    logger.setLevel(level.upper())
    formatter = logging.Formatter(
        "[%(asctime)s][%(levelname)s][%(name)s] %(message)s", "%Y-%m-%d %H:%M:%S"
    )

    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)
    logger.addHandler(stream_handler)

    file_path = os.path.join(log_dir, f"{name}.log")
    file_handler = RotatingFileHandler(file_path, maxBytes=5_000_000, backupCount=2)
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    logger.propagate = False
    return logger
