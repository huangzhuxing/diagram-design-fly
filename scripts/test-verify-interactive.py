#!/usr/bin/env python3
import importlib.util
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('interactive',ROOT/'skills/diagram-design-fly/scripts/verify_interactive.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
source=(ROOT/'skills/diagram-design-fly/assets/example-queue-interactive.html').read_text()
assert not m.verify_source(source)
cases={
 'missing static stage':source.replace('<div data-stage>','<div>'),
 'missing complete figure':source.replace('data-node=','data-other='),
 'remote script':source.replace('<script data-diagram-model>','<script data-diagram-model src="https://example.com/model.js">'),
 'runtime drift':source.replace('const palette =','const paletteChanged ='),
 'wrong json script type':source.replace('type="application/json"','type="text/javascript"'),
 'missing reset':source.replace('data-action="reset"','data-other="reset"'),
 'missing no-js explanation':source.replace('<noscript>','<div>').replace('</noscript>','</div>'),
 'executable attribute':source.replace('<main class=', '<main onclick="alert(1)" class='),
 'embedded remote frame':source.replace('</main>','<iframe src="https://example.com"></iframe></main>'),
}
for name,text in cases.items():
 assert m.verify_source(text),name
 print('OK rejects '+name)
print('OK complete canonical interactive artifact accepted')
