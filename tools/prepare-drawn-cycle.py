"""Register complete frame drawings at their boots, without changing their poses."""
from pathlib import Path
import json
from PIL import Image
root=Path('web/assets/tether/drawn-cycle')
# Components are already extracted by plate_tools.py parts. Coordinate ordering
# is read from the actual sheet, not assumed equal-grid bounds (the model drifted).
order=[11,10,9,7,5,6,4,8,3,2,1,0,12,13,22,17,15,14,16,19,21,20,18,23]
metadata=[]
for index,source in enumerate(order):
 im=Image.open(root/f'frame_{source}.png').convert('RGBA')
 px=im.load(); w,h=im.size
 # Remove thin pale generated cord remnants outside the head/hand area.
 for y in range(h):
  for x in range(w):
   r,g,b,a=px[x,y]
   if y<h*0.42 and x>w*0.60 and min(r,g,b)>145 and max(r,g,b)-min(r,g,b)<45:
    px[x,y]=(r,g,b,0)
 alpha=im.getchannel('A'); bbox=alpha.getbbox()
 foot=[]
 for y in range(max(0,bbox[3]-30),bbox[3]):
  for x in range(w):
   r,g,b,a=px[x,y]
   if a>128 and r>g*1.04 and g>b*1.06:
    foot.append(x)
 center=(min(foot)+max(foot))/2 if foot else (bbox[0]+bbox[2])/2
 dx=round(128-center); dy=280-bbox[3]
 canvas=Image.new('RGBA',(256,300))
 canvas.alpha_composite(im,(dx,dy))
 # Locate the skin-colored grip from the complete drawing. Skin is brighter
 # and less saturated than the brown hair; constrain the search above the chest.
 pixels=canvas.load(); skin=[]
 for y in range(15,180):
  for x in range(135,245):
   r,g,b,a=pixels[x,y]
   if a>180 and r>180 and 110<g<225 and 65<b<190 and r-g>15 and g-b>10:
    skin.append((x,y))
 if skin:
  right=max(p[0] for p in skin)
  tip=[p for p in skin if p[0]>=right-7]
  grip=[right,sum(p[1] for p in tip)/len(tip)]
 else: grip=[205,110]
 canvas.save(root/f'pose-{index:02}.png')
 metadata.append({'frame':index,'source_component':source,'offset':[dx,dy],'grip':grip,'feet_baseline':280})
(root/'registration.json').write_text(json.dumps(metadata,indent=2)+'\n')
print('Registered 24 complete drawings; no pose deformation or cross-fading.')
