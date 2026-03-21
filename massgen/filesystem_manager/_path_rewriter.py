"""Replace stale absolute paths in framework metadata files.

When workspaces are copied (step mode save, snapshot sharing), files inside
framework metadata directories may contain absolute paths pointing to the
original workspace location. This module rewrites those paths so they remain
valid in the copied workspace.

Only scans known framework subdirectories — never touches agent deliverables.
"""

from __future__ import annotations

import logging
from pathlib import Path

from ._constants import BINARY_FILE_EXTENSIONS, SKIP_DIRS_FOR_LOGGING

logger = logging.getLogger(__name__)

MAX_FILE_SIZE_FOR_PATH_REWRITE = 2_000_000  # 2 MB

# Framework metadata subdirs to scan recursively.
# These are written by the framework (verification, memory, tool results),
# not by agents in their deliverable output files.
_SCAN_DIRS = ("memory", ".massgen_scratch", ".tool_results")


def replace_stale_paths_in_workspace(
    workspace_root: Path,
    replacements: dict[str, str],
) -> int:
    """Replace stale absolute paths in framework metadata files.

    Only scans ``_SCAN_DIRS`` subdirectories recursively.
    Does **not** touch agent deliverables (root-level files, src/, etc.).

    Replacement keys are sorted longest-first to prevent partial matches
    (e.g. ``/tmp/workspace/subdir`` is replaced before ``/tmp/workspace``).

    Args:
        workspace_root: Root of the copied workspace.
        replacements: Mapping of old-path → new-path strings.

    Returns:
        Count of files that were modified.
    """
    if not replacements or not workspace_root.exists():
        return 0

    # Sort longest-first so longer paths are replaced before shorter prefixes
    ordered = sorted(replacements.items(), key=lambda kv: len(kv[0]), reverse=True)

    # Pre-encode old paths to bytes for fast ``in`` scanning
    encoded_keys = [old.encode("utf-8") for old, _ in ordered]

    modified = 0

    for scan_dir_name in _SCAN_DIRS:
        scan_dir = workspace_root / scan_dir_name
        if not scan_dir.is_dir():
            continue

        for file_path in _walk_files(scan_dir):
            if _should_skip_file(file_path):
                continue

            try:
                raw = file_path.read_bytes()
            except OSError:
                continue

            # Fast check: does any old path appear?
            if not any(key in raw for key in encoded_keys):
                continue

            # Decode, replace, write back
            try:
                text = raw.decode("utf-8")
            except UnicodeDecodeError:
                continue

            new_text = text
            for old_path, new_path in ordered:
                new_text = new_text.replace(old_path, new_path)

            if new_text != text:
                try:
                    file_path.write_text(new_text, encoding="utf-8")
                    modified += 1
                except OSError as exc:
                    logger.debug(
                        "[PathRewriter] Failed to write %s: %s",
                        file_path,
                        exc,
                    )

    return modified


def _walk_files(directory: Path) -> list[Path]:
    """Recursively collect files, skipping SKIP_DIRS_FOR_LOGGING."""
    files: list[Path] = []
    try:
        for entry in directory.iterdir():
            if entry.is_dir():
                if entry.name in SKIP_DIRS_FOR_LOGGING:
                    continue
                files.extend(_walk_files(entry))
            elif entry.is_file():
                files.append(entry)
    except OSError:
        pass
    return files


def _should_skip_file(file_path: Path) -> bool:
    """Return True if the file should not be scanned."""
    if file_path.suffix.lower() in BINARY_FILE_EXTENSIONS:
        return True
    try:
        if file_path.stat().st_size > MAX_FILE_SIZE_FOR_PATH_REWRITE:
            return True
    except OSError:
        return True
    return False
