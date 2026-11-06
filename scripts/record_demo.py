#!/usr/bin/env python3
"""Record the two-minute fallback demo from the live deployment.

This is a real browser recording of live checks, not a rendered slideshow.
Captions are injected only into the recording browser so a judge can follow
the story with the sound off.

    python scripts/record_demo.py
    ffmpeg -i website/demo/docket-fallback.webm -c:v libx264 -pix_fmt yuv420p \
      -crf 27 -preset slow -movflags +faststart website/demo/docket-fallback.mp4
"""

from __future__ import annotations

import shutil
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "https://docket-clocked.vercel.app"
OUT_DIR = Path("website/demo")
VIDEO_DIR = OUT_DIR / "_raw"


def caption(page, text: str) -> None:
    page.evaluate(
        """(text) => {
          let bar = document.getElementById('docket-demo-caption');
          if (!bar) {
            bar = document.createElement('div');
            bar.id = 'docket-demo-caption';
            bar.style.cssText = [
              'position:fixed','left:0','right:0','bottom:0','z-index:2147483647',
              'padding:15px 22px 17px','background:rgba(8,11,9,.94)',
              'border-top:2px solid #c90020','color:#f1f5f1',
              'font:16px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace',
              'letter-spacing:.01em','pointer-events:none'
            ].join(';');
            document.body.appendChild(bar);
          }
          bar.textContent = text;
        }""",
        text,
    )


def pause(page, seconds: float) -> None:
    page.wait_for_timeout(int(seconds * 1000))


def main() -> None:
    if VIDEO_DIR.exists():
        shutil.rmtree(VIDEO_DIR)
    VIDEO_DIR.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        )
        context = browser.new_context(
            viewport={"width": 1280, "height": 800},
            record_video_dir=str(VIDEO_DIR),
            record_video_size={"width": 1280, "height": 800},
            device_scale_factor=1,
        )
        page = context.new_page()

        page.goto(f"{BASE}/tour", wait_until="networkidle")
        pause(page, 2)
        caption(page, "Docket: the publish gate for service-desk answers. The demo is the live product.")
        pause(page, 4)

        caption(
            page,
            "France: the newest global policy requires manager approval. The older France annex says it does not.",
        )
        pause(page, 5)
        caption(page, "Latest-wins would publish the wrong answer. Docket resolves jurisdiction and precedence first.")
        pause(page, 4)

        page.evaluate("document.querySelector('#run-tour').click()")
        caption(page, "Eight live checks. Nothing is pre-recorded. The counter moves only when a case finishes.")
        page.wait_for_function(
            "document.querySelector('#tour-status')?.textContent === 'Complete'",
            timeout=90_000,
        )
        pause(page, 3)
        caption(page, "Eight of eight complete. Each row has a decision, a human-readable reason and an audit sequence.")
        pause(page, 4)

        page.evaluate("document.querySelector('.tour-evidence')?.scrollIntoView({block:'center'})")
        pause(page, 2)
        caption(page, "0 unsafe false-PUBLISH. Locked and post-tuning results are reported separately.")
        pause(page, 6)

        page.goto(f"{BASE}/console", wait_until="networkidle")
        pause(page, 2)
        caption(page, "The console: a draft answer about to ship to an employee.")
        pause(page, 2)
        page.evaluate("document.querySelector('#gate-try-france').click()")
        pause(page, 15)
        caption(page, "The France annex governs. The deciding claim and the governing quote sit above the action.")
        pause(page, 5)
        page.evaluate("document.querySelector('#gate-record-block')?.scrollIntoView({block:'center'})")
        pause(page, 2)
        caption(page, "Approve review records the decision. It does not publish; edit and re-run to publish.")
        pause(page, 6)

        page.evaluate("document.querySelector('#gate-examples [data-id=\"scope-applicability\"]').click()")
        pause(page, 1)
        page.evaluate("document.querySelector('#gate-run').click()")
        pause(page, 14)
        caption(page, "Scope is explained from the authority trace, including why Verify had no substantive claim.")
        pause(page, 6)

        caption(page, "Docket: which policy governs, who reviewed the answer, and what was recorded.")
        pause(page, 4)

        context.close()
        browser.close()

    videos = sorted(VIDEO_DIR.glob("*.webm"))
    if not videos:
        raise SystemExit("No recording was produced.")
    target = OUT_DIR / "docket-fallback.webm"
    shutil.move(str(videos[-1]), target)
    shutil.rmtree(VIDEO_DIR)
    print(f"recorded {target} ({target.stat().st_size / 1_000_000:.1f} MB)")
    print("convert with: ffmpeg -i %s -c:v libx264 -pix_fmt yuv420p -crf 27 -preset slow -movflags +faststart %s"
          % (target, OUT_DIR / "docket-fallback.mp4"))


if __name__ == "__main__":
    main()
