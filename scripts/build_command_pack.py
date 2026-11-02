from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Preformatted, KeepTogether
from reportlab.lib.units import mm
import re

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "products" / "network-command-pack"
OUT = ROOT / "dist" / "network-command-pack"
OUT.mkdir(parents=True, exist_ok=True)

def render(source: Path, target: Path, language: str):
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="PackTitle", parent=styles["Title"], fontSize=19, leading=23, textColor=colors.HexColor("#17324d")))
    styles.add(ParagraphStyle(name="PackH2", parent=styles["Heading2"], fontSize=12, leading=15, textColor=colors.HexColor("#17324d"), spaceBefore=10))
    styles.add(ParagraphStyle(name="PackH3", parent=styles["Heading3"], fontSize=9, leading=11, textColor=colors.HexColor("#245b78"), spaceBefore=7, keepWithNext=True))
    styles.add(ParagraphStyle(name="PackBody", parent=styles["BodyText"], fontSize=8, leading=11, spaceAfter=4))
    styles.add(ParagraphStyle(name="PackCode", fontName="Courier", fontSize=7, leading=9, leftIndent=7, backColor=colors.HexColor("#eef3f7"), borderPadding=5, spaceBefore=2, spaceAfter=5))
    story, code, in_code = [], [], False
    for raw in source.read_text(encoding="utf-8").splitlines():
        line = raw.rstrip()
        if line.strip().startswith("```"):
            if in_code:
                story.append(Preformatted("\\n".join(code), styles["PackCode"]))
                code, in_code = [], False
            else:
                in_code = True
            continue
        if in_code:
            code.append(line)
            continue
        if not line.strip():
            story.append(Spacer(1, 2))
        elif line.startswith("# "):
            story.append(Paragraph(line[2:], styles["PackTitle"]))
        elif line.startswith("## "):
            story.append(Paragraph(line[3:], styles["PackH2"]))
        elif line.startswith("### "):
            story.append(Paragraph(line[4:], styles["PackH3"]))
        elif line.startswith("**") and line.endswith("**"):
            story.append(Paragraph("<b>" + line[2:-2] + "</b>", styles["PackBody"]))
        else:
            safe = line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            safe = re.sub(r"\\*\\*(.+?)\\*\\*", r"<b>\\1</b>", safe)
            safe = re.sub(r"`([^`]+)`", r"<font name='Courier'>\\1</font>", safe)
            story.append(Paragraph(safe, styles["PackBody"]))
    if code:
        story.append(Preformatted("\\n".join(code), styles["PackCode"]))
    SimpleDocTemplate(str(target), pagesize=A4, rightMargin=16*mm, leftMargin=16*mm, topMargin=15*mm, bottomMargin=15*mm, title=target.stem).build(story)

tr = SRC / "COMMANDS-TR.md"
en = SRC / "COMMANDS-EN.md"
tr_pdf = OUT / "NetCmd_Ag_Komut_Paketi_TR.pdf"
en_pdf = OUT / "NetCmd_Network_Command_Pack_EN.pdf"
render(tr, tr_pdf, "tr")
render(en, en_pdf, "en")
archive = OUT / "NetCmd_Network_Command_Pack_v1.zip"
with ZipFile(archive, "w", ZIP_DEFLATED) as z:
    for path in (tr_pdf, en_pdf, tr, en, SRC / "PRODUCT-SPEC.md", SRC / "README.md"):
        if path.exists():
            z.write(path, path.name)
print(f"Generated: {tr_pdf.stat().st_size} bytes; {en_pdf.stat().st_size} bytes; {archive.stat().st_size} bytes")
