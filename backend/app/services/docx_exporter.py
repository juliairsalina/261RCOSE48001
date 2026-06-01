from __future__ import annotations

import io
from typing import Any

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Pt, RGBColor
from docx.oxml.ns import qn
from docx.oxml import OxmlElement


def _set_heading_style(paragraph, font_size: int = 12, bold: bool = True) -> None:
    """Apply heading styling to a paragraph."""
    for run in paragraph.runs:
        run.bold = bold
        run.font.size = Pt(font_size)


def _add_horizontal_rule(document: Document) -> None:
    """Add a horizontal rule (border) below a paragraph."""
    para = document.add_paragraph()
    para.paragraph_format.space_before = Pt(0)
    para.paragraph_format.space_after = Pt(2)
    p = para._p
    pPr = p.get_or_add_pPr()
    pBdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "6")
    bottom.set(qn("w:space"), "1")
    bottom.set(qn("w:color"), "999999")
    pBdr.append(bottom)
    pPr.append(pBdr)


def _apply_rewrites(resume_json: dict, approved_rewrites: list[dict]) -> dict:
    """Apply approved rewrite suggestions to the resume_json dict.

    Returns a copy of resume_json with suggested_text replacing original_text
    in the relevant section.
    """
    import copy
    data = copy.deepcopy(resume_json)

    for rewrite in approved_rewrites:
        section = (rewrite.get("section") or "").lower()
        original = rewrite.get("original_text", "")
        suggested = rewrite.get("suggested_text", "")

        if not original or not suggested:
            continue

        if section in ("summary", "profile", "objective"):
            if isinstance(data.get("summary"), str):
                data["summary"] = data["summary"].replace(original, suggested)

        elif section in ("skills", "skill"):
            # Skills is a list; replace matching entries
            skills = data.get("skills", [])
            data["skills"] = [suggested if s == original else s for s in skills]

        elif section in ("work_experience", "experience", "work experience"):
            for exp in data.get("work_experience", []):
                # Replace in bullets
                bullets = exp.get("bullets", [])
                exp["bullets"] = [suggested if b == original else b for b in bullets]
                # Replace in description
                if isinstance(exp.get("description"), str):
                    exp["description"] = exp["description"].replace(original, suggested)

        elif section in ("education",):
            for edu in data.get("education", []):
                if isinstance(edu.get("description"), str):
                    edu["description"] = edu["description"].replace(original, suggested)

        elif section in ("projects", "project"):
            for proj in data.get("projects", []):
                bullets = proj.get("bullets", [])
                proj["bullets"] = [suggested if b == original else b for b in bullets]
                if isinstance(proj.get("description"), str):
                    proj["description"] = proj["description"].replace(original, suggested)

    return data


def generate_resume_docx(resume_json: dict[str, Any], approved_rewrites: list[dict]) -> bytes:
    """Generate a styled DOCX resume applying approved rewrite suggestions.

    Args:
        resume_json: Parsed resume data dict (matching ResumeJSON schema).
        approved_rewrites: List of approved rewrite suggestion dicts with keys:
            section, original_text, suggested_text, reason.

    Returns:
        DOCX file as bytes.
    """
    data = _apply_rewrites(resume_json, approved_rewrites)
    doc = Document()

    # Set document margins
    for section in doc.sections:
        section.top_margin = Pt(36)
        section.bottom_margin = Pt(36)
        section.left_margin = Pt(54)
        section.right_margin = Pt(54)

    # ── Header: Name & Contact ─────────────────────────────────────────────
    name = data.get("name", "")
    if name:
        name_para = doc.add_paragraph()
        name_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        name_run = name_para.add_run(name)
        name_run.bold = True
        name_run.font.size = Pt(18)

    contact_parts: list[str] = []
    for field in ("email", "phone"):
        value = data.get(field, "")
        if value:
            contact_parts.append(value)

    if contact_parts:
        contact_para = doc.add_paragraph(" | ".join(contact_parts))
        contact_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        for run in contact_para.runs:
            run.font.size = Pt(10)

    # ── Summary ────────────────────────────────────────────────────────────
    summary = data.get("summary", "")
    if summary:
        doc.add_paragraph()
        heading = doc.add_paragraph("SUMMARY")
        _set_heading_style(heading, font_size=11, bold=True)
        _add_horizontal_rule(doc)
        summary_para = doc.add_paragraph(summary)
        summary_para.paragraph_format.space_after = Pt(4)

    # ── Skills ────────────────────────────────────────────────────────────
    skills: list[str] = data.get("skills", [])
    if skills:
        doc.add_paragraph()
        heading = doc.add_paragraph("SKILLS")
        _set_heading_style(heading, font_size=11, bold=True)
        _add_horizontal_rule(doc)
        skills_para = doc.add_paragraph(", ".join(skills))
        skills_para.paragraph_format.space_after = Pt(4)

    # ── Education ─────────────────────────────────────────────────────────
    education: list[dict] = data.get("education", [])
    if education:
        doc.add_paragraph()
        heading = doc.add_paragraph("EDUCATION")
        _set_heading_style(heading, font_size=11, bold=True)
        _add_horizontal_rule(doc)
        for edu in education:
            institution = edu.get("institution", "")
            degree = edu.get("degree", "")
            field = edu.get("field_of_study", "")
            start = edu.get("start_date", "")
            end = edu.get("end_date", "")
            gpa = edu.get("gpa")
            description = edu.get("description", "")

            date_str = f"{start} – {end}" if start or end else ""
            title_parts = [degree]
            if field:
                title_parts.append(f"in {field}")
            degree_str = " ".join(title_parts)

            # Institution line
            inst_para = doc.add_paragraph()
            inst_para.paragraph_format.space_before = Pt(4)
            inst_para.paragraph_format.space_after = Pt(0)
            inst_run = inst_para.add_run(institution)
            inst_run.bold = True
            if date_str:
                inst_para.add_run(f"  {date_str}").font.size = Pt(10)

            # Degree line
            if degree_str:
                deg_para = doc.add_paragraph(degree_str)
                deg_para.paragraph_format.space_before = Pt(0)
                deg_para.paragraph_format.space_after = Pt(0)

            if gpa:
                doc.add_paragraph(f"GPA: {gpa}").paragraph_format.space_after = Pt(0)
            if description:
                doc.add_paragraph(description).paragraph_format.space_after = Pt(0)

    # ── Work Experience ───────────────────────────────────────────────────
    work_experience: list[dict] = data.get("work_experience", [])
    if work_experience:
        doc.add_paragraph()
        heading = doc.add_paragraph("WORK EXPERIENCE")
        _set_heading_style(heading, font_size=11, bold=True)
        _add_horizontal_rule(doc)
        for exp in work_experience:
            company = exp.get("company", "")
            title = exp.get("title", "")
            location_str = exp.get("location", "")
            start = exp.get("start_date", "")
            end = exp.get("end_date", "")
            is_current = exp.get("is_current", False)
            bullets: list[str] = exp.get("bullets", [])
            description = exp.get("description", "")

            end_display = "Present" if is_current else (end or "")
            date_str = f"{start} – {end_display}" if (start or end_display) else ""

            # Company + date line
            comp_para = doc.add_paragraph()
            comp_para.paragraph_format.space_before = Pt(6)
            comp_para.paragraph_format.space_after = Pt(0)
            comp_run = comp_para.add_run(company)
            comp_run.bold = True
            if date_str:
                comp_para.add_run(f"  {date_str}")

            # Title + location line
            if title or location_str:
                parts = [p for p in [title, location_str] if p]
                title_para = doc.add_paragraph("  |  ".join(parts))
                title_para.paragraph_format.space_before = Pt(0)
                title_para.paragraph_format.space_after = Pt(2)
                for run in title_para.runs:
                    run.italic = True

            # Bullet points
            for bullet in bullets:
                bullet_para = doc.add_paragraph(style="List Bullet")
                bullet_para.paragraph_format.space_before = Pt(0)
                bullet_para.paragraph_format.space_after = Pt(1)
                bullet_para.add_run(bullet)

            # Description fallback
            if description and not bullets:
                desc_para = doc.add_paragraph(description)
                desc_para.paragraph_format.space_before = Pt(0)
                desc_para.paragraph_format.space_after = Pt(2)

    # ── Projects ──────────────────────────────────────────────────────────
    projects: list[dict] = data.get("projects", [])
    if projects:
        doc.add_paragraph()
        heading = doc.add_paragraph("PROJECTS")
        _set_heading_style(heading, font_size=11, bold=True)
        _add_horizontal_rule(doc)
        for proj in projects:
            proj_name = proj.get("name", "")
            proj_desc = proj.get("description", "")
            technologies: list[str] = proj.get("technologies", [])
            url = proj.get("url", "")
            bullets_proj: list[str] = proj.get("bullets", [])
            start = proj.get("start_date", "")
            end = proj.get("end_date", "")
            date_str = f"{start} – {end}" if (start or end) else ""

            proj_para = doc.add_paragraph()
            proj_para.paragraph_format.space_before = Pt(4)
            proj_para.paragraph_format.space_after = Pt(0)
            proj_run = proj_para.add_run(proj_name)
            proj_run.bold = True
            if date_str:
                proj_para.add_run(f"  {date_str}")

            if technologies:
                tech_para = doc.add_paragraph(f"Technologies: {', '.join(technologies)}")
                tech_para.paragraph_format.space_before = Pt(0)
                tech_para.paragraph_format.space_after = Pt(1)
                for run in tech_para.runs:
                    run.italic = True

            for bullet in bullets_proj:
                bullet_para = doc.add_paragraph(style="List Bullet")
                bullet_para.paragraph_format.space_before = Pt(0)
                bullet_para.paragraph_format.space_after = Pt(1)
                bullet_para.add_run(bullet)

            if proj_desc and not bullets_proj:
                doc.add_paragraph(proj_desc)

            if url:
                url_para = doc.add_paragraph(f"URL: {url}")
                url_para.paragraph_format.space_after = Pt(2)

    # ── Additional Sections ───────────────────────────────────────────────
    certifications: list[str] = data.get("certifications", [])
    if certifications:
        doc.add_paragraph()
        heading = doc.add_paragraph("CERTIFICATIONS")
        _set_heading_style(heading, font_size=11, bold=True)
        _add_horizontal_rule(doc)
        for cert in certifications:
            doc.add_paragraph(cert, style="List Bullet")

    achievements: list[str] = data.get("achievements", [])
    if achievements:
        doc.add_paragraph()
        heading = doc.add_paragraph("ACHIEVEMENTS")
        _set_heading_style(heading, font_size=11, bold=True)
        _add_horizontal_rule(doc)
        for ach in achievements:
            doc.add_paragraph(ach, style="List Bullet")

    languages: list[str] = data.get("languages", [])
    if languages:
        doc.add_paragraph()
        heading = doc.add_paragraph("LANGUAGES")
        _set_heading_style(heading, font_size=11, bold=True)
        _add_horizontal_rule(doc)
        doc.add_paragraph(", ".join(languages))

    # ── Serialize to bytes ────────────────────────────────────────────────
    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    return buffer.read()
