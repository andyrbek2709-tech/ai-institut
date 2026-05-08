#!/usr/bin/env python3
"""
ACTUAL DETERMINISM VERIFICATION EXECUTION
Real test execution with hash evidence capture.

Requirements:
- Same inputs → identical hashes across 100 runs
- All 7 tests must PASS
- Hash variance must be 0 (only 1 unique hash per scenario)
- Evidence reports required
"""

import sys
import os
import json
from pathlib import Path
from datetime import datetime, timezone

# Setup Python path
sys.path.insert(0, str(Path(__file__).parent / "services" / "calculation-engine"))

def run_determinism_verification():
    """Execute actual determinism test suite and capture evidence."""

    print("\n" + "=" * 80)
    print("ACTUAL DETERMINISM VERIFICATION EXECUTION")
    print("=" * 80)
    print(f"Started: {datetime.now(timezone.utc).isoformat()}\n")

    try:
        # Import test suite
        from src.engine.reporting.determinism_tests import DeterminismTestSuite
        print("✓ Imported DeterminismTestSuite")

        # Create test suite instance
        suite = DeterminismTestSuite()
        print("✓ Initialized DeterminismTestSuite\n")

        # Run all tests (real execution)
        print("EXECUTING TESTS...")
        print("-" * 80)
        summary = suite.run_all_tests()
        print("-" * 80 + "\n")

        # Display results
        print("TEST EXECUTION RESULTS")
        print("=" * 80)
        print(f"Total Tests:      {summary.total_tests}")
        print(f"Passed:           {summary.passed_count}")
        print(f"Failed:           {summary.failed_count}")
        print(f"Success Rate:     {summary.success_rate:.1f}%")
        print(f"Total Iterations: {summary.total_iterations}")
        print(f"Timestamp:        {summary.timestamp}\n")

        # Detailed results
        print("INDIVIDUAL TEST RESULTS")
        print("=" * 80)
        for result in summary.test_results:
            status = "✅ PASSED" if result.passed else "❌ FAILED"
            print(f"\n{result.test_name.upper()}")
            print(f"  Status:         {status}")
            print(f"  Iterations:     {result.iterations}")
            print(f"  Hash Variance:  {result.hash_variance} (unique hashes)")
            if result.error_message:
                print(f"  Error:          {result.error_message}")
            if result.details:
                for key, value in result.details.items():
                    if key.startswith('sample_hash') or key.startswith('original_id'):
                        print(f"  {key}: {value}")

        # Verdict
        print("\n" + "=" * 80)
        if summary.failed_count == 0:
            print("✅ DETERMINISM VERIFIED")
            print("All tests passed. Architecture is deterministic.")
        else:
            print("❌ DETERMINISM NOT VERIFIED")
            print(f"{summary.failed_count} test(s) failed. Review errors above.")
        print("=" * 80 + "\n")

        # Export markdown report
        markdown_report = suite.export_summary_markdown(summary)

        # Save reports
        base_path = Path(__file__).parent

        # Save JSON results
        json_results = {
            "execution_timestamp": summary.timestamp,
            "total_tests": summary.total_tests,
            "passed_count": summary.passed_count,
            "failed_count": summary.failed_count,
            "success_rate": summary.success_rate,
            "total_iterations": summary.total_iterations,
            "test_results": [
                {
                    "test_name": r.test_name,
                    "passed": r.passed,
                    "iterations": r.iterations,
                    "hash_variance": r.hash_variance,
                    "error_message": r.error_message,
                    "details": r.details,
                }
                for r in summary.test_results
            ]
        }

        json_path = base_path / "DETERMINISM_EXECUTION_RESULTS.json"
        with open(json_path, 'w') as f:
            json.dump(json_results, f, indent=2)
        print(f"✓ Saved JSON results: {json_path}\n")

        # Save markdown report
        md_path = base_path / "DETERMINISM_EXECUTION_RESULTS.md"
        with open(md_path, 'w') as f:
            f.write(markdown_report)
        print(f"✓ Saved markdown report: {md_path}\n")

        return summary.failed_count == 0

    except ImportError as e:
        print(f"❌ IMPORT ERROR: {e}")
        print("Unable to import test suite. Check Python path and dependencies.")
        return False
    except Exception as e:
        print(f"❌ EXECUTION ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = run_determinism_verification()
    sys.exit(0 if success else 1)
