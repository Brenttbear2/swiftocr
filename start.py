"""SwiftOCR 啟動腳本：第一次執行會自動準備好環境，之後執行就直接啟動。

Windows：雙擊 start.bat（它會呼叫這個檔案）
Mac / Linux：在專案根目錄執行 python3 start.py
"""

from __future__ import annotations

import os
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
URL = "http://127.0.0.1:8000"
WINDOWS = os.name == "nt"
VENV_PYTHON = ROOT / ".venv" / ("Scripts/python.exe" if WINDOWS else "bin/python")
ENV_FILE = ROOT / ".env"


def stop(message: str) -> None:
    """印出原因後結束，不再往下做。"""
    print(message)
    print("\n啟動沒有完成，請看上面的訊息。")
    sys.exit(1)


def run(command: list, cwd: Path = ROOT) -> bool:
    """執行一個指令，成功回傳 True。"""
    return subprocess.run(command, cwd=cwd).returncode == 0


def swiftocr_running() -> bool:
    """SwiftOCR 是不是已經開著（健康檢查有回應）。"""
    try:
        with urllib.request.urlopen(URL + "/api/health", timeout=2) as res:
            return b"api_key_configured" in res.read()
    except OSError:
        return False


def port_in_use() -> bool:
    """port 8000 有沒有被別的程式佔用。"""
    with socket.socket() as s:
        return s.connect_ex(("127.0.0.1", 8000)) == 0


def frontend_sources(frontend: Path) -> list[Path]:
    """會影響打包結果的前端檔案：src 裡的程式，加上幾個設定檔。"""
    files = [p for p in (frontend / "src").rglob("*") if p.is_file()]
    return files + [frontend / name for name in ("index.html", "package.json", "vite.config.ts", "tsconfig.json")]


def newer_than(target: Path, sources: list[Path]) -> bool:
    """target 不存在，或任何一個 sources 比它新（改過了），就回傳 True。"""
    if not target.exists():
        return True
    built_at = target.stat().st_mtime
    return any(p.exists() and p.stat().st_mtime > built_at for p in sources)


def open_browser_when_ready() -> None:
    """等後端真的啟動了再打開瀏覽器（最多等 30 秒）。"""
    for _ in range(60):
        if swiftocr_running():
            webbrowser.open(URL)
            return
        time.sleep(0.5)


def main() -> None:
    # ── 1. Python 版本 ──
    if sys.version_info < (3, 11):
        stop(f"目前的 Python 是 {sys.version.split()[0]}，需要 3.11 以上：https://www.python.org/downloads/")

    # ── 2. 已經開著了：直接打開網頁就好 ──
    if swiftocr_running():
        print("SwiftOCR 已經在執行，直接打開網頁。")
        webbrowser.open(URL)
        return

    # ── 3. port 8000 被別的程式佔用：只提醒，不去關掉它 ──
    if port_in_use():
        stop("port 8000 已經被別的程式佔用，SwiftOCR 無法啟動。請先關掉那個程式再執行一次。")

    # ── 4. .env：放 OpenRouter API key 的檔案，沒有就從範本複製一份 ──
    if not ENV_FILE.exists():
        shutil.copy(ROOT / ".env.example", ENV_FILE)
        print("第一次執行：已建立 .env 檔案。")
        print("請把 OPENROUTER_API_KEY= 後面換成你的 key（取得：https://openrouter.ai/keys）。")
        if WINDOWS:
            print("接著會用記事本打開它，存檔並關閉記事本後繼續。")
            subprocess.run(["notepad", str(ENV_FILE)])
        else:
            input("用編輯器打開專案根目錄的 .env 填好、存檔後，回到這裡按 Enter 繼續…")
    if "xxxxxxxx" in ENV_FILE.read_text(encoding="utf-8"):
        print("提醒：.env 裡的 key 還是範本的假值，可以先啟動看看畫面，但辨識會失敗。")

    # ── 5. Python 虛擬環境 .venv 與後端套件 ──
    if not VENV_PYTHON.exists():
        print("[準備 1/2] 建立 Python 虛擬環境 .venv（只有第一次）")
        if not run([sys.executable, "-m", "venv", ".venv"]):
            stop("建立 .venv 失敗。")
    # 套件都裝好了就跳過；上次沒裝完（例如中途斷網）會再裝一次
    check = [str(VENV_PYTHON), "-c", "import fastapi, uvicorn, multipart, openai, fitz, dotenv"]
    if subprocess.run(check, capture_output=True).returncode != 0:
        print("[準備 1/2] 安裝後端套件（約 1～2 分鐘）")
        pip = [str(VENV_PYTHON), "-m", "pip", "install", "--disable-pip-version-check", "-r", "backend/requirements.txt"]
        if not run(pip):
            stop("後端套件安裝失敗，請確認網路連線後再執行一次。")

    # ── 6. 前端：沒打包過、或程式改過了，就重新打包（需要 Node.js） ──
    frontend = ROOT / "frontend"
    need_install = newer_than(frontend / "node_modules" / ".package-lock.json", [frontend / "package-lock.json"])
    need_build = newer_than(frontend / "dist" / "index.html", frontend_sources(frontend))
    if need_install or need_build:
        npm = shutil.which("npm")
        if npm is None:
            stop("找不到 Node.js。請先安裝 Node.js 20 以上：https://nodejs.org/")
        if need_install:
            print("[準備 2/2] 安裝前端套件（約 1 分鐘）")
            if not run([npm, "ci", "--no-audit", "--no-fund"], cwd=frontend):
                stop("前端套件安裝失敗，請確認網路連線後再執行一次。")
        print("[準備 2/2] 前端程式有更新，重新打包網頁")
        if not run([npm, "run", "build"], cwd=frontend):
            stop("前端打包失敗，請看上面的錯誤訊息（通常是程式裡有型別錯誤）。")

    # ── 7. 啟動後端（它也負責提供網頁），好了就自動打開瀏覽器 ──
    print(f"\nSwiftOCR 啟動中：{URL}")
    print("使用時請保持這個視窗開著；要結束時按 Ctrl+C。\n")
    threading.Thread(target=open_browser_when_ready, daemon=True).start()
    try:
        subprocess.run([str(VENV_PYTHON), "-m", "uvicorn", "main:app", "--app-dir", "backend",
                        "--host", "127.0.0.1", "--port", "8000"], cwd=ROOT)
    except KeyboardInterrupt:
        pass
    print("\nSwiftOCR 已停止。")


if __name__ == "__main__":
    main()
