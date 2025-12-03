import sys
from utils.logger import logger
from web.backend.app import run_web_server

if __name__ == "__main__":
    try:
        logger.info("Starting EchoBot Web Server...")
        run_web_server()
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        sys.exit(0)
