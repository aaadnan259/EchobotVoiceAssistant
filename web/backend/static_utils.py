import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from utils.logger import logger

def mount_static_files(app: FastAPI):
    # --- Static Files & Template Configuration (Robust Fix) ---
    current_dir = os.path.dirname(os.path.abspath(__file__)) # web/backend
    web_dir = os.path.dirname(current_dir) # web
    project_root = os.path.dirname(web_dir) # EchoBot root

    logger.info(f"=== PATH DEBUG ===")
    logger.info(f"Current Directory: {current_dir}")
    logger.info(f"Project Root: {project_root}")

    # Determine Dist Directory
    possible_dist_dirs = [
        os.path.join(project_root, "build"),
        os.path.join(project_root, "dist"),
        "/app/build",  # Docker absolute path fallback
        "/app/dist"
    ]

    dist_dir = None
    for path in possible_dist_dirs:
        if os.path.exists(path) and os.path.isdir(path):
            dist_dir = path
            logger.info(f"Found dist directory at: {dist_dir}")
            break

    templates = None

    if dist_dir:
        # Check for index.html
        index_path = os.path.join(dist_dir, "index.html")
        if os.path.exists(index_path):
            logger.info(f"Found index.html at: {index_path}")
        else:
            logger.warning(f"Dist dir exists but index.html NOT found at: {index_path}")

        # Mount assets
        assets_dir = os.path.join(dist_dir, "assets")
        if os.path.exists(assets_dir):
             app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    else:
        logger.warning("No build/dist directory found! Falling back to dev mode/templates.")
        # Fallback/Dev
        static_dir = os.path.join(web_dir, "static")
        if os.path.exists(static_dir):
            app.mount("/static", StaticFiles(directory=static_dir), name="static")

        templates_dir = os.path.join(web_dir, "templates")
        if os.path.exists(templates_dir):
            templates = Jinja2Templates(directory=templates_dir)

    return dist_dir, templates
