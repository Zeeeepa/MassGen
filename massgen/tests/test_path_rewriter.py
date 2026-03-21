"""Tests for stale workspace path rewriting in framework metadata files.

TDD: Tests written first, then implementation follows.
"""

from __future__ import annotations

import os
import time
from pathlib import Path

from massgen.filesystem_manager._path_rewriter import (
    _SCAN_DIRS,
    replace_stale_paths_in_workspace,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_framework_file(workspace: Path, rel_path: str, content: str) -> Path:
    """Create a file inside the workspace at rel_path with given content."""
    fp = workspace / rel_path
    fp.parent.mkdir(parents=True, exist_ok=True)
    fp.write_text(content, encoding="utf-8")
    return fp


# ---------------------------------------------------------------------------
# Unit tests for replace_stale_paths_in_workspace
# ---------------------------------------------------------------------------


class TestReplaceStalePathsInWorkspace:
    """Unit tests for the path rewriter."""

    def test_replaces_paths_in_memory_dir(self, tmp_path: Path) -> None:
        """Replaces stale paths in memory/short_term/verification_latest.md."""
        stale = "/tmp/old_workspace/workspace_abc123"
        new = str(tmp_path / "dest_workspace")
        content = f"- Workspace: {stale}\n1. `cd {stale}`\n"
        _make_framework_file(
            tmp_path,
            "memory/short_term/verification_latest.md",
            content,
        )

        count = replace_stale_paths_in_workspace(tmp_path, {stale: new})

        assert count == 1
        result = (tmp_path / "memory/short_term/verification_latest.md").read_text()
        assert stale not in result
        assert new in result

    def test_replaces_paths_in_massgen_scratch(self, tmp_path: Path) -> None:
        """Replaces stale paths in .massgen_scratch/ files."""
        stale = "/tmp/old_workspace/workspace_xyz"
        new = "/tmp/new_workspace"
        content = f"Verification output referencing {stale}/file.txt\n"
        _make_framework_file(
            tmp_path,
            ".massgen_scratch/verification/output_test.txt",
            content,
        )

        count = replace_stale_paths_in_workspace(tmp_path, {stale: new})

        assert count == 1
        result = (tmp_path / ".massgen_scratch/verification/output_test.txt").read_text()
        assert stale not in result
        assert f"{new}/file.txt" in result

    def test_replaces_paths_in_tool_results(self, tmp_path: Path) -> None:
        """Replaces stale paths in .tool_results/ files."""
        stale = "/home/user/workspaces/ws_001"
        new = "/session/agents/agent_a/001/workspace"
        content = f"Tool output: saved to {stale}/output.json\n"
        _make_framework_file(tmp_path, ".tool_results/result_001.txt", content)

        count = replace_stale_paths_in_workspace(tmp_path, {stale: new})

        assert count == 1
        result = (tmp_path / ".tool_results/result_001.txt").read_text()
        assert f"{new}/output.json" in result

    def test_does_not_touch_root_level_deliverables(self, tmp_path: Path) -> None:
        """Root-level files (agent deliverables) must NOT be rewritten."""
        stale = "/tmp/old_workspace"
        new = "/tmp/new_workspace"
        content = f"This deliverable references {stale}\n"
        _make_framework_file(tmp_path, "README.md", content)
        # Also create a scanned dir file to ensure the function runs
        _make_framework_file(tmp_path, "memory/note.md", "no match here")

        count = replace_stale_paths_in_workspace(tmp_path, {stale: new})

        assert count == 0
        result = (tmp_path / "README.md").read_text()
        assert stale in result  # Unchanged

    def test_skips_binary_extensions(self, tmp_path: Path) -> None:
        """Files with binary extensions (.png, etc.) are skipped."""
        stale = "/tmp/old_workspace"
        new = "/tmp/new_workspace"
        # Write a text file with a binary extension in a scanned dir
        _make_framework_file(
            tmp_path,
            "memory/image.png",
            f"fake png with {stale}",
        )

        count = replace_stale_paths_in_workspace(tmp_path, {stale: new})

        assert count == 0

    def test_skips_files_over_size_limit(self, tmp_path: Path) -> None:
        """Files larger than MAX_FILE_SIZE_FOR_PATH_REWRITE are skipped."""
        from massgen.filesystem_manager._path_rewriter import (
            MAX_FILE_SIZE_FOR_PATH_REWRITE,
        )

        stale = "/tmp/old_workspace"
        new = "/tmp/new_workspace"
        # Create a file just over the limit
        big_content = f"{stale}\n" + "x" * (MAX_FILE_SIZE_FOR_PATH_REWRITE + 1)
        _make_framework_file(tmp_path, "memory/big_file.md", big_content)

        count = replace_stale_paths_in_workspace(tmp_path, {stale: new})

        assert count == 0
        result = (tmp_path / "memory/big_file.md").read_text()
        assert stale in result  # Unchanged

    def test_no_write_when_no_matches(self, tmp_path: Path) -> None:
        """File mtime should not change when no stale paths match."""
        content = "No stale paths here at all.\n"
        fp = _make_framework_file(tmp_path, "memory/clean.md", content)

        # Record mtime before
        mtime_before = os.path.getmtime(fp)
        # Small sleep to ensure mtime would differ if rewritten
        time.sleep(0.05)

        count = replace_stale_paths_in_workspace(
            tmp_path,
            {"/nonexistent/path": "/new/path"},
        )

        assert count == 0
        mtime_after = os.path.getmtime(fp)
        assert mtime_before == mtime_after

    def test_empty_replacements_is_noop(self, tmp_path: Path) -> None:
        """Empty replacements dict should be a no-op."""
        _make_framework_file(tmp_path, "memory/note.md", "some content\n")

        count = replace_stale_paths_in_workspace(tmp_path, {})

        assert count == 0

    def test_multiple_stale_paths_in_same_file(self, tmp_path: Path) -> None:
        """Multiple different stale paths in one file are all replaced."""
        stale1 = "/tmp/workspace_aaa"
        stale2 = "/tmp/workspace_bbb"
        new = "/session/workspace"
        content = f"Path1: {stale1}\nPath2: {stale2}\n"
        _make_framework_file(tmp_path, "memory/multi.md", content)

        count = replace_stale_paths_in_workspace(
            tmp_path,
            {stale1: new, stale2: new},
        )

        assert count == 1
        result = (tmp_path / "memory/multi.md").read_text()
        assert stale1 not in result
        assert stale2 not in result
        assert result.count(new) == 2

    def test_longest_first_prevents_partial_match(self, tmp_path: Path) -> None:
        """Longest replacement key is applied first to prevent corruption."""
        short_path = "/tmp/workspace"
        long_path = "/tmp/workspace/subdir"
        new_short = "/new/ws"
        new_long = "/new/ws/sub"
        # The file contains the long path — if short replaces first,
        # we'd get "/new/ws/subdir" instead of "/new/ws/sub"
        content = f"Reference: {long_path}/file.txt\n"
        _make_framework_file(tmp_path, "memory/ordering.md", content)

        count = replace_stale_paths_in_workspace(
            tmp_path,
            {short_path: new_short, long_path: new_long},
        )

        assert count == 1
        result = (tmp_path / "memory/ordering.md").read_text()
        assert result == "Reference: /new/ws/sub/file.txt\n"

    def test_non_utf8_file_does_not_crash(self, tmp_path: Path) -> None:
        """Binary content that isn't valid UTF-8 should be silently skipped."""
        fp = tmp_path / "memory"
        fp.mkdir(parents=True, exist_ok=True)
        binary_file = fp / "binary_data.md"
        binary_file.write_bytes(b"\x80\x81\x82\xff" * 100)

        # Should not raise
        count = replace_stale_paths_in_workspace(
            tmp_path,
            {"/tmp/old": "/tmp/new"},
        )

        assert count == 0

    def test_skips_skip_dirs_for_logging(self, tmp_path: Path) -> None:
        """Directories in SKIP_DIRS_FOR_LOGGING within scan dirs are skipped."""
        stale = "/tmp/old_workspace"
        new = "/tmp/new_workspace"
        # node_modules inside memory/ — should be skipped
        _make_framework_file(
            tmp_path,
            "memory/node_modules/package/file.txt",
            f"has {stale}",
        )

        count = replace_stale_paths_in_workspace(tmp_path, {stale: new})

        assert count == 0

    def test_scan_dirs_constant_matches_spec(self) -> None:
        """Verify _SCAN_DIRS contains the expected directories."""
        assert "memory" in _SCAN_DIRS
        assert ".massgen_scratch" in _SCAN_DIRS
        assert ".tool_results" in _SCAN_DIRS

    def test_workspace_root_does_not_exist(self, tmp_path: Path) -> None:
        """Non-existent workspace root returns 0 without error."""
        count = replace_stale_paths_in_workspace(
            tmp_path / "nonexistent",
            {"/old": "/new"},
        )
        assert count == 0


# ---------------------------------------------------------------------------
# Step mode integration test
# ---------------------------------------------------------------------------


class TestStepModePathRewriting:
    """Integration test: save_step_mode_output rewrites paths in workspace files."""

    def test_save_step_mode_output_rewrites_workspace_files(
        self,
        tmp_path: Path,
    ) -> None:
        """After save_step_mode_output, verification files in copied workspace
        have stale paths replaced with the session dir workspace path."""
        from massgen.step_mode import save_step_mode_output

        session_dir = tmp_path / "session"
        session_dir.mkdir()

        # Create a fake source workspace with a verification file
        source_ws = tmp_path / "source_workspace"
        source_ws.mkdir()
        stale_path = str(source_ws)
        verification_file = source_ws / "memory" / "short_term" / "verification_latest.md"
        verification_file.parent.mkdir(parents=True, exist_ok=True)
        verification_file.write_text(
            f"- Workspace: {stale_path}\n" f"1. `cd {stale_path}`\n",
        )

        step_dir = save_step_mode_output(
            session_dir=str(session_dir),
            agent_id="agent_a",
            action="new_answer",
            answer_text=f"My answer referencing {stale_path}",
            vote_target=None,
            vote_reason=None,
            seen_steps=None,
            duration_seconds=1.0,
            workspace_source=stale_path,
            stale_workspace_paths=[],
        )

        # The workspace was copied to step_dir/workspace
        copied_verification = step_dir / "workspace" / "memory" / "short_term" / "verification_latest.md"
        assert copied_verification.exists()

        content = copied_verification.read_text()
        ws_dest = str(step_dir / "workspace")
        assert stale_path not in content
        assert ws_dest in content
