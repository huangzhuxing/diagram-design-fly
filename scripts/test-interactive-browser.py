#!/usr/bin/env python3
"""Real Chromium tests for interactive behavior, geometry and fallback. Requires playwright."""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
ASSETS=ROOT/'skills/diagram-design-fly/assets'
ap=argparse.ArgumentParser();ap.add_argument('--out',type=Path,default=Path('/private/tmp/ddf-browser'));args=ap.parse_args();args.out.mkdir(parents=True,exist_ok=True)
checks=[]
def record(name):checks.append(name);print('OK '+name)
with sync_playwright() as p:
    browser=p.chromium.launch()
    page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    page.route('https://**/*',lambda route:route.abort())
    page.goto((ASSETS/'example-transformer-interactive.html').as_uri());page.wait_for_function('window.diagramReady === true')
    page.locator('[data-input="tokens"]').fill('甲 乙 丙 丁 戊 己')
    assert page.evaluate('diagram.snapshot().scene.nodes.find(n=>n.id==="attention").values.length')==6
    before=page.evaluate('JSON.stringify(diagram.snapshot().scene.nodes.find(n=>n.id==="qkv").values)')
    page.locator('[data-input="head"]').select_option('2')
    assert before!=page.evaluate('JSON.stringify(diagram.snapshot().scene.nodes.find(n=>n.id==="qkv").values)')
    page.locator('[data-node="blocks"]').click()
    assert page.locator('[data-input="layer"]').input_value()=='1'
    record('token/head/block UI updates computed values')
    page.locator('[data-node="attention"]').focus();page.keyboard.press('Enter')
    assert '因果' in page.locator('[data-detail-title]').inner_text()
    assert page.locator('[data-node="attention"]').get_attribute('aria-pressed')=='true'
    record('keyboard node selection exposes detail and pressed state')
    page.locator('[data-action="reset"]').click();page.locator('[data-action="play"]').click();page.wait_for_timeout(200)
    page.locator('[data-action="play"]').click();a=page.evaluate('diagram.snapshot().state.time');page.wait_for_timeout(100)
    assert page.evaluate('diagram.snapshot().state.time')==a and a>0
    page.locator('[data-action="play"]').click();page.wait_for_timeout(100);page.evaluate('diagram.pause()')
    assert page.evaluate('diagram.snapshot().state.time')>a
    page.evaluate('diagram.seek(11.95,{timeline:false});diagram.play()');page.wait_for_timeout(180)
    assert page.evaluate('diagram.snapshot().playing') is False
    assert page.evaluate('diagram.snapshot().state.time')==12
    record('pause/resume is stable and playback stops at completion')
    page.evaluate('diagram.seek(11)');assert page.locator('[data-input="temperature"]').input_value()=='1.8'
    page.evaluate('diagram.seek(1)');assert page.locator('[data-input="temperature"]').input_value()=='0.8'
    record('backward seek restores earlier parameter state')
    # Inspect all actual SVG label bounds, including the six-token matrix.
    page.locator('[data-input="tokens"]').fill('甲 乙 丙 丁 戊 己')
    overflow=page.evaluate('''() => [...document.querySelectorAll('[data-node]')].flatMap(n=>{
      const rect=n.querySelector('.node-surface').getBBox();
      return [...n.querySelectorAll('text')].filter(t=>{const b=t.getBBox();return b.x<rect.x-1||b.y<rect.y-1||b.x+b.width>rect.x+rect.width+1||b.y+b.height>rect.y+rect.height+1}).map(t=>n.dataset.node+': '+t.textContent);
    })''')
    assert not overflow,overflow
    record('all labels fit node geometry at maximum token count')
    page.screenshot(path=str(args.out/'transformer-desktop.png'),full_page=True)
    page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert page.evaluate('document.querySelector(".stage-scroll").scrollWidth>document.querySelector(".stage-scroll").clientWidth')
    page.screenshot(path=str(args.out/'transformer-mobile.png'),full_page=True)
    record('mobile page fits viewport and wide diagram remains scrollable')
    page.emulate_media(reduced_motion='reduce')
    page.wait_for_function('document.querySelector("[data-action=play]").disabled')
    assert page.locator('[data-action="play"]').is_disabled()
    page.evaluate('diagram.seek(4)');assert page.locator('[data-packet]').count()==0
    page.locator('[data-input="head"]').select_option('1');assert page.locator('[data-input="head"]').input_value()=='1'
    record('reduced motion disables animation while preserving parameter exploration')
    page.emulate_media(reduced_motion='no-preference')
    page.goto((ASSETS/'example-transformer-interactive.html').as_uri()+'?motion=static')
    assert page.locator('[data-ui]').is_hidden()
    record('static URL hides playback controls')
    offline=browser.new_context(java_script_enabled=False,viewport={'width':1440,'height':1000})
    static=offline.new_page();static.goto((ASSETS/'example-transformer-interactive.html').as_uri())
    assert static.locator('svg [data-node]').count()==8
    assert static.locator('[data-ui]').is_hidden()
    static.screenshot(path=str(args.out/'transformer-no-js.png'),full_page=True)
    record('no-JS artifact retains complete default SVG and explanation')
    page.set_viewport_size({'width':1440,'height':1000});page.goto((ASSETS/'example-queue-interactive.html').as_uri())
    page.evaluate('diagram.seek(4,{timeline:false})')
    assert page.evaluate('diagram.snapshot().scene.nodes.find(n=>n.id==="queue").values[0]')==32
    page.evaluate('diagram.seek(9,{timeline:false})')
    assert page.evaluate('diagram.snapshot().scene.nodes.find(n=>n.id==="result").values[1]')==32
    page.screenshot(path=str(args.out/'queue-desktop.png'),full_page=True)
    record('queue numeric updates agree with independent overload arithmetic')
    page.emulate_media(media='print');assert page.locator('[data-ui]').is_hidden()
    record('print hides controls')
    assert not errors,errors
    record('no browser runtime errors')
    browser.close()
(args.out/'results.json').write_text(json.dumps({'checks':checks,'count':len(checks)},ensure_ascii=False,indent=2)+'\n')
