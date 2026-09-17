#!/usr/bin/env python3
"""Repository entrypoint for the shipped interactive contract verifier."""
import importlib.util
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('interactive_contract',ROOT/'skills/diagram-design-fly/scripts/verify_interactive.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
verify=module.verify
if __name__=='__main__':
    if len(sys.argv)==1:sys.argv.extend(str(p) for p in sorted((ROOT/'skills/diagram-design-fly/assets').glob('*-interactive.html')))
    raise SystemExit(module.main())
