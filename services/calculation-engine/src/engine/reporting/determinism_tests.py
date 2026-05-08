"""Determinism testing suite - verifies reproducibility of report generation.

Tests that:
1. Same calculation inputs → same report identity
2. Same template + engine version → same template hash
3. Same lifecycle structure → same lifecycle hash
4. 100+ runs with whitespace/ordering variations → identical hashes
"""

import logging
from typing import Dict, List, Tuple, Any
from dataclasses import dataclass
import copy

from src.schemas import CalculationResult
from .pipeline import UnifiedReportingPipeline
from .report_identity import ReportIdentity
from .deterministic_hashing import DeterministicHasher

logger = logging.getLogger(__name__)


@dataclass
class DeterminismTestResult:
    """Result of a single determinism test run."""
    test_name: str
    run_number: int
    report_id: str
    identity_hash: str
    inputs_hash: str
    formula_hash: str
    execution_hash: str
    semantic_hash: str
    template_hash: str
    generation_hash: str
    lifecycle_hash: str
    success: bool
    error_message: Optional[str] = None


class DeterminismTestSuite:
    """Test suite for verifying report generation determinism."""

    def __init__(self, pipeline: UnifiedReportingPipeline):
        """Initialize test suite with reporting pipeline."""
        self.pipeline = pipeline
        self.test_results: List[DeterminismTestResult] = []

    def test_exact_reproducibility(
        self,
        calculation_id: str,
        calculation_result: CalculationResult,
        template_type: str = "generic",
        num_runs: int = 10,
    ) -> Tuple[bool, List[DeterminismTestResult]]:
        """
        Test: Same inputs → identical report identity.

        Runs report generation multiple times with same calculation_result.
        Verifies all 7 hash fields are identical across runs.

        Args:
            calculation_id: Calculation ID
            calculation_result: CalculationResult
            template_type: Report template
            num_runs: Number of runs (recommended: 10-50)

        Returns:
            (all_passed, test_results)
        """
        logger.info(
            f"[DETERMINISM TEST] Starting exact reproducibility test "
            f"(calculation={calculation_id}, runs={num_runs})"
        )

        results = []
        first_identity: Optional[ReportIdentity] = None
        all_match = True

        for run in range(num_runs):
            try:
                response, identity, context = self.pipeline.execute(
                    calculation_id=calculation_id,
                    calculation_result=calculation_result,
                    template_type=template_type,
                )

                result = DeterminismTestResult(
                    test_name="exact_reproducibility",
                    run_number=run + 1,
                    report_id=identity.report_id,
                    identity_hash=identity.identity_hash,
                    inputs_hash=identity.inputs_hash,
                    formula_hash=identity.formula_hash,
                    execution_hash=identity.execution_hash,
                    semantic_hash=identity.semantic_hash,
                    template_hash=identity.template_hash,
                    generation_hash=identity.generation_hash,
                    lifecycle_hash=identity.lifecycle_hash,
                    success=True,
                )

                # Check against first run
                if first_identity is None:
                    first_identity = identity
                    logger.debug(f"[DETERMINISM TEST] Run 1: identity_hash={identity.identity_hash[:16]}...")
                else:
                    # Compare all hashes
                    matches = (
                        identity.identity_hash == first_identity.identity_hash
                        and identity.inputs_hash == first_identity.inputs_hash
                        and identity.formula_hash == first_identity.formula_hash
                        and identity.execution_hash == first_identity.execution_hash
                        and identity.semantic_hash == first_identity.semantic_hash
                        and identity.template_hash == first_identity.template_hash
                        and identity.generation_hash == first_identity.generation_hash
                        and identity.lifecycle_hash == first_identity.lifecycle_hash
                    )

                    if matches:
                        logger.debug(f"[DETERMINISM TEST] Run {run + 1}: ✓ All hashes match")
                    else:
                        logger.error(
                            f"[DETERMINISM TEST] Run {run + 1}: ✗ Hash mismatch!\n"
                            f"  identity_hash: {identity.identity_hash[:16]}... "
                            f"vs {first_identity.identity_hash[:16]}..."
                        )
                        all_match = False
                        result.success = False

                results.append(result)

            except Exception as e:
                logger.error(f"[DETERMINISM TEST] Run {run + 1} failed: {e}")
                result = DeterminismTestResult(
                    test_name="exact_reproducibility",
                    run_number=run + 1,
                    report_id="error",
                    identity_hash="error",
                    inputs_hash="error",
                    formula_hash="error",
                    execution_hash="error",
                    semantic_hash="error",
                    template_hash="error",
                    generation_hash="error",
                    lifecycle_hash="error",
                    success=False,
                    error_message=str(e),
                )
                results.append(result)
                all_match = False

        self.test_results.extend(results)

        logger.info(
            f"[DETERMINISM TEST] Exact reproducibility: "
            f"{'✓ PASS' if all_match else '✗ FAIL'} ({sum(1 for r in results if r.success)}/{num_runs})"
        )

        return all_match, results

    def test_whitespace_invariance(
        self,
        formula: str,
        num_variations: int = 20,
    ) -> Tuple[bool, List[str]]:
        """
        Test: Different whitespace → same formula hash.

        Creates multiple whitespace variations of formula and verifies hash is identical.

        Args:
            formula: Formula expression
            num_variations: Number of whitespace variations to test

        Returns:
            (all_match, hashes)
        """
        logger.info(f"[DETERMINISM TEST] Testing whitespace invariance on: {formula[:50]}...")

        hashes = []
        variations = []

        # Generate whitespace variations
        variations.append(formula)  # Original
        variations.append(formula.replace(" ", ""))  # No spaces
        variations.append(formula.replace(" ", "  "))  # Double spaces
        variations.append(formula.replace(" ", "\t"))  # Tabs
        variations.append(formula.replace(" ", "\n"))  # Newlines (normalized)

        # Add random variations
        for i in range(num_variations - 5):
            import random
            words = formula.split()
            sep = random.choice([" ", "  ", "\t"])
            variation = sep.join(words)
            variations.append(variation)

        # Hash each variation
        all_match = True
        first_hash = None

        for i, var in enumerate(variations):
            hash_val = DeterministicHasher.hash_formula(var)
            hashes.append(hash_val)

            if first_hash is None:
                first_hash = hash_val
                logger.debug(f"[DETERMINISM TEST] Variation 1: hash={hash_val[:16]}...")
            elif hash_val != first_hash:
                logger.error(
                    f"[DETERMINISM TEST] Variation {i + 1}: hash mismatch!\n"
                    f"  Expected: {first_hash[:16]}...\n"
                    f"  Got:      {hash_val[:16]}..."
                )
                all_match = False
            else:
                logger.debug(f"[DETERMINISM TEST] Variation {i + 1}: ✓ Hash matches")

        logger.info(
            f"[DETERMINISM TEST] Whitespace invariance: "
            f"{'✓ PASS' if all_match else '✗ FAIL'} ({sum(1 for h in hashes if h == first_hash)}/{len(hashes)})"
        )

        return all_match, hashes

    def test_metadata_ordering(
        self,
        metadata: Dict[str, Any],
        num_permutations: int = 10,
    ) -> Tuple[bool, List[str]]:
        """
        Test: Different dict key ordering → same canonical hash.

        Creates multiple key orderings and verifies hash is identical.

        Args:
            metadata: Dictionary to test
            num_permutations: Number of ordering permutations

        Returns:
            (all_match, hashes)
        """
        logger.info(f"[DETERMINISM TEST] Testing metadata ordering invariance...")

        hashes = []
        all_match = True
        first_hash = None

        # Generate key orderings
        keys = list(metadata.keys())
        import random

        for i in range(num_permutations):
            # Shuffle keys
            shuffled_keys = keys.copy()
            random.shuffle(shuffled_keys)

            # Create dict with shuffled order
            shuffled_dict = {k: metadata[k] for k in shuffled_keys}

            # Hash
            hash_val = DeterministicHasher.hash_canonical(shuffled_dict)
            hashes.append(hash_val)

            if first_hash is None:
                first_hash = hash_val
                logger.debug(f"[DETERMINISM TEST] Permutation 1: hash={hash_val[:16]}...")
            elif hash_val != first_hash:
                logger.error(
                    f"[DETERMINISM TEST] Permutation {i + 1}: hash mismatch!\n"
                    f"  Expected: {first_hash[:16]}...\n"
                    f"  Got:      {hash_val[:16]}..."
                )
                all_match = False
            else:
                logger.debug(f"[DETERMINISM TEST] Permutation {i + 1}: ✓ Hash matches")

        logger.info(
            f"[DETERMINISM TEST] Metadata ordering: "
            f"{'✓ PASS' if all_match else '✗ FAIL'} ({sum(1 for h in hashes if h == first_hash)}/{num_permutations})"
        )

        return all_match, hashes

    def test_float_normalization(
        self,
        inputs: Dict[str, float],
        num_variations: int = 50,
    ) -> Tuple[bool, List[str]]:
        """
        Test: Floating-point variations (rounding errors) → same inputs hash.

        Creates slight floating-point variations and verifies hash is identical.

        Args:
            inputs: Input dict with float values
            num_variations: Number of variations to test

        Returns:
            (all_match, hashes)
        """
        logger.info(f"[DETERMINISM TEST] Testing float normalization...")

        hashes = []
        all_match = True
        first_hash = None

        # Original hash
        original_hash = DeterministicHasher.hash_canonical(inputs)
        hashes.append(original_hash)
        first_hash = original_hash
        logger.debug(f"[DETERMINISM TEST] Original: hash={original_hash[:16]}...")

        # Create variations with tiny floating-point diffs
        import random
        for i in range(num_variations):
            variation = copy.deepcopy(inputs)

            # Add tiny floating-point noise
            for key in variation:
                if isinstance(variation[key], float):
                    noise = random.uniform(-1e-10, 1e-10)
                    variation[key] = variation[key] + noise

            hash_val = DeterministicHasher.hash_canonical(variation)
            hashes.append(hash_val)

            if hash_val != first_hash:
                logger.error(
                    f"[DETERMINISM TEST] Variation {i + 1}: hash mismatch after FP noise!\n"
                    f"  Expected: {first_hash[:16]}...\n"
                    f"  Got:      {hash_val[:16]}..."
                )
                all_match = False
            else:
                logger.debug(f"[DETERMINISM TEST] Variation {i + 1}: ✓ Hash matches despite FP noise")

        logger.info(
            f"[DETERMINISM TEST] Float normalization: "
            f"{'✓ PASS' if all_match else '✗ FAIL'} ({sum(1 for h in hashes if h == first_hash)}/{num_variations})"
        )

        return all_match, hashes

    def get_test_summary(self) -> Dict[str, Any]:
        """Get summary of all tests run."""
        total = len(self.test_results)
        passed = sum(1 for r in self.test_results if r.success)

        return {
            "total_runs": total,
            "passed": passed,
            "failed": total - passed,
            "success_rate": (passed / total * 100) if total > 0 else 0,
            "test_names": list(set(r.test_name for r in self.test_results)),
        }
