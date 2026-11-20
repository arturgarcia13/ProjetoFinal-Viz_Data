import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def test_scrollytelling_e2e_browser():
    proc = subprocess.run(
        ["node", "tests/e2e.mjs"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert proc.returncode == 0, f"E2E falhou:\nSTDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
    assert "E2E OK:" in proc.stdout
