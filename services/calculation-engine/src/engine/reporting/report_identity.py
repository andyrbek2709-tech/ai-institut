"""Report identity system - deterministic, reproducible report identification."""

import hashlib
import json
import logging
from typing import Dict, Any, Optional
from dataclasses import dataclass, asdict

from src.schemas import CalculationResult
from .lifecycle import ReportGenerationContext
from .deterministic_hashing import DeterministicHasher

logger = logging.getLogger(__name__)


@dataclass
class ReportIdentity:
    """Deterministic identity for a report (7 hash fields)."""
    # Core identifiers
    report_id: str  # Stable, deterministic ID
    calculation_id: str  # Source calculation

    # Hashes (deterministic signatures) — 7 fields
    inputs_hash: str  # SHA256 of sorted inputs
    formula_hash: str  # SHA256 of formula expression
    execution_hash: str  # SHA256 of execution context
    semantic_hash: str  # SHA256 of semantic validation rules
    template_hash: str  # SHA256 of template definition
    generation_hash: str  # SHA256 of generation context (versions, timestamps, generator_id)
    lifecycle_hash: str  # SHA256 of lifecycle metadata (stages, events order)

    # Composite hash (all above combined)
    identity_hash: str  # SHA256(hash1 + hash2 + ... + hash7)

    # Metadata
    template_type: str
    engine_version: str
    generation_timestamp: str

    # Reproducibility markers
    is_deterministic: bool = True
    can_reproduce: bool = True


class ReportIdentityGenerator:
    """Generates deterministic, reproducible report identities."""

    @staticmethod
    def _hash_dict(data: Dict[str, Any]) -> str:
        """Hash dictionary with stable ordering and canonicalization."""
        return DeterministicHasher.hash_canonical(data)

    @staticmethod
    def _hash_string(text: str) -> str:
        """Hash string with whitespace normalization."""
        return DeterministicHasher.hash_string(text)

    @staticmethod
    def compute_inputs_hash(inputs: Dict[str, Any]) -> str:
        """
        Compute deterministic hash of input variables.

        Uses canonical serialization with float normalization and whitespace handling.

        Args:
            inputs: Input variables dict

        Returns:
            SHA256 hash of inputs
        """
        return DeterministicHasher.hash_canonical(inputs)

    @staticmethod
    def compute_formula_hash(formula: str) -> str:
        """
        Compute deterministic hash of formula expression.

        Whitespace-independent: "a + b" == "a+b" == "a  +  b"

        Args:
            formula: Formula expression string

        Returns:
            SHA256 hash of formula
        """
        return DeterministicHasher.hash_formula(formula)

    @staticmethod
    def compute_execution_hash(
        execution_time_ms: Optional[float],
        validation_status: str,
        num_validations: int
    ) -> str:
        """
        Compute hash of execution context.

        Args:
            execution_time_ms: Execution duration
            validation_status: Result status
            num_validations: Number of validation rules

        Returns:
            SHA256 hash of execution context
        """
        context = {
            "validation_status": validation_status,
            "num_validations": num_validations,
        }
        if execution_time_ms is not None:
            # Round to nearest millisecond for reproducibility
            context["execution_time_ms"] = round(execution_time_ms)

        return ReportIdentityGenerator._hash_dict(context)

    @staticmethod
    def compute_semantic_hash(
        semantic_rules: Optional[Dict[str, Any]]
    ) -> str:
        """
        Compute hash of semantic validation rules.

        Args:
            semantic_rules: Validation rules applied

        Returns:
            SHA256 hash of semantic rules
        """
        if not semantic_rules:
            return ReportIdentityGenerator._hash_string("")

        return ReportIdentityGenerator._hash_dict(semantic_rules)

    @staticmethod
    def compute_template_hash(
        template_type: str,
        template_version: str
    ) -> str:
        """
        Compute hash of template definition.

        Args:
            template_type: Type of template used
            template_version: Template version

        Returns:
            SHA256 hash of template
        """
        template_data = {
            "type": template_type,
            "version": template_version,
        }
        return ReportIdentityGenerator._hash_dict(template_data)

    @staticmethod
    def compute_generation_hash(
        engine_version: str,
        runner_version: str,
        template_version: str,
        generator_id: str,
    ) -> str:
        """
        Compute hash of generation context (versions and generator info).

        Args:
            engine_version: Reporting engine version
            runner_version: Calculation runner version
            template_version: Template format version
            generator_id: Who initiated generation

        Returns:
            SHA256 hash of generation context
        """
        generation_data = {
            "engine_version": engine_version,
            "runner_version": runner_version,
            "template_version": template_version,
            "generator_id": generator_id,
        }
        return ReportIdentityGenerator._hash_dict(generation_data)

    @staticmethod
    def compute_lifecycle_hash(
        num_stages: int,
        num_events: int,
        final_stage: str,
    ) -> str:
        """
        Compute hash of lifecycle structure (stages, event count, completion).

        Args:
            num_stages: Number of stages in lifecycle
            num_events: Number of lifecycle events
            final_stage: Final stage name

        Returns:
            SHA256 hash of lifecycle
        """
        lifecycle_data = {
            "num_stages": num_stages,
            "num_events": num_events,
            "final_stage": final_stage,
        }
        return ReportIdentityGenerator._hash_dict(lifecycle_data)

    @staticmethod
    def generate_report_id(
        calculation_id: str,
        inputs_hash: str,
        formula_hash: str,
        template_type: str
    ) -> str:
        """
        Generate stable report ID from core components.

        Ensures: same calculation + same inputs + same formula → same report_id

        Args:
            calculation_id: Source calculation
            inputs_hash: Hash of inputs
            formula_hash: Hash of formula
            template_type: Report template type

        Returns:
            Stable report ID
        """
        # Combine: calculation_id + inputs_hash[:8] + formula_hash[:8] + template_type
        components = [
            calculation_id,
            inputs_hash[:8],
            formula_hash[:8],
            template_type
        ]
        report_id = "_".join(components)
        return f"rpt_{report_id}"

    @staticmethod
    def generate_identity(
        calculation_id: str,
        calculation_result: CalculationResult,
        context: ReportGenerationContext,
        template_definition: Optional[Dict[str, Any]] = None,
    ) -> ReportIdentity:
        """
        Generate complete deterministic report identity.

        Args:
            calculation_id: Source calculation ID
            calculation_result: CalculationResult from runner
            context: ReportGenerationContext
            template_definition: Optional template spec for hashing

        Returns:
            ReportIdentity with all hashes and reproducibility info
        """
        logger.info(f"Generating identity for calculation {calculation_id}")

        # Extract inputs from calculation result
        inputs = {}
        if hasattr(calculation_result, 'metadata') and isinstance(calculation_result.metadata, dict):
            inputs = calculation_result.metadata.get('inputs', {})

        # Compute individual hashes
        inputs_hash = ReportIdentityGenerator.compute_inputs_hash(inputs)

        formula = ""
        if hasattr(calculation_result, 'metadata') and isinstance(calculation_result.metadata, dict):
            formula = calculation_result.metadata.get('formula', '')
        formula_hash = ReportIdentityGenerator.compute_formula_hash(formula)

        execution_hash = ReportIdentityGenerator.compute_execution_hash(
            execution_time_ms=getattr(calculation_result, 'execution_time_ms', None),
            validation_status=getattr(calculation_result, 'status', 'unknown'),
            num_validations=len(getattr(calculation_result, 'validation_results', []))
        )

        semantic_rules = None
        if hasattr(calculation_result, 'metadata') and isinstance(calculation_result.metadata, dict):
            semantic_rules = calculation_result.metadata.get('semantic_rules')
        semantic_hash = ReportIdentityGenerator.compute_semantic_hash(semantic_rules)

        template_hash = ReportIdentityGenerator.compute_template_hash(
            template_type=context.template_type,
            template_version=context.template_version
        )

        generation_hash = ReportIdentityGenerator.compute_generation_hash(
            engine_version=context.engine_version,
            runner_version=context.runner_version,
            template_version=context.template_version,
            generator_id=context.generator_id,
        )

        # Lifecycle hash computed with minimal events count (will be updated after full generation)
        lifecycle_hash = ReportIdentityGenerator.compute_lifecycle_hash(
            num_stages=5,  # Expected: CONTEXT_BUILDING, IDENTITY_GENERATED, DOCUMENT_RENDERING, LIFECYCLE_REGISTERED, VERIFICATION_READY
            num_events=0,  # Will be updated during generation
            final_stage="lifecycle_registered",
        )

        # Generate report ID (deterministic)
        report_id = ReportIdentityGenerator.generate_report_id(
            calculation_id=calculation_id,
            inputs_hash=inputs_hash,
            formula_hash=formula_hash,
            template_type=context.template_type
        )

        # Combine all 7 hashes for identity hash
        all_hashes = [
            inputs_hash,
            formula_hash,
            execution_hash,
            semantic_hash,
            template_hash,
            generation_hash,
            lifecycle_hash,
        ]
        identity_components = "".join(all_hashes)
        identity_hash = hashlib.sha256(identity_components.encode()).hexdigest()

        identity = ReportIdentity(
            report_id=report_id,
            calculation_id=calculation_id,
            inputs_hash=inputs_hash,
            formula_hash=formula_hash,
            execution_hash=execution_hash,
            semantic_hash=semantic_hash,
            template_hash=template_hash,
            generation_hash=generation_hash,
            lifecycle_hash=lifecycle_hash,
            identity_hash=identity_hash,
            template_type=context.template_type,
            engine_version=context.engine_version,
            generation_timestamp=context.generated_timestamp,
            is_deterministic=True,
            can_reproduce=True,
        )

        logger.info(
            f"Generated identity for report {report_id}: "
            f"identity_hash={identity_hash[:16]}..."
        )

        return identity

    @staticmethod
    def verify_identity(
        identity: ReportIdentity,
        calculation_result: CalculationResult,
        context: ReportGenerationContext,
    ) -> tuple[bool, Optional[str]]:
        """
        Verify identity consistency.

        Args:
            identity: ReportIdentity to verify
            calculation_result: Current CalculationResult
            context: Current ReportGenerationContext

        Returns:
            (is_valid, error_message)
        """
        # Recompute hashes
        inputs = {}
        if hasattr(calculation_result, 'metadata') and isinstance(calculation_result.metadata, dict):
            inputs = calculation_result.metadata.get('inputs', {})

        current_inputs_hash = ReportIdentityGenerator.compute_inputs_hash(inputs)
        if current_inputs_hash != identity.inputs_hash:
            return False, f"Inputs hash mismatch: {current_inputs_hash} != {identity.inputs_hash}"

        formula = ""
        if hasattr(calculation_result, 'metadata') and isinstance(calculation_result.metadata, dict):
            formula = calculation_result.metadata.get('formula', '')
        current_formula_hash = ReportIdentityGenerator.compute_formula_hash(formula)
        if current_formula_hash != identity.formula_hash:
            return False, f"Formula hash mismatch: {current_formula_hash} != {identity.formula_hash}"

        # Verify template consistency
        if context.template_type != identity.template_type:
            return False, f"Template type mismatch: {context.template_type} != {identity.template_type}"

        return True, None


# Global identity generator instance
_identity_generator = ReportIdentityGenerator()


def get_identity_generator() -> ReportIdentityGenerator:
    """Get global identity generator instance."""
    return _identity_generator
