# contact sheet: python tools/sheet.py out.png a.png b.png ... (2 per row for landscape, 4 for portrait)
import sys
from PIL import Image
out, files = sys.argv[1], sys.argv[2:]
ims = [Image.open(f).convert("RGB") for f in files]
w, h = ims[0].size; cols = 4 if h > w else 2; tw = 640 if cols == 2 else 300; th = int(h * tw / w)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (cols * tw + (cols - 1) * 6, rows * th + (rows - 1) * 6), (60, 60, 60))
for i, im in enumerate(ims): sheet.paste(im.resize((tw, th), Image.LANCZOS), ((i % cols) * (tw + 6), (i // cols) * (th + 6)))
sheet.save(out)
