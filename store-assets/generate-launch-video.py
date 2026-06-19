# FloatX launch video generator.
# Renders 330 animated SVG frames -> PNG (rsvg-convert), then encode with:
#   ffmpeg -y -framerate 30 -i frames/f%04d.png -c:v libx264 -pix_fmt yuv420p \
#     -crf 18 -movflags +faststart floatx-launch.mp4
# Requires base64 data-URI assets at /tmp/{av,av2,media,media2}.b64
import subprocess, os, math

FPS=30; DUR=11; N=FPS*DUR  # 330 frames
W=1280; H=800
FR='/tmp/fxvid/frames'
os.makedirs(FR, exist_ok=True)
AV=open('/tmp/av.b64').read().strip()
AV2=open('/tmp/av2.b64').read().strip()
MED=open('/tmp/media.b64').read().strip()
MED2=open('/tmp/media2.b64').read().strip()

# ---------- easing ----------
def clamp(x,a=0.0,b=1.0): return max(a,min(b,x))
def lerp(a,b,t): return a+(b-a)*t
def ease_out(t): t=clamp(t); return 1-(1-t)**3
def ease_in_out(t): t=clamp(t); return 3*t*t-2*t*t*t
def seg(t,a,b):
    # normalized progress of global t within [a,b]
    if b<=a: return 1.0 if t>=b else 0.0
    return clamp((t-a)/(b-a))

# ---------- shared bits ----------
DEFS=f'''<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a0c10"/><stop offset="1" stop-color="#11151b"/></linearGradient>
  <radialGradient id="glow" cx="0.3" cy="0.1" r="0.9"><stop offset="0" stop-color="#1d9bf0" stop-opacity="0.22"/><stop offset="0.62" stop-color="#1d9bf0" stop-opacity="0"/></radialGradient>
  <linearGradient id="cardbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#15191f"/><stop offset="1" stop-color="#0a0c10"/></linearGradient>
  <radialGradient id="cardglow" cx="0.12" cy="0" r="0.7"><stop offset="0" stop-color="#1d9bf0" stop-opacity="0.20"/><stop offset="1" stop-color="#1d9bf0" stop-opacity="0"/></radialGradient>
  <clipPath id="cardclip"><rect x="0" y="0" width="360" height="320" rx="20"/></clipPath>
  <clipPath id="avclip"><circle cx="36" cy="38" r="20"/></clipPath>
  <clipPath id="medclip"><rect x="16" y="104" width="328" height="158" rx="14"/></clipPath>
  <linearGradient id="ctrlgrad" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0.6"/><stop offset="0.5" stop-color="#000" stop-opacity="0"/></linearGradient>
  <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="30" stdDeviation="34" flood-color="#000" flood-opacity="0.6"/></filter>
</defs>'''

def wrap(text,maxc,maxl):
    words=text.split(); lines=[]; cur=''
    for w in words:
        if len(cur)+len(w)+1>maxc and cur:
            lines.append(cur); cur=w
            if len(lines)>=maxl: break
        else: cur=(cur+' '+w).strip()
    if len(lines)<maxl and cur: lines.append(cur)
    return lines

def eng_row(y,vals):
    cols=[22,104,186,268]; s='stroke="#71767b" stroke-width="1.4" fill="none" stroke-linejoin="round" stroke-linecap="round"'; out=[]
    cx=cols[0]+6; out.append(f'<path d="M{cx-6} {y-5} H{cx+6} V{y+2} H{cx-2} L{cx-6} {y+6} Z" {s}/>')
    cx=cols[1]+6; out.append(f'<path d="M{cx-5} {y-1} V{y-4} H{cx+4}" {s}/><path d="M{cx+2} {y-6} L{cx+5} {y-4} L{cx+2} {y-2}" {s}/><path d="M{cx+5} {y+1} V{y+4} H{cx-4}" {s}/><path d="M{cx-2} {y+6} L{cx-5} {y+4} L{cx-2} {y+2}" {s}/>')
    cx=cols[2]+6; out.append(f'<path d="M{cx} {y+5} C{cx-7} {y} {cx-5} {y-6} {cx} {y-2} C{cx+5} {y-6} {cx+7} {y} {cx} {y+5} Z" {s}/>')
    cx=cols[3]+6; out.append(f'<path d="M{cx-5} {y+5} V{y+1} M{cx-1} {y+5} V{y-2} M{cx+3} {y+5} V{y-5}" {s}/>')
    for i,c in enumerate(cols): out.append(f'<text x="{c+19}" y="{y+4}" font-family="system-ui,sans-serif" font-size="12" font-weight="500" fill="#71767b">{vals[i]}</text>')
    return ''.join(out)

def card_inner(post, progress):
    p=[f'<rect width="360" height="320" fill="url(#cardbg)"/>',
       f'<rect width="360" height="320" fill="url(#cardglow)"/>',
       f'<rect width="360" height="1" fill="#ffffff" opacity="0.06"/>']
    p.append(f'<image href="{post["av"]}" x="16" y="18" width="40" height="40" clip-path="url(#avclip)" preserveAspectRatio="xMidYMid slice"/>')
    namew=len(post["name"])*8.5
    p.append(f'<text x="66" y="33" font-family="system-ui,sans-serif" font-size="15" font-weight="700" fill="#e7e9ea">{post["name"]}</text>')
    p.append(f'<g transform="translate({66+namew+4},22)"><circle cx="7" cy="7" r="7" fill="#1d9bf0"/><path d="M4.2 7.3 L6.3 9.2 L10 4.8" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>')
    p.append(f'<text x="66" y="51" font-family="system-ui,sans-serif" font-size="14" fill="#71767b">@{post["handle"]}</text>')
    p.append(f'<text x="344" y="33" text-anchor="end" font-family="system-ui,sans-serif" font-size="14" fill="#71767b">{post["time"]}</text>')
    y=82
    if post.get("text"):
        for ln in wrap(post["text"],42, 3 if post.get("media") else 7):
            p.append(f'<text x="16" y="{y+12}" font-family="system-ui,sans-serif" font-size="15.5" fill="#e7e9ea">{ln}</text>'); y+=20
    if post.get("media"):
        p.append(f'<g clip-path="url(#medclip)"><rect x="16" y="104" width="328" height="158" fill="#1b2027"/><image href="{post["media"]}" x="16" y="104" width="328" height="158" preserveAspectRatio="xMidYMid slice"/></g>')
    p.append(eng_row(294,post["eng"]))
    p.append(f'<rect x="0" y="317" width="360" height="3" fill="#ffffff" opacity="0.12"/>')
    p.append(f'<rect x="0" y="317" width="{360*clamp(progress):.1f}" height="3" fill="#1d9bf0"/>')
    return ''.join(p)

def logo(cx,cy,scale,opacity):
    # X-mark logo on glass tile (128-unit), centered at (cx,cy), scaled.
    s=scale
    return f'''<g transform="translate({cx},{cy}) scale({s}) translate(-64,-64)" opacity="{opacity:.3f}">
      <rect x="10" y="10" width="108" height="108" rx="28" fill="url(#cardbg)"/>
      <rect x="10" y="10" width="108" height="108" rx="28" fill="url(#cardglow)"/>
      <rect x="10.5" y="10.5" width="107" height="107" rx="27.5" fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="1.5"/>
      <g transform="translate(64,58) scale(3.0) translate(-12,-12)">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="#f2f4f7"/>
      </g>
      <rect x="40" y="98" width="48" height="6" rx="3" fill="#1d9bf0"/>
    </g>'''

def ctrl_buttons(opacity):
    if opacity<=0.01: return ''
    cy=190
    btns=[('M6 5v14M17 5 8 12l9 7z',120),('M7 5h3v14H7zM14 5h3v14h-3z',180),('M18 5v14M7 5l9 7-9 7z',240)]
    out=[f'<rect x="0" y="150" width="360" height="170" fill="url(#ctrlgrad)" opacity="{opacity:.3f}"/>']
    for d,cx in btns:
        out.append(f'<g opacity="{opacity:.3f}"><circle cx="{cx}" cy="{cy}" r="27" fill="#000" opacity="0.45"/><circle cx="{cx}" cy="{cy}" r="27" fill="#fff" opacity="0.16"/><g transform="translate({cx-12},{cy-12})" fill="#fff">{f"<path d=\"{d}\"/>"}</g></g>')
    return ''.join(out)

POSTS=[
  {"name":"Mafex","handle":"devmafex","time":"2h","av":AV,"text":"building floatX in public. it floats your timeline in a little glass window and drips one post at a time. calm and ambient.","eng":["128","2.1K","18K","240K"]},
  {"name":"Mafex","handle":"devmafex","time":"5h","av":AV,"media":MED,"text":"shipped the glass UI today","eng":["64","980","7.7K","92K"]},
  {"name":"Mafex","handle":"devmafex","time":"1d","av":AV2,"media":MED2,"text":"","eng":["40","512","6.1K","120K"]},
]

def frame(i):
    t=i/(N-1)  # 0..1 over 11s
    el=[f'<svg width="{W}" height="{H}" viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg">',DEFS,
        f'<rect width="{W}" height="{H}" fill="url(#bg)"/>',
        f'<rect width="{W}" height="{H}" fill="url(#glow)"/>']

    # ---- TIMELINE (in fraction of whole 0..1) ----
    # 0.00-0.16 logo assembles center
    # 0.16-0.30 logo shrinks to left, wordmark+tagline fade in
    # 0.30-0.85 PiP card flies in right, advances posts, progress fills
    # 0.62-0.85 hover controls appear (on the media post)
    # 0.85-1.00 final lockup: everything settles, tagline crisp

    # ----- LOGO -----
    intro=seg(t,0.0,0.16)
    move=seg(t,0.16,0.30)
    # center (640,400) scale ~2.0 -> left (150,360) scale ~0.7
    lx=lerp(640,150,ease_in_out(move)); ly=lerp(400,344,ease_in_out(move))
    lsc=lerp(2.0,0.62,ease_in_out(move))
    lop=ease_out(intro)
    el.append(logo(lx,ly,lsc,lop))

    # ----- WORDMARK + TAGLINE (appear during/after move) -----
    wm=seg(t,0.24,0.36)
    if wm>0:
        wy=lerp(20,0,ease_out(wm))
        el.append(f'<g opacity="{ease_out(wm):.3f}" transform="translate(0,{wy:.1f})">')
        el.append(f'<text x="232" y="332" font-family="system-ui,sans-serif" font-size="62" font-weight="800" fill="#f2f4f7" letter-spacing="-1.5">FloatX</text>')
        el.append(f'<text x="234" y="372" font-family="system-ui,sans-serif" font-size="23" font-weight="500" fill="#8b98a5">your X timeline, floating on screen</text>')
        el.append('</g>')
    # subtagline fades in a touch later, stays till end
    st=seg(t,0.34,0.44)
    if st>0:
        el.append(f'<text x="234" y="408" font-family="system-ui,sans-serif" font-size="18" font-weight="500" fill="#5b6570" opacity="{ease_out(st):.3f}">no API · no cost · reads the tab you already have open</text>')

    # ----- PiP CARD -----
    cardin=seg(t,0.30,0.42)
    if cardin>0:
        # fly in from right+down to resting pos
        rest_x=760; rest_y=240
        cx=lerp(rest_x+120, rest_x, ease_out(cardin))
        cy=lerp(rest_y+60, rest_y, ease_out(cardin))
        cop=ease_out(cardin)
        sc=lerp(0.92,1.0,ease_out(cardin))

        # which post + progress: advance through posts between 0.42 and 0.86
        adv=seg(t,0.42,0.86)
        # 3 posts, each gets ~1/3 of the window; progress bar fills within each
        slot=adv*3.0  # 0..3
        idx=min(2,int(slot))
        local=slot-idx  # 0..1 within current post
        post=POSTS[idx]
        prog=local
        # small slide between posts
        slide_in=ease_out(clamp(local/0.12))
        post_dx=lerp(10,0,slide_in)

        el.append(f'<g transform="translate({cx:.1f},{cy:.1f}) scale({sc:.3f})" filter="url(#shadow)" opacity="{cop:.3f}">')
        el.append(f'<g transform="translate({post_dx:.1f},0)"><g clip-path="url(#cardclip)">')
        el.append(card_inner(post,prog))
        # controls overlay on the media posts, in the back third
        ctl=seg(t,0.66,0.74)*(1.0 if idx>=1 else 0.0)
        if ctl>0: el.append(ctrl_buttons(ctl* (1-seg(t,0.92,1.0)) ))
        el.append('</g></g>')
        el.append(f'<rect x="0.5" y="0.5" width="359" height="319" rx="20" fill="none" stroke="#ffffff" stroke-opacity="0.08"/>')
        el.append('</g>')

    el.append('</svg>')
    return ''.join(el)

# render frames
print(f"rendering {N} frames...")
for i in range(N):
    svg=frame(i)
    sp=f'{FR}/f{i:04d}.svg'; pp=f'{FR}/f{i:04d}.png'
    open(sp,'w').write(svg)
    subprocess.run(['rsvg-convert','-w',str(W),'-h',str(H),sp,'-o',pp],check=True)
    os.remove(sp)
    if i%30==0: print(f"  {i}/{N}")
print("frames done")
