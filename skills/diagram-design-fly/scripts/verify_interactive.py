#!/usr/bin/env python3
"""Read-only contract check for self-contained interactive diagrams; never executes JS."""
import argparse
import json
from html.parser import HTMLParser
from pathlib import Path

class Parser(HTMLParser):
    def __init__(self):
        super().__init__(); self.roots=[]; self.scripts=[]; self.svg=[]; self.ids=[]; self.remote=[]; self.controls=[]; self.current=None; self.markers=set(); self.unsafe=[]; self.nodes=0; self.noscript=False
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        self.markers.update(a)
        if tag == 'noscript': self.noscript=True
        if 'data-node' in a: self.nodes+=1
        if any(k.startswith('on') for k in a) or tag in {'iframe','object','embed','base'}: self.unsafe.append(tag)
        if a.get('data-motion-mode')=='interactive': self.roots.append(a)
        if tag=='script': self.current={'attrs':a,'body':'','closed':False}; self.scripts.append(self.current)
        if tag=='svg': self.svg.append(a)
        if 'id' in a: self.ids.append(a['id'])
        if 'src' in a or tag=='link' and 'href' in a: self.remote.append(tag)
        if 'data-action' in a: self.controls.append(a['data-action'])
    def handle_endtag(self,tag):
        if tag=='script' and self.current is not None: self.current['closed']=True; self.current=None
    def handle_data(self,data):
        if self.current is not None: self.current['body']+=data

def verify_source(source):
    p=Parser();p.feed(source);errors=[]
    if len(p.roots)!=1: errors.append('expected one interactive root')
    elif p.roots[0].get('data-interactive-version')!='1': errors.append('interactive version must be 1')
    if len(p.ids)!=len(set(p.ids)): errors.append('duplicate IDs')
    if p.unsafe: errors.append('unsafe embedded element or executable attribute')
    if p.nodes == 0: errors.append('static SVG needs actual semantic nodes')
    if not p.noscript: errors.append('missing noscript fallback explanation')
    for key in ['data-stage','data-detail','data-status','data-ui','data-time']:
        if key not in p.markers: errors.append('missing markup '+key)
    if not p.svg or p.svg[0].get('role')!='group' or not p.svg[0].get('aria-labelledby'): errors.append('complete accessible SVG fallback required')
    if p.remote: errors.append('interactive output must bundle scripts/styles/assets')
    scripts={}
    for s in p.scripts:
        if not s['closed']: errors.append('unclosed script')
        keys=[k for k in s['attrs'] if k.startswith('data-diagram-')]
        if len(keys)!=1 or keys[0] in scripts: errors.append('scripts need unique data-diagram-spec/model/runtime/boot roles');continue
        scripts[keys[0]]=s
    expected={'data-diagram-spec','data-diagram-model','data-diagram-runtime','data-diagram-boot'}
    if set(scripts)!=expected: errors.append('missing or unexpected script roles')
    for key,script in scripts.items():
        allowed={key,'type'} if key=='data-diagram-spec' else {key}
        if set(script['attrs']) != allowed: errors.append('unexpected script attributes for '+key)
        if key=='data-diagram-spec' and script['attrs'].get('type')!='application/json': errors.append('scene script must be application/json')
    try:
        spec=json.loads(scripts['data-diagram-spec']['body'])
        if spec.get('version')!=1 or not spec.get('title') or not spec.get('description'):errors.append('invalid scene metadata')
        if not 0<float(spec['duration'])<=300: errors.append('invalid duration')
    except (KeyError,ValueError,TypeError,AttributeError): errors.append('invalid JSON scene specification')
    if not {'play','reset','tour','expand'}<=set(p.controls):errors.append('missing playback/reset/tour/expand controls')
    for required in ['prefers-reduced-motion','@media print','data-stage','data-detail','data-status','aria-live="polite"','<noscript']:
        if required not in source:errors.append('missing '+required)
    # The model may be customized; transport and time control remain a reusable implementation.
    if 'data-diagram-runtime' in scripts:
        canonical=(Path(__file__).resolve().parent.parent/'assets/interactive/runtime.js').read_text(encoding='utf-8').replace('</script','<\\/script')
        if scripts['data-diagram-runtime']['body'].strip()!=canonical.strip():errors.append('runtime differs from packaged version; rebuild with build-interactive.mjs')
    return errors

def verify(path):
    return verify_source(Path(path).read_text(encoding='utf-8'))

def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('files',nargs='+');args=ap.parse_args();failed=False
    for f in args.files:
        try: errors=verify(f)
        except (OSError,UnicodeError) as e: errors=[str(e)]
        print(('FAIL ' if errors else 'OK ')+f)
        for e in errors: print('  - '+e)
        failed |= bool(errors)
    return int(failed)
if __name__=='__main__':raise SystemExit(main())
