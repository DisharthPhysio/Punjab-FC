"""
PDF and Excel export generation, shared by the team command centre and the
athlete-facing history views. Kept as pure functions (data in, bytes out) so
they're easy to test without touching the database or FastAPI.
"""
import io
from datetime import datetime
from typing import List, Optional

import matplotlib
matplotlib.use("Agg")  # headless server, no display available
import matplotlib.pyplot as plt

from openpyxl import Workbook
from openpyxl.chart import BarChart, Reference
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable, Image

# ---- shared brand palette (kept in sync with the app's own risk colours) ----
BRAND_HEX = "#10B981"
RED_HEX = "#E11D48"
AMBER_HEX = "#F97316"   # deliberately red-leaning orange, not yellow, per request
GREEN_HEX = "#10B981"
INK_HEX = "#0B0F17"
MUTED_HEX = "#6B7280"

BRAND = colors.HexColor(BRAND_HEX)
INK = colors.HexColor(INK_HEX)
MUTED = colors.HexColor(MUTED_HEX)
ROW_ALT = colors.HexColor("#F3F4F6")
RISK_COLORS = {"red": colors.HexColor(RED_HEX), "amber": colors.HexColor(AMBER_HEX), "green": colors.HexColor(GREEN_HEX)}
RISK_FILL = {
    "red": PatternFill(start_color="FCE4E9", end_color="FCE4E9", fill_type="solid"),
    "amber": PatternFill(start_color="FDE9DA", end_color="FDE9DA", fill_type="solid"),
    "green": PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid"),
}
RISK_FONT = {
    "red": Font(color="B0113A", bold=True),
    "amber": Font(color="C2410C", bold=True),
    "green": Font(color="067A46", bold=True),
}

plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 10, "axes.edgecolor": "#E5E7EB",
    "axes.linewidth": 0.8, "text.color": INK_HEX, "axes.labelcolor": MUTED_HEX,
    "xtick.color": MUTED_HEX, "ytick.color": MUTED_HEX,
})


def _fig_to_png(fig, dpi=170) -> bytes:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=dpi, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    buf.seek(0)
    return buf.read()


def _styles():
    ss = getSampleStyleSheet()
    ss.add(ParagraphStyle("PfcTitle", parent=ss["Title"], textColor=INK, fontSize=20, spaceAfter=2))
    ss.add(ParagraphStyle("PfcSubtitle", parent=ss["Normal"], textColor=MUTED, fontSize=10, spaceAfter=10))
    ss.add(ParagraphStyle("PfcSection", parent=ss["Heading2"], textColor=INK, fontSize=13, spaceBefore=14, spaceAfter=6))
    ss.add(ParagraphStyle("PfcFoot", parent=ss["Normal"], fontSize=7.5, textColor=MUTED))
    return ss


def _header(story, styles, title, subtitle):
    story.append(Paragraph(title, styles["PfcTitle"]))
    story.append(Paragraph(subtitle, styles["PfcSubtitle"]))
    story.append(HRFlowable(width="100%", thickness=2, color=BRAND, spaceAfter=12))


def _stat_cards(items) -> Table:
    """items: list of (label, value, accent_hex|None). Renders as a row of boxes."""
    ss = getSampleStyleSheet()
    label_style = ParagraphStyle("CardLabel", parent=ss["Normal"], fontSize=8, textColor=MUTED, spaceAfter=4, leading=10)
    cells = []
    for label, value, accent in items:
        color_hex = accent or MUTED_HEX
        value_style = ParagraphStyle("CardValue", parent=ss["Normal"], fontSize=20, textColor=colors.HexColor(color_hex),
                                      fontName="Helvetica-Bold", leading=24)
        cells.append([Paragraph(label.upper(), label_style), Paragraph(str(value), value_style)])
    # each cell is a tiny 2-row sub-table (label above value) so the two never overlap
    row = []
    for cell in cells:
        sub = Table([[cell[0]], [cell[1]]])
        sub.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
        row.append(sub)
    t = Table([row], colWidths=[(170 * mm) / len(items)] * len(items))
    t.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#E5E7EB")),
        ("INNERGRID", (0, 0), (-1, -1), 0.75, colors.HexColor("#E5E7EB")),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FAFAFA")),
        ("TOPPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 12), ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return t


def _table(rows, col_widths, risk_col: Optional[int] = None):
    t = Table(rows, colWidths=col_widths, repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
        ("TOPPADDING", (0, 0), (-1, 0), 8),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, ROW_ALT]),
        ("TOPPADDING", (0, 1), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 5),
    ]
    if risk_col is not None:
        for i, row in enumerate(rows[1:], start=1):
            level = row[risk_col].lower() if isinstance(row[risk_col], str) else None
            for key, c in RISK_COLORS.items():
                if level and level.startswith(key):
                    style.append(("TEXTCOLOR", (risk_col, i), (risk_col, i), c))
                    style.append(("FONTNAME", (risk_col, i), (risk_col, i), "Helvetica-Bold"))
    t.setStyle(TableStyle(style))
    return t


def _fmt_date(d: str) -> str:
    try:
        return datetime.strptime(d, "%Y-%m-%d").strftime("%d %b")
    except Exception:
        return d


def _footer(story, styles, note):
    story.append(Spacer(1, 14))
    story.append(Paragraph(note, styles["PfcFoot"]))


# ---------------------------------------------------------------- charts
def _risk_distribution_chart(players: List[dict]) -> bytes:
    counts = {"green": 0, "amber": 0, "red": 0}
    for p in players:
        if p.get("riskLevel") in counts:
            counts[p["riskLevel"]] += 1
    labels, values, bar_colors = ["Good", "Watch", "Needs attention"], [counts["green"], counts["amber"], counts["red"]], [GREEN_HEX, AMBER_HEX, RED_HEX]
    fig, ax = plt.subplots(figsize=(6.6, 1.9))
    bars = ax.barh(labels, values, color=bar_colors, height=0.6)
    for bar, v in zip(bars, values):
        ax.text(bar.get_width() + max(values + [1]) * 0.02, bar.get_y() + bar.get_height() / 2, str(v),
                va="center", fontsize=11, fontweight="bold", color=INK_HEX)
    ax.set_xlim(0, max(values + [1]) * 1.25)
    ax.invert_yaxis()
    for spine in ("top", "right", "bottom"):
        ax.spines[spine].set_visible(False)
    ax.set_xticks([])
    ax.tick_params(axis="y", length=0, labelsize=11)
    fig.tight_layout()
    return _fig_to_png(fig)


def _load_trend_chart(checkins: List[dict]) -> Optional[bytes]:
    rows = sorted([c for c in checkins if c.get("sleepQuality")], key=lambda x: x["date"])
    if len(rows) < 2:
        return None
    dates = [_fmt_date(r["date"]) for r in rows]
    loads = [r.get("load") or 0 for r in rows]
    quality = [r.get("sleepQuality") or 0 for r in rows]

    fig, ax1 = plt.subplots(figsize=(6.6, 2.6))
    ax1.bar(dates, loads, color=BRAND_HEX, alpha=0.85, width=0.6, label="Session load")
    ax1.set_ylabel("Load", fontsize=9)
    ax1.tick_params(axis="x", rotation=45, labelsize=8)
    for spine in ("top", "right"):
        ax1.spines[spine].set_visible(False)

    ax2 = ax1.twinx()
    ax2.plot(dates, quality, color="#F59E0B", marker="o", markersize=3, linewidth=1.8, label="Sleep quality")
    ax2.set_ylim(0, 5.5)
    ax2.set_ylabel("Sleep quality (1-5)", fontsize=9)
    ax2.spines["top"].set_visible(False)

    if len(dates) > 14:
        step = max(1, len(dates) // 14)
        for i, label in enumerate(ax1.get_xticklabels()):
            label.set_visible(i % step == 0)

    fig.legend(loc="upper left", bbox_to_anchor=(0.08, 1.02), ncol=2, fontsize=8, frameon=False)
    fig.tight_layout()
    return _fig_to_png(fig)


def _gps_chart(sessions: List[dict]) -> Optional[bytes]:
    rows = sorted([s for s in sessions if s.get("distance_m") is not None], key=lambda x: x["date"])
    if len(rows) < 2:
        return None
    dates = [_fmt_date(r["date"]) for r in rows]
    distances = [r.get("distance_m") or 0 for r in rows]
    internal = [r.get("internal_load") for r in rows]

    fig, ax1 = plt.subplots(figsize=(6.6, 2.6))
    ax1.bar(dates, distances, color=BRAND_HEX, alpha=0.85, width=0.6, label="Distance (m)")
    ax1.set_ylabel("Distance (m)", fontsize=9)
    ax1.tick_params(axis="x", rotation=45, labelsize=8)
    for spine in ("top", "right"):
        ax1.spines[spine].set_visible(False)

    ax2 = ax1.twinx()
    valid = [(d, v) for d, v in zip(dates, internal) if v is not None]
    if valid:
        vd, vv = zip(*valid)
        ax2.plot(vd, vv, color="#F59E0B", marker="o", markersize=3, linewidth=1.8, label="Internal load")
    ax2.set_ylabel("Internal load", fontsize=9)
    ax2.spines["top"].set_visible(False)

    fig.legend(loc="upper left", bbox_to_anchor=(0.08, 1.02), ncol=2, fontsize=8, frameon=False)
    fig.tight_layout()
    return _fig_to_png(fig)


def _img_flowable(png_bytes: Optional[bytes], width_mm=170, height_mm=48):
    if not png_bytes:
        return None
    return Image(io.BytesIO(png_bytes), width=width_mm * mm, height=height_mm * mm)


# ---------------------------------------------------------------- team roster PDF
def generate_team_pdf(team_name: str, summary: dict, players: List[dict]) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=18 * mm, bottomMargin=16 * mm, leftMargin=16 * mm, rightMargin=16 * mm)
    styles = _styles()
    story = []
    generated = datetime.now().strftime("%d %b %Y, %H:%M")
    _header(story, styles, team_name, f"Squad status report · generated {generated}")

    story.append(_stat_cards([
        ("Checked in today", f"{summary.get('checkedIn', 0)}/{summary.get('total', 0)}", BRAND_HEX),
        ("Need attention", summary.get("flagged", 0), RED_HEX if summary.get("flagged") else GREEN_HEX),
        ("Squad size", summary.get("total", 0), None),
    ]))
    story.append(Spacer(1, 12))

    chart = _risk_distribution_chart(players)
    if chart:
        story.append(Paragraph("Risk distribution", styles["PfcSection"]))
        story.append(_img_flowable(chart, height_mm=32))
        story.append(Spacer(1, 6))

    story.append(Paragraph("Squad detail", styles["PfcSection"]))
    header_row = ["Player", "Status", "Risk", "Week load", "Monotony", "ACWR", "Readiness"]
    rows = [header_row]
    for p in players:
        if not p.get("joined"):
            rows.append([p["name"], "Not joined", "—", "—", "—", "—", "—"])
            continue
        rows.append([
            p["name"],
            "Checked in" if p.get("checkedInToday") else "Not today",
            (p.get("riskLevel") or "—").capitalize(),
            str(p.get("weekLoad", "—")),
            str(p.get("monotony") if p.get("monotony") is not None else "—"),
            str(p.get("acwr") if p.get("acwr") is not None else "—"),
            f"{p['readinessToday']}/100" if p.get("readinessToday") is not None else "—",
        ])
    story.append(_table(rows, col_widths=[38 * mm, 24 * mm, 20 * mm, 22 * mm, 22 * mm, 18 * mm, 22 * mm], risk_col=2))

    _footer(story, styles,
            "Risk score is a triage aid combining ACWR, monotony, and today's illness/soreness/readiness signals — "
            "not a medical diagnosis. Generated by the Load &amp; Recovery Platform.")
    doc.build(story)
    return buf.getvalue()


def generate_team_excel(team_name: str, players: List[dict]) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Squad"

    headers = ["Player", "Status", "Risk level", "Risk score", "Avg load", "Peak load", "Week load",
               "Monotony", "Strain", "ACWR", "Readiness today", "Readiness (week avg)"]
    ws.append(headers)
    header_fill = PatternFill(start_color="0B0F17", end_color="0B0F17", fill_type="solid")
    for col in range(1, len(headers) + 1):
        c = ws.cell(row=1, column=col)
        c.font = Font(color="FFFFFF", bold=True)
        c.fill = header_fill
        c.alignment = Alignment(horizontal="center")

    risk_col_idx = 3  # "Risk level"
    for p in players:
        if not p.get("joined"):
            ws.append([p["name"], "Not joined"] + ["—"] * (len(headers) - 2))
            continue
        ws.append([
            p["name"], "Checked in today" if p.get("checkedInToday") else "Not checked in today",
            (p.get("riskLevel") or "—").capitalize(), p.get("riskScore", "—"),
            p.get("avgLoad", "—"), p.get("peakLoad", "—"), p.get("weekLoad", "—"),
            p.get("monotony", "—"), p.get("strain", "—"), p.get("acwr", "—"),
            p.get("readinessToday", "—"), p.get("readinessWeekAvg", "—"),
        ])
        row_idx = ws.max_row
        level = (p.get("riskLevel") or "").lower()
        if level in RISK_FILL:
            cell = ws.cell(row=row_idx, column=risk_col_idx)
            cell.fill = RISK_FILL[level]
            cell.font = RISK_FONT[level]

    for col in range(1, len(headers) + 1):
        ws.column_dimensions[get_column_letter(col)].width = 16
    ws.column_dimensions["A"].width = 20
    ws.freeze_panes = "A2"

    # native Excel chart: week load per joined player, so it's interactive/editable, not just an image
    joined_rows = [i for i, p in enumerate(players, start=2) if p.get("joined")]
    if len(joined_rows) >= 2:
        chart = BarChart()
        chart.title = "Week load by player"
        chart.y_axis.title = "Load"
        chart.style = 10
        data = Reference(ws, min_col=7, min_row=1, max_row=ws.max_row)  # "Week load" column
        cats = Reference(ws, min_col=1, min_row=2, max_row=ws.max_row)
        chart.add_data(data, titles_from_data=True)
        chart.set_categories(cats)
        chart.width, chart.height = 18, 9
        ws.add_chart(chart, f"A{ws.max_row + 3}")

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# ---------------------------------------------------------------- athlete history PDF
def generate_history_pdf(person_name: str, context_label: str, checkins: List[dict]) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=18 * mm, bottomMargin=16 * mm, leftMargin=16 * mm, rightMargin=16 * mm)
    styles = _styles()
    story = []
    generated = datetime.now().strftime("%d %b %Y, %H:%M")
    _header(story, styles, person_name, f"{context_label} · generated {generated}")

    loads = [c.get("load") or 0 for c in checkins]
    avg_load = round(sum(loads) / len(loads)) if loads else 0
    peak_load = max(loads) if loads else 0
    story.append(_stat_cards([
        ("Check-ins logged", len(checkins), None),
        ("Average load", avg_load, BRAND_HEX),
        ("Peak load", peak_load, BRAND_HEX),
    ]))
    story.append(Spacer(1, 12))

    chart = _load_trend_chart(checkins)
    if chart:
        story.append(Paragraph("Load & sleep quality over time", styles["PfcSection"]))
        story.append(_img_flowable(chart, height_mm=44))
        story.append(Spacer(1, 6))

    story.append(Paragraph("Daily detail", styles["PfcSection"]))
    header_row = ["Date", "Sleep", "Hydration", "Motivation", "Soreness", "Illness", "Session load"]
    rows = [header_row]
    for c in sorted(checkins, key=lambda x: x["date"], reverse=True):
        sleep = f"{c['sleepHours']}h · {c['sleepQuality']}/5" if c.get("sleepHours") is not None else f"{c.get('sleepQuality','—')}/5"
        soreness = f"{c.get('sorenessSeverity', 0)}/5" if c.get("sorenessSeverity") else "—"
        illness = "Yes" if c.get("feelingIll") else "—"
        load = str(c["load"]) if c.get("load") else "—"
        rows.append([_fmt_date(c["date"]), sleep, f"{c.get('hydration','—')}/5", f"{c.get('motivation','—')}/5", soreness, illness, load])

    story.append(_table(rows, col_widths=[24 * mm, 28 * mm, 22 * mm, 24 * mm, 22 * mm, 18 * mm, 24 * mm]))
    _footer(story, styles, "Generated by the Load &amp; Recovery Platform.")
    doc.build(story)
    return buf.getvalue()


# ---------------------------------------------------------------- GPS analysis PDF (optional feature)
def generate_gps_pdf(team_name: str, player_name: str, sessions: List[dict], correlation: Optional[float]) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=18 * mm, bottomMargin=16 * mm, leftMargin=16 * mm, rightMargin=16 * mm)
    styles = _styles()
    story = []
    generated = datetime.now().strftime("%d %b %Y, %H:%M")
    _header(story, styles, f"{player_name} — GPS load analysis", f"{team_name} · generated {generated}")

    story.append(_stat_cards([
        ("Sessions logged", len(sessions), None),
        ("Distance ↔ internal load", correlation if correlation is not None else "—", BRAND_HEX),
    ]))
    story.append(Spacer(1, 12))

    chart = _gps_chart(sessions)
    if chart:
        story.append(Paragraph("Distance vs. internal (session-RPE) load", styles["PfcSection"]))
        story.append(_img_flowable(chart, height_mm=44))
        story.append(Spacer(1, 6))

    story.append(Paragraph("Session detail", styles["PfcSection"]))
    header_row = ["Date", "Distance (m)", "HSR distance (m)", "Sprints", "Max speed (km/h)", "Internal load"]
    rows = [header_row]
    for s in sorted(sessions, key=lambda x: x["date"], reverse=True):
        rows.append([
            _fmt_date(s["date"]), str(s.get("distance_m", "—")), str(s.get("hsr_distance_m", "—")),
            str(s.get("sprints", "—")), str(s.get("max_speed_kmh", "—")), str(s.get("internal_load", "—")),
        ])
    story.append(_table(rows, col_widths=[24 * mm, 28 * mm, 30 * mm, 20 * mm, 30 * mm, 34 * mm]))
    _footer(story, styles,
            "External load (GPS) and internal load (session-RPE = RPE × duration) measure different things — "
            "research shows total distance correlates well with session-RPE, while high-speed running and "
            "accelerations often don't, and that gap is informative, not an error. Generated by the Load &amp; "
            "Recovery Platform.")
    doc.build(story)
    return buf.getvalue()
