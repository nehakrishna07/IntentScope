import sys
import json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.inference import InferenceEngine
if __name__ == '__main__':
    engine = InferenceEngine()
    engine.load()
    print(json.dumps(engine.info, indent=2))
