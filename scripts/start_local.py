"""Run after installing Python requirements and frontend dependencies."""
import subprocess
import sys
import os
import shutil
from pathlib import Path
root = Path(__file__).resolve().parents[1]
env = os.environ.copy()
env.setdefault('VITE_INFERENCE_API_URL', 'http://localhost:8000')
runner = shutil.which('bun')
if runner is None:
    sys.exit('Install Bun first: https://bun.sh — then run bun install')
processes = []
try:
    processes.append(subprocess.Popen([sys.executable, '-m', 'uvicorn', 'backend.main:app', '--host', '0.0.0.0', '--port', '8000', '--workers', '1'], cwd=root, env=env))
    processes.append(subprocess.Popen([runner, 'run', 'dev'], cwd=root, env=env))
    print('Frontend: http://localhost:8080 | Inference docs: http://localhost:8000/docs')
    processes[0].wait()
except KeyboardInterrupt:
    pass
finally:
    for process in processes:
        process.terminate()
