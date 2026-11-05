from app import extract_script


def test_extract_fenced_script_from_draft() -> None:
    draft = "Run this:\n\n```powershell\nGet-Service -Name Spooler\nRestart-Service -Name Spooler\n```\n\nDone."
    assert extract_script(draft) == "Get-Service -Name Spooler\nRestart-Service -Name Spooler"


def test_extract_command_lines_without_fence() -> None:
    draft = "Use these commands:\nGet-Service -Name Spooler\nRestart-Service -Name Spooler"
    assert extract_script(draft) == "Get-Service -Name Spooler\nRestart-Service -Name Spooler"


def test_extract_ignores_prose() -> None:
    assert extract_script("Restart the spooler service and try printing again.") == ""


def test_unsafe_runbook_sample_is_available() -> None:
    from samples import SAMPLES

    sample = next(item for item in SAMPLES if item["id"] == "unsafe-runbook")
    assert "Set-MpPreference" in extract_script(sample["draft"])
