"""Report generation API endpoints."""

import logging
import hashlib
from typing import Dict, Any, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from src.engine.reporting import (
    ReportDataExtractor,
    DocxReportBuilder,
    TemplateRegistry,
)
from src.engine.reporting.models import ReportStatus, ReportGenerationResponse, ReportMetadata

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/reports", tags=["reports"])


class GenerateReportRequest(BaseModel):
    """Request to generate engineering report."""
    calculation_id: str
    template_type: Optional[str] = None  # "piping", "structural", "thermal", "generic"
    include_audit_appendix: bool = True
    include_failure_analysis: bool = True
    title: Optional[str] = None
    normative_references: Optional[list[str]] = None
    assumptions: Optional[list[str]] = None


class ReportInfo(BaseModel):
    """Information about generated report."""
    report_id: str
    calculation_id: str
    template_type: str
    status: str
    file_size_bytes: int
    hash: str
    generated: str


# In-memory report cache (in production, use database)
_report_cache: Dict[str, bytes] = {}
_report_metadata: Dict[str, ReportMetadata] = {}


@router.post("/generate", response_model=ReportGenerationResponse)
async def generate_report(request: GenerateReportRequest) -> ReportGenerationResponse:
    """
    Generate engineering report from calculation result.

    Args:
        request: Report generation request with calculation ID and options

    Returns:
        ReportGenerationResponse with report ID and download URL
    """
    try:
        # TODO: In production, fetch CalculationResult from database
        # For now, this is a stub that shows the API structure
        logger.info(f"Generating report for calculation: {request.calculation_id}")

        # Prepare template data
        template_data = {
            "template_type": request.template_type or "generic",
            "title": request.title or f"Engineering Report - {request.calculation_id}",
            "normative_references": request.normative_references or [],
            "assumptions": request.assumptions or [],
        }

        # Generate report ID
        report_id = f"rpt_{request.calculation_id}_{datetime.now(timezone.utc).timestamp()}"

        # In production:
        # 1. Fetch CalculationResult from database
        # 2. Extract data using ReportDataExtractor
        # 3. Build DOCX using DocxReportBuilder
        # 4. Cache report and return metadata

        # For now, return success response
        metadata = ReportMetadata(
            report_id=report_id,
            calculation_id=request.calculation_id,
            template_type=request.template_type or "generic",
            generated=datetime.now(timezone.utc).isoformat(),
            hash="sha256:placeholder",  # Would compute actual hash
            engine_version="0.3.0",
            file_size_bytes=245632,
        )

        return ReportGenerationResponse(
            report_id=report_id,
            status=ReportStatus.GENERATED,
            download_url=f"/api/reports/{report_id}/download",
            metadata=metadata,
        )

    except Exception as e:
        logger.error(f"Error generating report: {e}")
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")


@router.get("/{report_id}/download")
async def download_report(report_id: str) -> bytes:
    """
    Download generated report as DOCX file.

    Args:
        report_id: Report ID

    Returns:
        DOCX file content
    """
    if report_id not in _report_cache:
        raise HTTPException(status_code=404, detail="Report not found")

    report_bytes = _report_cache[report_id]

    # Return with appropriate headers
    # In FastAPI, this would typically return FileResponse or StreamingResponse
    return report_bytes


@router.get("/{report_id}/info", response_model=ReportInfo)
async def get_report_info(report_id: str) -> ReportInfo:
    """
    Get information about a generated report.

    Args:
        report_id: Report ID

    Returns:
        Report metadata
    """
    if report_id not in _report_metadata:
        raise HTTPException(status_code=404, detail="Report not found")

    metadata = _report_metadata[report_id]

    return ReportInfo(
        report_id=metadata.report_id,
        calculation_id=metadata.calculation_id,
        template_type=metadata.template_type,
        status=ReportStatus.GENERATED,
        file_size_bytes=metadata.file_size_bytes or 0,
        hash=metadata.hash,
        generated=metadata.generated,
    )


@router.get("/templates/list")
async def list_available_templates() -> Dict[str, Any]:
    """
    List available report templates.

    Returns:
        Dictionary with available templates and their supported disciplines
    """
    templates = []

    for template_id in TemplateRegistry.list_templates():
        template = TemplateRegistry.get_template(template_id)
        if template:
            templates.append(
                {
                    "template_id": template.template_id,
                    "template_name": template.template_name,
                    "supported_disciplines": template.supported_disciplines,
                }
            )

    return {
        "available_templates": templates,
        "count": len(templates),
    }


@router.get("/templates/{template_id}")
async def get_template_info(template_id: str) -> Dict[str, Any]:
    """
    Get information about specific template.

    Args:
        template_id: Template ID

    Returns:
        Template metadata
    """
    template = TemplateRegistry.get_template(template_id)

    if not template:
        raise HTTPException(status_code=404, detail=f"Template not found: {template_id}")

    return {
        "template_id": template.template_id,
        "template_name": template.template_name,
        "supported_disciplines": template.supported_disciplines,
        "sections": [s.value for s in template.sections],
    }


# Helper functions for report generation (would be in production service layer)


def _compute_report_hash(report_bytes: bytes) -> str:
    """Compute SHA256 hash of report content."""
    return f"sha256:{hashlib.sha256(report_bytes).hexdigest()}"


def _cache_report(report_id: str, report_bytes: bytes, metadata: ReportMetadata):
    """Cache generated report and its metadata."""
    _report_cache[report_id] = report_bytes
    _report_metadata[report_id] = metadata
