"""Shared utilities for pre-collab artifact discovery."""

from __future__ import annotations

from pathlib import Path

from loguru import logger

# Standard search patterns for subagent output artifacts, in priority order.
_SEARCH_PATTERNS = [
    "full_logs/final/agent_*/workspace/{filename}",
    "full_logs/agent_*/*/*/{filename}",
    "workspace/snapshots/agent_*/{filename}",
    "workspace/agent_*/{filename}",
    "workspace/temp/agent_*/agent*/{filename}",
]


def find_precollab_artifact(
    log_directory: str,
    subagent_id: str,
    artifact_filename: str,
) -> Path | None:
    """Find a pre-collab artifact in subagent output using standard search patterns.

    Searches ``{log_directory}/subagents/{subagent_id}/`` with 5 patterns in
    priority order:

    1. ``full_logs/final/agent_*/workspace/{filename}``
    2. ``full_logs/agent_*/*/*/{filename}``
    3. ``workspace/snapshots/agent_*/{filename}``
    4. ``workspace/agent_*/{filename}``
    5. ``workspace/temp/agent_*/agent*/{filename}``

    Returns the most recently modified match, or ``None``.
    """
    base = Path(log_directory) / "subagents" / subagent_id
    if not base.exists():
        logger.debug(f"Subagent dir not found: {base}")
        return None

    found: list[Path] = []
    for pattern_template in _SEARCH_PATTERNS:
        pattern = pattern_template.format(filename=artifact_filename)
        found.extend(base.glob(pattern))

    if not found:
        logger.debug(f"No {artifact_filename} found in {base}")
        return None

    def _safe_mtime(p: Path) -> float:
        try:
            return p.stat().st_mtime
        except (FileNotFoundError, OSError):
            return 0.0

    found.sort(key=_safe_mtime, reverse=True)

    # Return the most recent match
    for candidate in found:
        if candidate.exists():
            logger.debug(f"Found {artifact_filename} at: {candidate}")
            return candidate

    return None
