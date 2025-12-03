import logging
import sys
import os
from logging.handlers import RotatingFileHandler
from colorama import init, Fore, Style
from config.loader import ConfigLoader

# Initialize colorama
init(autoreset=True)

class ColoredFormatter(logging.Formatter):
    """Custom formatter to add colors to console output."""
    
    COLORS = {
        logging.DEBUG: Fore.CYAN,
        logging.INFO: Fore.GREEN,
        logging.WARNING: Fore.YELLOW,
        logging.ERROR: Fore.RED,
        logging.CRITICAL: Fore.RED + Style.BRIGHT,
    }

    def format(self, record):
        color = self.COLORS.get(record.levelno, Fore.WHITE)
        message = super().format(record)
        return f"{color}{message}{Style.RESET_ALL}"

def setup_logger(name="echobot"):
    """Set up and configure the logger."""
    
    log_file_path = ConfigLoader.get("logging.file", "storage/logs/echobot.log")
    log_level_str = ConfigLoader.get("logging.level", "INFO")
    log_level = getattr(logging, log_level_str.upper(), logging.INFO)

    # Ensure log directory exists
    os.makedirs(os.path.dirname(log_file_path), exist_ok=True)

    logger = logging.getLogger(name)
    logger.setLevel(log_level)

    if logger.handlers:
        return logger

    # File Handler (Rotating)
    file_handler = RotatingFileHandler(
        log_file_path, maxBytes=5*1024*1024, backupCount=3, encoding='utf-8'
    )
    file_handler.setLevel(logging.DEBUG) # Always log debug to file
    file_format = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    file_handler.setFormatter(file_format)

    # Console Handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)
    console_format = ColoredFormatter(
        '%(levelname)s: %(message)s'
    )
    console_handler.setFormatter(console_format)

    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

    return logger

logger = setup_logger()
