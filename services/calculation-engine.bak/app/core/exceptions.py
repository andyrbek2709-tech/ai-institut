from fastapi import FastAPI, HTTPException, status, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
import logging

logger = logging.getLogger(__name__)


class CalculationException(Exception):
    """Base exception for calculation engine"""

    def __init__(self, message: str, status_code: int = 500, details: dict = None):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


class ValidationException(CalculationException):
    """Validation error"""

    def __init__(self, message: str, details: dict = None):
        super().__init__(message, status.HTTP_422_UNPROCESSABLE_ENTITY, details)


class TemplateNotFound(CalculationException):
    """Template not found error"""

    def __init__(self, template_id: str):
        super().__init__(
            f'Template not found: {template_id}',
            status.HTTP_404_NOT_FOUND,
            {'template_id': template_id}
        )


class CalculationError(CalculationException):
    """Calculation execution error"""

    def __init__(self, message: str, details: dict = None):
        super().__init__(message, status.HTTP_400_BAD_REQUEST, details)


def register_exception_handlers(app: FastAPI) -> None:
    """Register all exception handlers for the FastAPI app"""

    @app.exception_handler(CalculationException)
    async def calculation_exception_handler(request: Request, exc: CalculationException):
        logger.error(
            f'{exc.__class__.__name__}: {exc.message}',
            extra={'details': exc.details}
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={
                'error': exc.__class__.__name__,
                'message': exc.message,
                'details': exc.details,
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        errors = []
        for error in exc.errors():
            errors.append({
                'field': '.'.join(str(x) for x in error['loc']),
                'message': error['msg'],
                'type': error['type'],
            })
        logger.warning(f'Validation error: {len(errors)} error(s)')
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                'error': 'ValidationError',
                'message': 'Request validation failed',
                'details': errors,
            },
        )

    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        logger.error(f'Unhandled exception: {exc}', exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                'error': 'InternalServerError',
                'message': 'An unexpected error occurred',
            },
        )
