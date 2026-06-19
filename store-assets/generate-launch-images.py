import subprocess, os

AV = open('/tmp/av.b64').read().strip()
MEDIA = open('/tmp/media.b64').read().strip()
OUT = '/Users/mafex/code/personal/floatX/store-assets/launch'
os.makedirs(OUT, exist_ok=True)

DEFS = '''
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0a0c10"/><stop offset="1" stop-color="#11151b"/>
    </linearGradient>
    <radialGradient id="glowL" cx="0.2" cy="0.08" r="0.85">
      <stop offset="0" stop-color="#1d9bf0" stop-opacity="0.20"/><stop offset="0.6" stop-color="#1d9bf0" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowR" cx="0.8" cy="0.1" r="0.85">
      <stop offset="0" stop-color="#1d9bf0" stop-opacity="0.18"/><stop offset="0.6" stop-color="#1d9bf0" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="cardbg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#15191f"/><stop offset="1" stop-color="#0a0c10"/>
    </linearGradient>
    <radialGradient id="cardglow" cx="0.12" cy="0" r="0.7">
      <stop offset="0" stop-color="#1d9bf0" stop-opacity="0.20"/><stop offset="1" stop-color="#1d9bf0" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="avclip"><circle cx="36" cy="38" r="20"/></clipPath>
    <clipPath id="cardclip"><rect x="0" y="0" width="360" height="320" rx="20"/></clipPath>
    <clipPath id="mediaclip"><rect x="16" y="104" width="328" height="158" rx="14"/></clipPath>
    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="36" stdDeviation="40" flood-color="#000" flood-opacity="0.6"/>
    </filter>
  </defs>
'''

VBADGE = lambda x,y: f'''<g transform="translate({x},{y})">
  <circle cx="7" cy="7" r="7" fill="#1d9bf0"/>
  <path d="M {7*.3+0} {7*.0+ -0} " fill="none"/>
  <path d="M4.2 7.3 L6.3 9.2 L10 4.8" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</g>'''

def eng_icons(y):
    # reply, repost, like, views at 4 columns starting x=22, step 82
    cols = [22, 104, 186, 268]
    vals = ['128','2.1K','18K','240K']
    out = []
    s='stroke="#71767b" stroke-width="1.4" fill="none" stroke-linejoin="round" stroke-linecap="round"'
    # reply
    cx=cols[0]+6
    out.append(f'<path d="M{cx-6} {y-5} H{cx+6} V{y+2} H{cx-2} L{cx-6} {y+6} Z" {s}/>')
    # repost
    cx=cols[1]+6
    out.append(f'<path d="M{cx-5} {y-1} V{y-4} H{cx+4}" {s}/><path d="M{cx+2} {y-6} L{cx+5} {y-4} L{cx+2} {y-2}" {s}/><path d="M{cx+5} {y+1} V{y+4} H{cx-4}" {s}/><path d="M{cx-2} {y+6} L{cx-5} {y+4} L{cx-2} {y+2}" {s}/>')
    # like
    cx=cols[2]+6
    out.append(f'<path d="M{cx} {y+5} C{cx-7} {y} {cx-5} {y-6} {cx} {y-2} C{cx+5} {y-6} {cx+7} {y} {cx} {y+5} Z" {s}/>')
    # views
    cx=cols[3]+6
    out.append(f'<path d="M{cx-5} {y+5} V{y+1} M{cx-1} {y+5} V{y-2} M{cx+3} {y+5} V{y-5}" {s}/>')
    for i,c in enumerate(cols):
        out.append(f'<text x="{c+19}" y="{y+4}" font-family="system-ui,sans-serif" font-size="12" font-weight="500" fill="#71767b">{vals[i]}</text>')
    return '\n'.join(out)

def wrap_text(text, max_chars, max_lines):
    words = text.split(); lines=[]; cur=''
    for w in words:
        if len(cur)+len(w)+1 > max_chars and cur:
            lines.append(cur); cur=w
            if len(lines)>=max_lines: break
        else:
            cur = (cur+' '+w).strip()
    if len(lines)<max_lines and cur: lines.append(cur)
    return lines

def card(name, handle, time, text, progress, media=False, eng=True):
    # returns a <g> with the 360x320 card content (clipped + framed by caller)
    parts = [f'<rect width="360" height="320" fill="url(#cardbg)"/>',
             f'<rect width="360" height="320" fill="url(#cardglow)"/>',
             f'<rect width="360" height="1" fill="#ffffff" opacity="0.06"/>']
    # avatar
    parts.append(f'<image href="{AV}" x="16" y="18" width="40" height="40" clip-path="url(#avclip)" preserveAspectRatio="xMidYMid slice"/>')
    # name + handle + time
    namew = len(name)*8.5
    parts.append(f'<text x="66" y="33" font-family="system-ui,sans-serif" font-size="15" font-weight="700" fill="#e7e9ea">{name}</text>')
    parts.append(VBADGE(66+namew+4, 22))
    parts.append(f'<text x="66" y="51" font-family="system-ui,sans-serif" font-size="14" fill="#71767b">@{handle}</text>')
    parts.append(f'<text x="344" y="33" text-anchor="end" font-family="system-ui,sans-serif" font-size="14" fill="#71767b">{time}</text>')
    y=82
    if text:
        for ln in wrap_text(text, 42, 3 if media else 7):
            parts.append(f'<text x="16" y="{y+12}" font-family="system-ui,sans-serif" font-size="15.5" fill="#e7e9ea">{ln}</text>')
            y+=20
    if media:
        parts.append(f'<g clip-path="url(#mediaclip)"><rect x="16" y="104" width="328" height="158" fill="#1b2027"/><image href="{media}" x="16" y="104" width="328" height="158" preserveAspectRatio="xMidYMid slice"/></g>')
    if eng:
        parts.append(eng_icons(294))
    # progress bar
    parts.append(f'<rect x="0" y="317" width="360" height="3" fill="#ffffff" opacity="0.12"/>')
    parts.append(f'<rect x="0" y="317" width="{int(360*progress)}" height="3" fill="#1d9bf0"/>')
    return '\n'.join(parts)

def render(name, svg):
    p=f'/tmp/{name}.svg'; open(p,'w').write(svg)
    out=f'{OUT}/{name}.png'
    subprocess.run(['rsvg-convert','-w','1280','-h','800',p,'-o',out],check=True)
    print('wrote', out)

# ---------- Scene 1: hero ----------
hero = f'''<svg width="1280" height="800" viewBox="0 0 1280 800" xmlns="http://www.w3.org/2000/svg">{DEFS}
  <rect width="1280" height="800" fill="url(#bg)"/>
  <rect width="1280" height="800" fill="url(#glowL)"/>
  <text x="96" y="356" font-family="system-ui,sans-serif" font-size="78" font-weight="800" fill="#f2f4f7" letter-spacing="-2">FloatX</text>
  <text x="98" y="406" font-family="system-ui,sans-serif" font-size="27" font-weight="500" fill="#8b98a5">your X timeline, floating on screen —</text>
  <text x="98" y="442" font-family="system-ui,sans-serif" font-size="27" font-weight="500" fill="#8b98a5">one post at a time.</text>
  <text x="98" y="492" font-family="system-ui,sans-serif" font-size="19" font-weight="500" fill="#5b6570">no API · no cost · reads the tab you already have open</text>
  <g transform="translate(760,240)" filter="url(#shadow)">
    <g clip-path="url(#cardclip)">{card("Mafex","devmafex","2h","building floatX in public. it floats your timeline in a little glass window and drips one post at a time. calm and ambient.",0.62)}</g>
    <rect x="0.5" y="0.5" width="359" height="319" rx="20" fill="none" stroke="#ffffff" stroke-opacity="0.08"/>
  </g>
</svg>'''
render('01-hero', hero)

# ---------- Scene 2: hover controls ----------
def ctrl_btn(cx, d):
    return f'<circle cx="{cx}" cy="250" r="26" fill="#ffffff" opacity="0.16"/><g transform="translate({cx-11},239)" fill="#fff"><svg>{d}</svg></g>'
controls_overlay = '''
  <rect x="0" y="160" width="360" height="160" fill="url(#ctrlgrad)"/>
'''
ctrl_defs = '''<linearGradient id="ctrlgrad" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0.55"/><stop offset="0.5" stop-color="#000" stop-opacity="0"/></linearGradient>'''
# control glyphs as paths
prev_p='<path d="M6 5v14M17 5 8 12l9 7z"/>'
pause_p='<path d="M7 5h3v14H7zM14 5h3v14h-3z"/>'
next_p='<path d="M18 5v14M7 5l9 7-9 7z"/>'
def cbtn(cx,glyph):
    cy=190
    return (f'<circle cx="{cx}" cy="{cy}" r="27" fill="#000000" opacity="0.45"/>'
            f'<circle cx="{cx}" cy="{cy}" r="27" fill="#ffffff" opacity="0.16"/>'
            f'<g transform="translate({cx-12},{cy-12})" fill="#fff">{glyph}</g>')
controls = f'''<svg width="1280" height="800" viewBox="0 0 1280 800" xmlns="http://www.w3.org/2000/svg">{DEFS}
  <defs>{ctrl_defs}</defs>
  <rect width="1280" height="800" fill="url(#bg)"/>
  <rect width="1280" height="800" fill="url(#glowR)"/>
  <text x="1184" y="366" text-anchor="end" font-family="system-ui,sans-serif" font-size="56" font-weight="800" fill="#f2f4f7" letter-spacing="-1">hover to control</text>
  <text x="1184" y="412" text-anchor="end" font-family="system-ui,sans-serif" font-size="25" font-weight="500" fill="#8b98a5">prev · pause · next, right where you expect.</text>
  <text x="1184" y="448" text-anchor="end" font-family="system-ui,sans-serif" font-size="25" font-weight="500" fill="#8b98a5">set the speed — seconds to an hour.</text>
  <g transform="translate(150,240)" filter="url(#shadow)">
    <g clip-path="url(#cardclip)">
      {card("Mafex","devmafex","19h","",0.4,media=MEDIA)}
      <rect x="0" y="160" width="360" height="160" fill="url(#ctrlgrad)"/>
      {cbtn(120,prev_p)}{cbtn(180,pause_p)}{cbtn(240,next_p)}
    </g>
    <rect x="0.5" y="0.5" width="359" height="319" rx="20" fill="none" stroke="#ffffff" stroke-opacity="0.08"/>
  </g>
</svg>'''
render('02-controls', controls)

# ---------- Scene 3: settings / customization ----------
def toggle(x,y,on):
    track = '#1d9bf0' if on else 'rgba(255,255,255,0.12)'
    knob_x = x+20 if on else x+2
    return f'<rect x="{x}" y="{y}" width="36" height="20" rx="10" fill="{track}"/><circle cx="{knob_x+8}" cy="{y+10}" r="8" fill="#fff"/>'

def preset(x,y,w,label,active):
    fill = '#1d9bf0' if active else 'rgba(255,255,255,0.05)'
    tc = '#fff' if active else '#9aa6b2'
    return f'<rect x="{x}" y="{y}" width="{w}" height="30" rx="9" fill="{fill}"/><text x="{x+w/2}" y="{y+20}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" font-weight="600" fill="{tc}">{label}</text>'

POPW=300
def popup():
    p=[f'<rect width="{POPW}" height="372" rx="20" fill="#0a0d12"/>',
       f'<rect width="{POPW}" height="372" rx="20" fill="url(#popglow)"/>']
    # header — mini FloatX logo (X glyph + blue auto-advance bar)
    p.append('<g transform="translate(20,22)">'
             '<path transform="scale(0.78)" fill="#f2f4f7" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>'
             '<rect x="3" y="20" width="13" height="2" rx="1" fill="#1d9bf0"/>'
             '</g>')
    p.append('<text x="46" y="38" font-family="system-ui,sans-serif" font-size="17" font-weight="700" fill="#f2f4f7">FloatX</text>')
    p.append(f'<rect x="{POPW-66}" y="22" width="46" height="24" rx="8" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.10)"/><text x="{POPW-43}" y="38" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" font-weight="500" fill="#cdd6df">open</text>')
    # interval card
    p.append(f'<rect x="16" y="60" width="{POPW-32}" height="120" rx="14" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.08)"/>')
    p.append('<text x="30" y="86" font-family="system-ui,sans-serif" font-size="11" font-weight="600" letter-spacing="1" fill="#6b7681">ADVANCE EVERY</text>')
    labels=[('10s',0),('30s',0),('1m',0),('5m',1),('15m',0)]
    x=30; cw=48; gap=4
    for lb,act in labels:
        p.append(preset(x,96,cw,lb,act)); x+=cw+gap
    p.append('<text x="30" y="156" font-family="system-ui,sans-serif" font-size="12" fill="#8b98a5">custom</text>')
    p.append(f'<rect x="84" y="142" width="64" height="24" rx="8" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.10)"/><text x="94" y="158" font-family="system-ui,sans-serif" font-size="13" fill="#fff">300</text>')
    p.append('<text x="158" y="158" font-family="system-ui,sans-serif" font-size="12" fill="#6b7681">seconds</text>')
    # filters card
    p.append(f'<rect x="16" y="192" width="{POPW-32}" height="160" rx="14" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.08)"/>')
    p.append('<text x="30" y="216" font-family="system-ui,sans-serif" font-size="11" font-weight="600" letter-spacing="1" fill="#6b7681">FILTERS</text>')
    rows=[('skip replies',1),('keep reposts',1),('keep media-only posts',1)]
    ry=232
    for lb,on in rows:
        p.append(f'<text x="30" y="{ry+15}" font-family="system-ui,sans-serif" font-size="14" fill="#dbe2e8">{lb}</text>')
        p.append(toggle(POPW-72,ry+4,on)); ry+=34
    p.append(f'<text x="30" y="{ry+16}" font-family="system-ui,sans-serif" font-size="12" fill="#5b6570">ads are always skipped.</text>')
    return '\n'.join(p)

pop_defs='<radialGradient id="popglow" cx="0.2" cy="0" r="0.9"><stop offset="0" stop-color="#1d3a5f" stop-opacity="0.9"/><stop offset="0.55" stop-color="#0a0d12" stop-opacity="0"/></radialGradient>'
settings = f'''<svg width="1280" height="800" viewBox="0 0 1280 800" xmlns="http://www.w3.org/2000/svg">{DEFS}
  <defs>{pop_defs}</defs>
  <rect width="1280" height="800" fill="url(#bg)"/>
  <rect width="1280" height="800" fill="url(#glowL)"/>
  <text x="1184" y="356" text-anchor="end" font-family="system-ui,sans-serif" font-size="56" font-weight="800" fill="#f2f4f7" letter-spacing="-1">made yours</text>
  <text x="1184" y="402" text-anchor="end" font-family="system-ui,sans-serif" font-size="25" font-weight="500" fill="#8b98a5">custom interval, in seconds.</text>
  <text x="1184" y="438" text-anchor="end" font-family="system-ui,sans-serif" font-size="25" font-weight="500" fill="#8b98a5">filter replies, reposts, media-only.</text>
  <g transform="translate(150,214)" filter="url(#shadow)">
    {popup()}
    <rect x="0.5" y="0.5" width="{POPW-1}" height="371" rx="20" fill="none" stroke="#ffffff" stroke-opacity="0.08"/>
  </g>
</svg>'''
render('03-settings', settings)

# ---------- Scene 4: no API / how it works ----------
def feat(y, title, sub):
    return (f'<text x="150" y="{y}" font-family="system-ui,sans-serif" font-size="26" font-weight="700" fill="#f2f4f7">{title}</text>'
            f'<text x="150" y="{y+30}" font-family="system-ui,sans-serif" font-size="19" font-weight="500" fill="#8b98a5">{sub}</text>')
howitworks = f'''<svg width="1280" height="800" viewBox="0 0 1280 800" xmlns="http://www.w3.org/2000/svg">{DEFS}
  <rect width="1280" height="800" fill="url(#bg)"/>
  <rect width="1280" height="800" fill="url(#glowL)"/>
  <text x="150" y="180" font-family="system-ui,sans-serif" font-size="54" font-weight="800" fill="#f2f4f7" letter-spacing="-1">no API. no cost.</text>
  <text x="150" y="224" font-family="system-ui,sans-serif" font-size="24" font-weight="500" fill="#8b98a5">it reads the x.com tab you already have open.</text>
  <g>
    <rect x="150" y="280" width="56" height="4" rx="2" fill="#1d9bf0"/>
  </g>
  {feat(330,'reads your own session','nothing leaves your browser. no server, no tracking.')}
  {feat(420,'faithful tweet cards','avatar, name, text, images, and engagement.')}
  {feat(510,'reflects the feed you open','For you, Following, or any community.')}
  {feat(600,'launch in a tap','scroll-up pill, toolbar popup, or ⌥⇧X.')}
</svg>'''
render('04-howitworks', howitworks)

# ---------- Scene 5: feed-aware ----------
feedaware = f'''<svg width="1280" height="800" viewBox="0 0 1280 800" xmlns="http://www.w3.org/2000/svg">{DEFS}
  <rect width="1280" height="800" fill="url(#bg)"/>
  <rect width="1280" height="800" fill="url(#glowR)"/>
  <text x="96" y="356" font-family="system-ui,sans-serif" font-size="56" font-weight="800" fill="#f2f4f7" letter-spacing="-1">always your feed</text>
  <text x="98" y="402" font-family="system-ui,sans-serif" font-size="25" font-weight="500" fill="#8b98a5">switch to Following or a community —</text>
  <text x="98" y="438" font-family="system-ui,sans-serif" font-size="25" font-weight="500" fill="#8b98a5">the shower follows what you're viewing.</text>
  <g transform="translate(760,240)" filter="url(#shadow)">
    <g clip-path="url(#cardclip)">{card("Mafex","devmafex","1d","just shipped feed-aware mode. open Following and the shower switches with you. clean.",0.35)}</g>
    <rect x="0.5" y="0.5" width="359" height="319" rx="20" fill="none" stroke="#ffffff" stroke-opacity="0.08"/>
  </g>
</svg>'''
render('05-feed', feedaware)

print("done")
