"""Build Plumi's EX faceplate from the preserved upstream CY234 key artwork.

The face, LCD and interactive key regions all share a 70px vertical offset.
The lower casing extends 24px below the original artwork.
Run from the repository root: python3 scripts/calculator/build-skin.py
"""
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
MODEL = ROOT / "public/calculator/data/CY234"
NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", NS)

skin = ET.fromstring('''<svg xmlns="http://www.w3.org/2000/svg" width="375" height="729" viewBox="0 0 375 729" fill="none">
<defs>
  <linearGradient id="silver" x1="0" y1="0" x2="1" y2="1">
    <stop stop-color="#f9faf9"/><stop offset=".2" stop-color="#a6aaa9"/>
    <stop offset=".43" stop-color="#ecefed"/><stop offset=".67" stop-color="#858b8d"/>
    <stop offset=".87" stop-color="#e9ecea"/><stop offset="1" stop-color="#bdc1bf"/>
  </linearGradient>
  <linearGradient id="ivory" x2=".2" y2="1">
    <stop stop-color="#ffffff"/><stop offset=".15" stop-color="#f4f4ee"/>
    <stop offset=".85" stop-color="#e6e7e1"/><stop offset="1" stop-color="#b3b6b1"/>
  </linearGradient>
  <linearGradient id="blue" x2=".15" y2="1">
    <stop stop-color="#6196ff"/><stop offset=".13" stop-color="#2167ff"/>
    <stop offset=".85" stop-color="#0041ed"/><stop offset="1" stop-color="#002f9d"/>
  </linearGradient>
  <linearGradient id="solar" x2=".5" y2="1">
    <stop stop-color="#4c3023"/><stop offset=".45" stop-color="#2c1e17"/>
    <stop offset="1" stop-color="#493027"/>
  </linearGradient>
  <linearGradient id="bezel" x2="0" y2="1">
    <stop stop-color="#090b0c"/><stop offset=".5" stop-color="#343839"/>
    <stop offset="1" stop-color="#121516"/>
  </linearGradient>
  <pattern id="grip" width="8" height="8" patternUnits="userSpaceOnUse">
    <rect width="8" height="8" fill="#171a1c"/>
    <path d="M0 0h4l4 4v4H4L0 4Z" fill="#23272a"/>
    <path d="m0 0 4 4 4-4M0 4l4 4" fill="none" stroke="#404447" stroke-width=".65" opacity=".65"/>
    <path d="m0 1 3 3-3 3M5 0 8 3" fill="none" stroke="#090b0d" stroke-width="1"/>
  </pattern>
  <clipPath id="key-art"><rect x="0" y="30" width="375" height="605"/></clipPath>
  <filter id="pressed-edge" x="-10%" y="-15%" width="120%" height="140%">
    <feDropShadow dx="0" dy="1.5" stdDeviation=".7" flood-color="#000000" flood-opacity=".8"/>
  </filter>
</defs>
<!-- Silver shell, inset textured face and a fine highlight around the edge. -->
<rect x=".75" y=".75" width="373.5" height="727.5" rx="31" fill="url(#silver)" stroke="#e4e8e8" stroke-width="1.5"/>
<rect x="4" y="4" width="367" height="719" rx="28" fill="url(#grip)" stroke="#07090a" stroke-width="1.5"/>
<rect x="7" y="7" width="361" height="712" rx="25" fill="none" stroke="#7c8386" stroke-opacity=".35"/>
<!-- Stacked EX branding and the inset four-cell solar panel. -->
<g font-family="Arial, Helvetica, sans-serif">
  <text x="27" y="34" font-size="25" font-weight="900" fill="#eef1f2" letter-spacing="-.5">CASIO</text>
  <text x="29" y="55" font-size="13.5" font-weight="700" fill="#e1e4e6">fx-991EX</text>
  <text x="27" y="77" font-size="17" font-weight="700" fill="#e679b6" letter-spacing="3.1">CLASSWIZ</text>
</g>
<rect x="196" y="19" width="154" height="66" rx="6" fill="#080a0b" stroke="#676c6a" stroke-width="1.2"/>
<rect x="201" y="24" width="144" height="56" rx="2" fill="url(#solar)"/>
<path d="M237 24v56m36-56v56m36-56v56" stroke="#9b7760" stroke-opacity=".32" stroke-width=".75"/>
<path d="M201 79h144" stroke="#c3a18a" stroke-opacity=".25"/>
</svg>''')

art = ET.SubElement(skin, f"{{{NS}}}g", {"transform": "translate(0 70)", "clip-path": "url(#key-art)"})
original = ET.parse(MODEL / "face.svg").getroot()
for index, element in enumerate(original):
    if index == 0:  # Replace the old flat grey background with the new casing.
        continue
    fill = element.get("fill")
    if fill == "#999999":
        element.set("fill", "url(#silver)")
        element.set("stroke", "#d4d8d6")
        element.set("stroke-width", ".45")
        element.set("filter", "url(#pressed-edge)")
    elif fill == "#333333":
        element.set("fill", "#07090a")
    elif fill == "#EBEBEB":
        element.set("fill", "url(#ivory)")
        element.set("filter", "url(#pressed-edge)")
    elif fill == "#4077FF":
        element.set("fill", "url(#blue)")
        element.set("filter", "url(#pressed-edge)")
    elif fill == "#141414":
        element.set("fill", "url(#bezel)")
        element.set("stroke", "#080a0b")
        element.set("stroke-width", "2")
    elif fill == "#D6E3D6":
        element.set("fill", "#c1cec0")
    elif fill == "#FF7878":
        element.set("fill", "#e679b6")
    elif fill == "#FFD766":
        element.set("fill", "#f5d34d")
    art.append(element)

ET.indent(skin)
ET.ElementTree(skin).write(MODEL / "face-plumi.svg", encoding="unicode", xml_declaration=False)
print("Built CY234 face-plumi.svg (375 × 729)")
