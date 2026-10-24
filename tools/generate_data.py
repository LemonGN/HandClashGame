"""Regenerate the browser state table with the original full-space solver.

Run from any directory: python path/to/tools/generate_data.py
No third-party packages are required.
"""
from pathlib import Path
import json
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import compute_all as solver


def main():
    for turn in (0, 1):
        for a1 in range(1, solver.WIN + 1):
            for a2 in range(1, solver.WIN + 1):
                for b1 in range(1, solver.WIN + 1):
                    for b2 in range(1, solver.WIN + 1):
                        solver.build(a1, a2, b1, b2, turn)

    # Reuse the solver's serializer without keeping a second data copy in the project.
    with tempfile.TemporaryDirectory() as temporary:
        data = solver.export_json(str(Path(temporary) / 'states.json'))
    target = ROOT / 'data' / 'states.js'
    target.parent.mkdir(parents=True, exist_ok=True)
    content = '// Generated state table. Regenerate with: python tools/generate_data.py\n'
    content += 'window.HandClashData = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n'
    target.write_text(content, encoding='utf-8')
    print(f'Wrote {len(data)} states to {target}')


if __name__ == '__main__':
    main()
