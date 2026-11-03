"""
Presentable PDF + Excel reports built on top of metrics.py / insights.py.

  build_player_pdf(...)   one player (coach view) or the athlete's own copy (athlete view)
  build_team_pdf(...)     squad summary + a full section per player (check-ins, GPS, analysis)
  build_excel(...)        Summary / Check-ins / GPS / Insights sheets for one player or the whole squad

Pure functions: data in, bytes out. The reports are in English (PDF fonts for Hindi/Greek are not bundled).
"""
import io
import os
from datetime import datetime
from html import escape
from typing import List, Optional

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib import get_data_path
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (HRFlowable, Image, KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle)

import insights as I
import metrics as M

# ------------------------------------------------------------------ look & feel
BRAND, RED, AMBER, GREEN = "#10B981", "#E11D48", "#F97316", "#10B981"
INK, MUTED, LINE, SOFT = "#0B0F17", "#6B7280", "#E5E7EB", "#F3F4F6"
SEV = {"red": RED, "amber": AMBER, "green": GREEN, "info": "#64748B", None: "#94A3B8"}
C = colors.HexColor

_ttf = os.path.join(get_data_path(), "fonts", "ttf")                 # DejaVu ships with matplotlib: has arrows, dashes, etc.
pdfmetrics.registerFont(TTFont("DV", os.path.join(_ttf, "DejaVuSans.ttf")))
pdfmetrics.registerFont(TTFont("DV-B", os.path.join(_ttf, "DejaVuSans-Bold.ttf")))
pdfmetrics.registerFontFamily("DV", normal="DV", bold="DV-B", italic="DV", boldItalic="DV-B")

plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 8, "axes.edgecolor": LINE, "axes.linewidth": 0.7,
                     "text.color": INK, "axes.labelcolor": MUTED, "xtick.color": MUTED, "ytick.color": MUTED,
                     "axes.spines.top": False, "axes.spines.right": False})

ST = {
    "h1": ParagraphStyle("h1", fontName="DV-B", fontSize=19, leading=23, textColor=C(INK), spaceAfter=1),
    "h2": ParagraphStyle("h2", fontName="DV-B", fontSize=11.5, leading=14, textColor=C(INK), spaceBefore=9, spaceAfter=4, keepWithNext=1),
    "sub": ParagraphStyle("sub", fontName="DV", fontSize=8.5, leading=11, textColor=C(MUTED)),
    "body": ParagraphStyle("body", fontName="DV", fontSize=8.5, leading=11.5, textColor=C(INK), alignment=TA_LEFT),
    "small": ParagraphStyle("small", fontName="DV", fontSize=7, leading=9, textColor=C(MUTED)),
    "cell": ParagraphStyle("cell", fontName="DV", fontSize=6.6, leading=8, textColor=C(INK)),
    "cellb": ParagraphStyle("cellb", fontName="DV-B", fontSize=6.6, leading=8, textColor=C("#FFFFFF")),
    "tl": ParagraphStyle("tl", fontName="DV-B", fontSize=6.8, leading=8, textColor=C(MUTED)),
    "tv": ParagraphStyle("tv", fontName="DV-B", fontSize=17, leading=20, textColor=C(INK)),
    "ts": ParagraphStyle("ts", fontName="DV", fontSize=7, leading=9, textColor=C(MUTED)),
}
W = 177 * mm                                                         # usable width: A4 minus 14 mm margins minus the frame padding
MAX_ROWS = 400                                                       # table rows per player (safety for very long histories)


def _p(text, style="body"):
    return Paragraph(text, ST[style])


def _fmt_date(d: str) -> str:
    try:
        return datetime.strptime(d, "%Y-%m-%d").strftime("%d %b %y")
    except Exception:
        return d or ""


def _n(v, d=0, suffix="", dash="–"):
    if v is None:
        return dash
    if isinstance(v, float) and d == 0:
        v = int(round(v))
    return f"{v:,.{d}f}{suffix}" if isinstance(v, (int, float)) else str(v)


def _signed(v, suffix="", dash="–"):
    return dash if v is None else f"{'+' if v > 0 else ''}{v}{suffix}"


def _png(fig, dpi=130) -> bytes:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=dpi, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return buf.getvalue()


def _img(png: Optional[bytes], width=W, ratio=0.36):
    if not png:
        return None
    return Image(io.BytesIO(png), width=width, height=width * ratio)


# ------------------------------------------------------------------ page furniture
def _deco(title):
    def draw(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(C(BRAND))
        canvas.rect(0, A4[1] - 9 * mm, A4[0], 9 * mm, fill=1, stroke=0)
        canvas.setFillColor(colors.white)
        canvas.setFont("DV-B", 8)
        canvas.drawString(14 * mm, A4[1] - 6 * mm, "LOAD & RECOVERY MONITORING")
        canvas.setFont("DV", 8)
        canvas.drawRightString(A4[0] - 14 * mm, A4[1] - 6 * mm, title[:70])
        canvas.setFillColor(C(MUTED))
        canvas.setStrokeColor(C(LINE))
        canvas.line(14 * mm, 12 * mm, A4[0] - 14 * mm, 12 * mm)
        canvas.setFont("DV", 7)
        canvas.drawString(14 * mm, 8 * mm, "A triage aid built from self-reported check-ins and GPS data. Not a medical diagnosis.")
        canvas.drawRightString(A4[0] - 14 * mm, 8 * mm, f"Page {doc.page}")
        canvas.restoreState()
    return draw


def _doc(buf, title):
    d = SimpleDocTemplate(buf, pagesize=A4, leftMargin=14 * mm, rightMargin=14 * mm, topMargin=16 * mm, bottomMargin=16 * mm,
                          title=title, author="Load & Recovery Monitoring")
    return d, _deco(title)


# ------------------------------------------------------------------ tiles / lists
def _tile(label, value, sub, sev, width):
    inner = Table([[_p(escape(label.upper()), "tl")], [_p(escape(str(value)), "tv")], [_p(escape(sub or ""), "ts")]], colWidths=[width - 3 * mm])
    inner.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 2), ("TOPPADDING", (0, 0), (-1, -1), 1),
                               ("BOTTOMPADDING", (0, 0), (-1, -1), 1), ("LINEBEFORE", (0, 0), (0, -1), 3, C(SEV.get(sev, SEV[None])))]))
    return inner


def _tile_grid(tiles, cols=3):
    cw = W / cols
    rows = [tiles[i:i + cols] for i in range(0, len(tiles), cols)]
    rows = [r + [""] * (cols - len(r)) for r in rows]
    t = Table(rows, colWidths=[cw] * cols)
    spans = []
    if len(tiles) % cols == 1 and len(tiles) > 1:
        spans = [("SPAN", (0, len(rows) - 1), (cols - 1, len(rows) - 1))]
    t.setStyle(TableStyle(spans + [("VALIGN", (0, 0), (-1, -1), "TOP"), ("BACKGROUND", (0, 0), (-1, -1), C("#FAFAFB")),
                           ("BOX", (0, 0), (-1, -1), 0.5, C(LINE)), ("INNERGRID", (0, 0), (-1, -1), 0.5, C(LINE)),
                           ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    return t


def _bullets(items: List[dict]):
    if not items:
        return []
    rows = []
    for it in items:
        dot = f'<font color="{SEV.get(it["severity"])}" size="11">●</font>'
        rows.append([_p(dot), _p(escape(I.render(it["code"], it["params"])))])
    t = Table(rows, colWidths=[6 * mm, W - 6 * mm])
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                           ("LEFTPADDING", (0, 0), (-1, -1), 0)]))
    return [t]


def _data_table(header, rows, widths, zebra=True):
    data = [[_p(escape(h), "cellb") for h in header]] + [[c if hasattr(c, "wrap") else _p(escape(str(c)), "cell") for c in r] for r in rows]
    t = Table(data, colWidths=widths, repeatRows=1)
    style = [("BACKGROUND", (0, 0), (-1, 0), C(INK)), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LINEBELOW", (0, 0), (-1, -1), 0.25, C(LINE)),
             ("TOPPADDING", (0, 0), (-1, -1), 2.2), ("BOTTOMPADDING", (0, 0), (-1, -1), 2.2), ("LEFTPADDING", (0, 0), (-1, -1), 3), ("RIGHTPADDING", (0, 0), (-1, -1), 3)]
    if zebra:
        style += [("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, C(SOFT)])]
    t.setStyle(TableStyle(style))
    return t


# ------------------------------------------------------------------ per-metric colouring + text
def _sev_readiness(r):
    if r["today"] is None:
        return None
    if r["today"] < M.READINESS_ALWAYS_LOW or (r["diff"] is not None and r["diff"] <= -20):
        return "red"
    return "amber" if (r["diff"] is not None and r["diff"] <= -M.READINESS_LOW_DELTA) or r["lowDays7"] >= 3 else "green"


def _sev_sleep(s):
    if s["debt7"] is None:
        return None
    return "red" if s["debt7"] >= 10 else ("amber" if s["debt7"] >= 5 else "green")


def _sev_wow(w):
    if w is None:
        return None
    return "red" if w >= 50 else ("amber" if w >= 30 or w <= -30 else "green")


def _sev_strain(ratio):
    if ratio is None:
        return None
    return "red" if ratio >= 1.5 else ("amber" if ratio >= 1.3 else "green")


def coach_tiles(m: dict, width=W / 3):
    r, s, ld, g = m["readiness"], m["sleep"], m["load"], m["gps"]
    arrow = {"up": "▲", "down": "▼", "flat": "▶", None: ""}[r["arrow"]]
    tiles = [
        _tile("Readiness today", f"{_n(r['today'])} {arrow}".strip(),
              f"own avg {_n(r['ownAvg'])} ({_signed(r['diff'])}) · {r['lowDays7']} low day{'s' if r['lowDays7'] != 1 else ''} of last 7", _sev_readiness(r), width),
        _tile("Sleep (7-day avg)", _n(s["avg7"], 1, " h"),
              f"last night {_n(s['lastNight'], 1, ' h')} · debt {_n(s['debt7'], 1, ' h')}", _sev_sleep(s), width),
        _tile("Week-on-week", _signed(ld["wowPct"], "%"), f"this week {_n(ld['week'])} vs last {_n(ld['prevWeek'])}", _sev_wow(ld["wowPct"]), width),
        _tile("ACWR", _n(ld["acwr"], 2), f"4-week chronic load {_n(ld['chronic4wk'])} / week", ld["acwrRisk"], width),
        _tile("Monotony", _n(ld["monotony"], 2), f"strain {_n(ld['strain'])} · {ld['daysLogged']} days logged", ld["monotonyRisk"], width),
    ]
    if g:
        tiles += [
            _tile("HSR ACWR", _n(g["hsrAcwr"], 2), f"7-day {_n(g['hsrAcute'])} m vs 4-wk avg {_n(g['hsrChronic'])} m", g["hsrAcwrRisk"], width),
            _tile("% of Vmax (this week)", _n(g["vmaxPct"], 0, "%"),
                  f"peak {_n(g['vmaxWeekPeak'], 1)} of {_n(g['vmax'], 1)} km/h" if g["vmaxPct"] is not None else "building Vmax baseline", g["vmaxStatus"], width),
        ]
    else:
        tiles.append(_tile("Strain vs usual", _signed(ld["strainVsUsualPct"], "%"),
                           f"strain {_n(ld['strain'])} vs usual {_n(ld['strainUsual'])}", _sev_strain(ld["strainRatio"]), width))
    return tiles


def hydration_flag_text(m):
    h = m["hydration"]
    if h["today"] is None:
        return "Hydration: no check-in today.", "info"
    if h["lowToday"]:
        return f"⚑ Hydration flag: rated {h['today']}/5 today ({h['lowDays7']} low day{'s' if h['lowDays7'] != 1 else ''} in the last 7).", "red"
    return f"Hydration: OK today ({h['today']}/5) · {h['lowDays7']} low day{'s' if h['lowDays7'] != 1 else ''} in the last 7.", "green"


def athlete_tiles(m: dict, width=W / 2):
    av = m["athleteView"]
    r, sl, hy, ld = av["readiness"], av["sleep"], av["hydration"], av["load"]
    arrow = {"up": "▲ above", "down": "▼ below", "flat": "▶ in line with", None: ""}[r["arrow"]]
    dot = {"green": "● Good", "amber": "● Okay", "red": "● Low", None: "–"}[hy["dot"]]
    lab = {"higher": "Higher", "normal": "Normal", "lower": "Lower", None: "Not enough data yet"}[ld["label"]]
    return [
        _tile("Readiness today", _n(r["value"]), f"{arrow} your average of {_n(r['ownAvg'])}" if r["arrow"] else "no average yet",
              _sev_readiness(m["readiness"]), width),
        _tile("Sleep", _n(sl["lastNight"], 1, " h"), f"last night · 7-day average {_n(sl['avg7'], 1, ' h')}", _sev_sleep(m["sleep"]), width),
        _tile("Hydration today", dot, f"rated {hy['value']}/5" if hy["value"] else "no check-in today", hy["dot"], width),
        _tile("This week's load", lab, "compared with your usual", {"higher": "amber", "normal": "green", "lower": "info", None: None}[ld["label"]], width),
    ]


# ------------------------------------------------------------------ charts
def _fmt_axis(ax):
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%d %b"))
    ax.xaxis.set_major_locator(mdates.AutoDateLocator(minticks=4, maxticks=9))


def _legend_above(ax, handles=None, labels=None, ncol=3):
    args = (handles, labels) if handles is not None else ()
    ax.legend(*args, loc="lower left", bbox_to_anchor=(0, 1.0), ncol=ncol, fontsize=7, frameon=False, borderaxespad=0.2)


def _chart_trend(checkins: List[dict]) -> Optional[bytes]:
    pts = sorted([c for c in checkins if c.get("date")], key=lambda c: c["date"])
    if len(pts) < 2:
        return None
    dates = [datetime.strptime(c["date"], "%Y-%m-%d") for c in pts]
    fig, (a1, a2) = plt.subplots(2, 1, figsize=(7.4, 4.6), sharex=True, gridspec_kw={"height_ratios": [1.15, 1], "hspace": 0.5})
    a1.bar(dates, [c.get("load") or 0 for c in pts], color=BRAND, alpha=0.85, width=0.8, label="Training load (RPE × min)")
    a1.set_ylabel("Load")
    b = a1.twinx()
    b.spines["right"].set_visible(True)
    b.plot(dates, [M.readiness_score(c) for c in pts], color=INK, marker="o", ms=2.5, lw=1.3, label="Readiness (0-100)")
    b.set_ylim(0, 100)
    b.set_ylabel("Readiness")
    h1, l1 = a1.get_legend_handles_labels()
    h2, l2 = b.get_legend_handles_labels()
    _legend_above(a1, h1 + h2, l1 + l2, 2)
    hrs = [c.get("sleepHours") for c in pts]
    a2.bar([d for d, h in zip(dates, hrs) if h is not None], [h for h in hrs if h is not None], color="#60A5FA", width=0.8, label="Sleep (h)")
    a2.axhline(M.SLEEP_TARGET_H, color=AMBER, ls="--", lw=1, label=f"{int(M.SLEEP_TARGET_H)} h target")
    low = [d for d, c in zip(dates, pts) if c.get("hydration") and c["hydration"] <= M.HYDRATION_LOW]
    if low:
        a2.scatter(low, [0.5] * len(low), color=RED, marker="v", s=24, label="Low hydration day", zorder=3)
    _legend_above(a2, ncol=3)
    a2.set_ylabel("Sleep (h)")
    a2.set_ylim(0, 12)
    _fmt_axis(a2)
    return _png(fig)


def _chart_gps(sessions: List[dict], vmax: Optional[float]) -> Optional[bytes]:
    pts = sorted([g for g in sessions if g.get("distance_m")], key=lambda g: g["date"])
    if not pts:
        return None
    dates = [datetime.strptime(g["date"], "%Y-%m-%d") for g in pts]
    fig, (a1, a2) = plt.subplots(2, 1, figsize=(7.4, 4.4), sharex=True, gridspec_kw={"height_ratios": [1.15, 1], "hspace": 0.5})
    a1.bar(dates, [g["distance_m"] for g in pts], color="#818CF8", width=0.8, label="Total distance (m)")
    a1.set_ylabel("Distance (m)")
    hsr = [g.get("hsr_distance_m") for g in pts]
    h1, l1 = a1.get_legend_handles_labels()
    if any(hsr):
        b = a1.twinx()
        b.spines["right"].set_visible(True)
        b.plot(dates, [h or 0 for h in hsr], color=AMBER, marker="o", ms=2.5, lw=1.3, label="High-speed distance (m)")
        b.set_ylabel("HSR (m)")
        h2, l2 = b.get_legend_handles_labels()
        h1, l1 = h1 + h2, l1 + l2
    _legend_above(a1, h1, l1, 2)
    sp = [(d, g["max_speed_kmh"]) for d, g in zip(dates, pts) if g.get("max_speed_kmh")]
    if sp:
        a2.plot([d for d, _ in sp], [s for _, s in sp], color=INK, marker="o", ms=3, lw=1.2, label="Top speed per session")
        top = max(s for _, s in sp)
        if vmax:
            a2.axhline(vmax, color=RED, ls="--", lw=1, label=f"Vmax {vmax:.1f} km/h")
            a2.axhline(vmax * 0.9, color=AMBER, ls=":", lw=1.2, label="90% of Vmax")
            top = max(top, vmax)
            a2.set_ylim(min(s for _, s in sp) * 0.93, top * 1.04)
        a2.set_ylabel("Top speed (km/h)")
        _legend_above(a2, ncol=3)
    _fmt_axis(a2)
    return _png(fig)


def _chart_rpe_vs_distance(pairs) -> Optional[bytes]:
    if len(pairs) < 6:
        return None
    fig, ax = plt.subplots(figsize=(4.6, 2.7))
    xs, ys = [p[1] for p in pairs], [p[2] for p in pairs]
    ax.scatter(xs, ys, color=BRAND, s=22, alpha=0.85)
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    vx = sum((x - mx) ** 2 for x in xs)
    if vx > 0:
        sl = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / vx
        x0, x1 = min(xs), max(xs)
        ax.plot([x0, x1], [my + sl * (x0 - mx), my + sl * (x1 - mx)], color=INK, lw=1)
    ax.set_xlabel("GPS distance (m)")
    ax.set_ylabel("Session load (RPE × min)")
    fig.tight_layout()
    return _png(fig)


# ------------------------------------------------------------------ analysis helpers
def period_summary(checkins: List[dict], gps: List[dict], period_days: Optional[int]) -> List[tuple]:
    n = len(checkins)
    ready = [M.readiness_score(c) for c in checkins]
    ready = [r for r in ready if r is not None]
    sleep = [c["sleepHours"] for c in checkins if c.get("sleepHours") is not None]
    loads = [c.get("load") or 0 for c in checkins]
    rpe = [c["rpe"] for c in checkins if c.get("rpe")]
    rows = [
        ("Check-ins logged", f"{n}" + (f" of {period_days} days ({round(100 * n / period_days)}%)" if period_days else "")),
        ("Average readiness", _n(sum(ready) / len(ready) if ready else None)),
        ("Average sleep", _n(sum(sleep) / len(sleep) if sleep else None, 1, " h")),
        ("Total training load", _n(sum(loads))),
        ("Average session RPE", _n(sum(rpe) / len(rpe) if rpe else None, 1)),
        ("Low-hydration days", f"{sum(1 for c in checkins if c.get('hydration') and c['hydration'] <= M.HYDRATION_LOW)}"),
        ("Illness days", f"{sum(1 for c in checkins if c.get('feelingIll'))}"),
        ("Soreness days", f"{sum(1 for c in checkins if (c.get('sorenessSeverity') or 0) > 0)}"),
    ]
    if gps:
        speeds = [g["max_speed_kmh"] for g in gps if g.get("max_speed_kmh")]
        rows += [
            ("GPS sessions", f"{len(gps)}"),
            ("Total distance", _n(sum(g.get("distance_m") or 0 for g in gps), 0, " m")),
            ("High-speed distance", _n(sum(g.get("hsr_distance_m") or 0 for g in gps), 0, " m")),
            ("Sprints / top speed", f"{sum(g.get('sprints') or 0 for g in gps)} / {_n(max(speeds) if speeds else None, 1, ' km/h')}"),
        ]
    return rows


def _kv_table(rows, cols=2):
    half = (len(rows) + cols - 1) // cols
    chunks = [rows[i:i + half] for i in range(0, len(rows), half)]
    height = max(len(c) for c in chunks)
    data = []
    for i in range(height):
        row = []
        for ch in chunks:
            row += [_p(escape(ch[i][0]), "small"), _p(f"<b>{escape(ch[i][1])}</b>", "cell")] if i < len(ch) else ["", ""]
        data.append(row)
    t = Table(data, colWidths=[W / (2 * cols) * 0.95, W / (2 * cols) * 1.05] * cols)
    t.setStyle(TableStyle([("LINEBELOW", (0, 0), (-1, -1), 0.25, C(LINE)), ("TOPPADDING", (0, 0), (-1, -1), 2.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
                           ("LEFTPADDING", (0, 0), (-1, -1), 2)]))
    return t


def _checkin_rows(checkins):
    rows = []
    for c in sorted(checkins, key=lambda c: c["date"], reverse=True)[:MAX_ROWS]:
        r = M.readiness_score(c)
        sore = f"{c.get('sorenessSeverity')}/5 {', '.join(c.get('sorenessAreas') or [])}" if (c.get("sorenessSeverity") or 0) > 0 else ""
        ill = ", ".join(c.get("symptoms") or []) + (f" ({c['illnessSeverity']})" if c.get("illnessSeverity") else "") if c.get("feelingIll") else ""
        hyd = c.get("hydration")
        hyd_p = _p(f'<font color="{RED}"><b>{hyd}</b></font>' if (hyd and hyd <= M.HYDRATION_LOW) else escape(str(hyd or "")), "cell")
        rows.append([_fmt_date(c["date"]), f"{_n(c.get('sleepHours'), 1)} / {c.get('sleepQuality') or '–'}", hyd_p, c.get("motivation") or "",
                     c.get("sessionType") or "", c.get("rpe") or "", c.get("duration") or "", _n(c.get("load")), _n(r), sore, ill])
    return rows


CHECKIN_HEADER = ["Date", "Sleep h/q", "Hyd", "Mot", "Session", "RPE", "Min", "Load", "Ready", "Soreness", "Illness"]
CHECKIN_W = [15, 16, 8, 8, 24, 8, 8, 11, 12, 36, 26]
GPS_HEADER = ["Date", "Session", "Dist (m)", "HSR (m)", "Sprints", "Top km/h", "Acc+Dec", "Min", "m/min"]
GPS_W = [16, 46, 17, 16, 14, 16, 16, 12, 14]


def _gps_rows(gps):
    return [[_fmt_date(g["date"]), g.get("session_label") or ("Manual entry" if g.get("source") != "import" else "Imported"), _n(g.get("distance_m")),
             _n(g.get("hsr_distance_m")), _n(g.get("sprints")), _n(g.get("max_speed_kmh"), 1), _n(g.get("accel_decel")), _n(g.get("duration_min")),
             _n(g.get("m_per_min"))] for g in sorted(gps, key=lambda g: g["date"], reverse=True)[:MAX_ROWS]]


def _rpe_pairs(checkins, gps):
    loads = {c["date"]: c.get("load") for c in checkins if c.get("load")}
    return [(g["date"], g["distance_m"], loads[g["date"]]) for g in gps if g.get("distance_m") and loads.get(g["date"])]


# ------------------------------------------------------------------ one player's section (shared by player + team reports)
def _player_story(pack: dict, period_label: str, period_days: Optional[int], audience: str, heading: Optional[str] = None) -> list:
    m, ins = pack["metrics"], pack["insights"]
    s = []
    if heading:
        s += [_p(escape(heading), "h1"), _p(escape(period_label), "sub"), Spacer(1, 4)]
    if not pack.get("joined", True) or m is None:
        return s + [_p("This player has not joined with the team code yet, so there is no data to report.", "body")]

    s.append(_p("Snapshot" if audience == "coach" else "Your numbers today", "h2"))
    s.append(_tile_grid(coach_tiles(m) if audience == "coach" else athlete_tiles(m), 3 if audience == "coach" else 2))
    if audience == "coach":
        text, sev = hydration_flag_text(m)
        s += [Spacer(1, 3), _p(f'<font color="{SEV[sev]}">{escape(text)}</font>', "body")]

    s.append(_p("Key insights", "h2"))
    s += _bullets(ins[:10]) or [_p("No findings.", "body")]
    if len(ins) > 10:
        s.append(_p(f"+ {len(ins) - 10} lower-priority findings are listed in the Excel export.", "small"))

    s.append(_p(f"Period summary · {escape(period_label)}", "h2"))
    s.append(_kv_table(period_summary(pack["checkins"], pack["gps"], period_days)))

    trend = _img(_chart_trend(pack["checkins"]), ratio=0.6)
    if trend:
        s += [_p("Load, readiness, sleep and hydration", "h2"), trend]
    if pack["gps"]:
        gimg = _img(_chart_gps(pack["gps"], (m.get("gps") or {}).get("vmax")), ratio=0.54)
        if gimg:
            s += [_p("GPS: distance, high-speed running and top speed", "h2"), gimg]
        pairs = _rpe_pairs(pack["checkins"], pack["gps"])
        sc = _img(_chart_rpe_vs_distance(pairs), width=95 * mm, ratio=0.59)
        if sc:
            r = M.pearson_r([p[1] for p in pairs], [p[2] for p in pairs])
            s += [_p(f"Perceived effort vs GPS distance (r = {_n(r, 2)}, {len(pairs)} matched days)", "h2"), sc]

    if pack["checkins"]:
        s += [_p("Daily check-in log", "h2"), _data_table(CHECKIN_HEADER, _checkin_rows(pack["checkins"]), [w * mm for w in CHECKIN_W])]
        if len(pack["checkins"]) > MAX_ROWS:
            s.append(_p(f"Showing the latest {MAX_ROWS} of {len(pack['checkins'])} check-ins. The Excel export has everything.", "small"))
    if pack["gps"]:
        s += [_p("GPS sessions", "h2"), _data_table(GPS_HEADER, _gps_rows(pack["gps"]), [w * mm for w in GPS_W])]
    if audience == "coach" and pack.get("notes"):
        rows = [[_fmt_date(n["date"]), n.get("author") or "", ("Flag cleared: " if n.get("type") == "acknowledgment" else "") + (n.get("note") or "")]
                for n in pack["notes"][:60]]
        s += [_p("Coach notes & records", "h2"), _data_table(["Date", "By", "Note"], rows, [18 * mm, 30 * mm, 129 * mm])]
    return s


def _title_block(title, subtitle, meta):
    return [_p(escape(title), "h1"), _p(escape(subtitle), "sub"), _p(escape(meta), "small"),
            HRFlowable(width="100%", thickness=0.6, color=C(LINE), spaceBefore=4, spaceAfter=2)]


# ------------------------------------------------------------------ public: player PDF
def build_player_pdf(team_name: Optional[str], pack: dict, period_label: str, period_days: Optional[int], audience: str = "coach") -> bytes:
    buf = io.BytesIO()
    doc, deco = _doc(buf, f"{pack['name']} · {period_label}")
    gen = datetime.now().strftime("Generated %d %b %Y")
    sub = (f"{team_name} · " if team_name else "") + ("Player report" if audience == "coach" else "My report") + f" · {period_label}"
    story = _title_block(pack["name"], sub, gen) + _player_story(pack, period_label, period_days, audience)
    doc.build(story, onFirstPage=deco, onLaterPages=deco)
    return buf.getvalue()


# ------------------------------------------------------------------ public: team PDF
def team_insights(packs: List[dict]) -> List[str]:
    out = []
    joined = [p for p in packs if p.get("metrics")]
    if not joined:
        return ["No players have joined yet."]
    sev_rank = {"red": 2, "amber": 1}
    flagged = []
    for p in joined:
        worst = max((sev_rank.get(i["severity"], 0) for i in p["insights"]), default=0)
        if worst:
            top = [i for i in p["insights"] if i["severity"] in ("red", "amber")][:2]
            flagged.append((worst, p["name"], "; ".join(I.render(i["code"], i["params"]).rstrip(".") for i in top) + "."))
    flagged.sort(key=lambda t: -t[0])
    if flagged:
        out.append(f"{len(flagged)} of {len(joined)} players have something to watch. Highest priority first:")
        out += [f"<b>{escape(n)}</b>: {escape(t)}" for _, n, t in flagged[:6]]
    else:
        out.append("No player has anything flagged: readiness, sleep and load look steady across the squad.")
    missing = [p["name"] for p in joined if not p["metrics"]["checkedInToday"]]
    if missing:
        out.append(f"{len(missing)} player{'s' if len(missing) != 1 else ''} without a check-in today: {escape(', '.join(missing[:8]))}{'…' if len(missing) > 8 else ''}.")
    hyd = [p["name"] for p in joined if p["metrics"]["hydration"]["lowToday"]]
    if hyd:
        out.append(f"Hydration flag today: {escape(', '.join(hyd[:8]))}.")
    spikes = [p["name"] for p in joined if (p["metrics"]["load"]["acwr"] or 0) > 1.3]
    if spikes:
        out.append(f"Load ramping up (ACWR above 1.3): {escape(', '.join(spikes[:8]))}.")
    return out


def _squad_rows(packs):
    rows = []
    for p in packs:
        m = p.get("metrics")
        if not m:
            rows.append([p["name"]] + ["–"] * 11 + ["Not joined"])
            continue
        r, s, ld, g, h = m["readiness"], m["sleep"], m["load"], m["gps"], m["hydration"]
        rows.append([p["name"], f"{_n(r['today'])} ({_signed(r['diff'])})", r["lowDays7"], _n(s["avg7"], 1), _n(s["debt7"], 1), _signed(ld["wowPct"], "%"),
                     _n(ld["acwr"], 2), _n(ld["monotony"], 2), _n(g["hsrAcwr"], 2) if g else _signed(ld["strainVsUsualPct"], "%"),
                     _n(g["vmaxPct"], 0, "%") if g else "–", "⚑" if h["lowToday"] else ("OK" if h["today"] else "–"), p.get("riskLabel", "")])
    return rows


def build_team_pdf(team_name: str, period_label: str, period_days: Optional[int], packs: List[dict]) -> bytes:
    buf = io.BytesIO()
    doc, deco = _doc(buf, f"{team_name} · {period_label}")
    joined = [p for p in packs if p.get("metrics")]
    ready_today = [p["metrics"]["readiness"]["today"] for p in joined if p["metrics"]["readiness"]["today"] is not None]
    total_ci = sum(len(p["checkins"]) for p in joined)
    possible = (period_days or 0) * len(joined)
    kpis = [
        _tile("Players joined", f"{len(joined)} / {len(packs)}", "on the roster", None, W / 3),
        _tile("Check-ins in period", f"{total_ci}", f"{round(100 * total_ci / possible)}% of possible" if possible else period_label, None, W / 3),
        _tile("Avg readiness today", _n(sum(ready_today) / len(ready_today) if ready_today else None), f"{len(ready_today)} checked in today", None, W / 3),
        _tile("Total training load", _n(sum((c.get('load') or 0) for p in joined for c in p['checkins'])), period_label, None, W / 3),
        _tile("GPS sessions", f"{sum(len(p['gps']) for p in joined)}", f"{sum(1 for p in joined if p['gps'])} players with GPS", None, W / 3),
        _tile("Need attention", f"{sum(1 for p in joined if any(i['severity'] == 'red' for i in p['insights']))}", "players with a red finding", "red", W / 3),
    ]
    gen = datetime.now().strftime("Generated %d %b %Y")
    story = _title_block(team_name, f"Team report · {period_label}", gen)
    story += [_p("At a glance", "h2"), _tile_grid(kpis, 3), _p("Team insights", "h2")]
    for t in team_insights(packs):
        story.append(_p(f'<font color="{BRAND}">●</font> {t}'))
        story.append(Spacer(1, 2))

    story += [_p("Squad overview", "h2"),
              _data_table(["Player", "Readiness (vs avg)", "Low d", "Sleep h", "Debt h", "WoW", "ACWR", "Mono", "HSR ACWR / Strain vs usual", "Vmax %", "Hyd", "Status"],
                          _squad_rows(packs), [26 * mm, 22 * mm, 9 * mm, 12 * mm, 11 * mm, 12 * mm, 12 * mm, 12 * mm, 22 * mm, 11 * mm, 8 * mm, 18 * mm]),
              _p("Readiness: today vs the player's own average · Low d: low-readiness days in the last 7 · Debt: sleep shortfall against 8 h over 7 days · "
                 "WoW: week-on-week load change · ACWR: this week's load vs the 4-week chronic load · HSR ACWR shown for players with GPS data, otherwise strain vs the "
                 "previous 4 weeks · Vmax %: this week's top speed vs the player's Vmax.", "small")]

    for i, pack in enumerate(packs, 1):
        story.append(PageBreak())
        story += _title_block(pack["name"], f"{team_name} · Player {i} of {len(packs)} · {period_label}", "")[:-1]
        story += _player_story(pack, period_label, period_days, "coach")
    doc.build(story, onFirstPage=deco, onLaterPages=deco)
    return buf.getvalue()


# ------------------------------------------------------------------ public: Excel
def build_excel(title: str, period_label: str, packs: List[dict]) -> bytes:
    wb = Workbook()
    head_fill, head_font = PatternFill("solid", start_color=INK.lstrip("#")), Font(bold=True, color="FFFFFF")

    def sheet(ws, header, rows, widths=None):
        ws.append(header)
        for c in ws[1]:
            c.fill, c.font, c.alignment = head_fill, head_font, Alignment(vertical="center", wrap_text=True)
        for r in rows:
            ws.append(r)
        ws.freeze_panes = "A2"
        for i, h in enumerate(header, 1):
            ws.column_dimensions[get_column_letter(i)].width = (widths[i - 1] if widths else max(11, min(30, len(h) + 4)))

    ws = wb.active
    ws.title = "Summary"
    ws.append([f"{title} · {period_label}"])
    ws["A1"].font = Font(bold=True, size=14)
    ws.append([])
    ws.append(["Player", "Readiness today", "Own avg", "vs avg", "Low days (7)", "Sleep avg 7d (h)", "Sleep last night (h)", "Sleep debt (h)", "Week load",
               "Last week", "WoW %", "ACWR", "4-wk chronic", "Monotony", "Strain", "Strain vs usual %", "HSR ACWR", "Vmax %", "Hydration today", "Low hydration days (7)"])
    for c in ws[3]:
        c.fill, c.font, c.alignment = head_fill, head_font, Alignment(wrap_text=True, vertical="center")
    risk_fill = {"red": "FCE4E9", "amber": "FDE9DA", "green": "DCFCE7"}
    for p in packs:
        m = p.get("metrics")
        if not m:
            ws.append([p["name"], "Not joined"])
            continue
        r, s, ld, g, h = m["readiness"], m["sleep"], m["load"], m["gps"], m["hydration"]
        ws.append([p["name"], r["today"], r["ownAvg"], r["diff"], r["lowDays7"], s["avg7"], s["lastNight"], s["debt7"], ld["week"], ld["prevWeek"], ld["wowPct"], ld["acwr"],
                   ld["chronic4wk"], ld["monotony"], ld["strain"], ld["strainVsUsualPct"], g["hsrAcwr"] if g else None, g["vmaxPct"] if g else None, h["today"], h["lowDays7"]])
        row = ws.max_row
        for col, sev in ((2, _sev_readiness(r)), (8, _sev_sleep(s)), (12, ld["acwrRisk"]), (14, ld["monotonyRisk"]), (17, g["hsrAcwrRisk"] if g else None)):
            if sev in risk_fill:
                ws.cell(row=row, column=col).fill = PatternFill("solid", start_color=risk_fill[sev])
        if h["lowToday"]:
            ws.cell(row=row, column=19).fill = PatternFill("solid", start_color=risk_fill["red"])
    ws.column_dimensions["A"].width = 24
    for i in range(2, 21):
        ws.column_dimensions[get_column_letter(i)].width = 13
    ws.freeze_panes = "B4"

    rows = []
    for p in packs:
        for c in sorted(p["checkins"], key=lambda c: c["date"]):
            rows.append([p["name"], c["date"], c.get("sleepHours"), c.get("sleepQuality"), c.get("hydration"), c.get("motivation"), c.get("sessionType"), c.get("rpe"),
                         c.get("duration"), c.get("load"), M.readiness_score(c), c.get("sorenessSeverity") or 0, ", ".join(c.get("sorenessAreas") or []),
                         "Yes" if c.get("feelingIll") else "", ", ".join(c.get("symptoms") or []), c.get("illnessSeverity") or "", c.get("notes") or ""])
    sheet(wb.create_sheet("Check-ins"), ["Player", "Date", "Sleep (h)", "Sleep quality", "Hydration", "Motivation", "Session", "RPE", "Minutes", "Load", "Readiness",
                                         "Soreness", "Soreness areas", "Ill", "Symptoms", "Severity", "Notes"], rows)

    rows = []
    for p in packs:
        for g in sorted(p["gps"], key=lambda g: g["date"]):
            rows.append([p["name"], g["date"], g.get("session_label") or "", g.get("distance_m"), g.get("hsr_distance_m"), g.get("sprints"), g.get("max_speed_kmh"),
                         g.get("accel_decel"), g.get("hml_distance_m"), g.get("duration_min"), g.get("m_per_min"), g.get("source") or ""])
    sheet(wb.create_sheet("GPS"), ["Player", "Date", "Session", "Distance (m)", "HSR (m)", "Sprints", "Top speed (km/h)", "Accel+decel", "HML dist (m)", "Minutes", "m/min", "Source"], rows)

    rows = [[p["name"], i["severity"].upper(), I.render(i["code"], i["params"])] for p in packs for i in p["insights"]]
    sheet(wb.create_sheet("Insights"), ["Player", "Severity", "Finding"], rows, [24, 12, 110])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
