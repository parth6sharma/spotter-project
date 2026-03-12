#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""

import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
SRC_DIR = PROJECT_ROOT / "src"

if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))


def normalize_runserver_args(argv):
    if len(argv) < 2 or argv[1] != "runserver":
        return argv

    port = os.getenv("PORT", "").strip()
    if not port:
        return argv

    if len(argv) == 2:
        return [*argv, f"0.0.0.0:{port}"]

    address = argv[2]
    if ":" in address or address.startswith("0.0.0.0"):
        return argv

    if address.isdigit():
        updated = argv[:]
        updated[2] = f"0.0.0.0:{port}"
        return updated

    return argv


def main():
    """Run administrative tasks."""
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    sys.argv = normalize_runserver_args(sys.argv)
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
