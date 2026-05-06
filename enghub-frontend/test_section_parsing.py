#!/usr/bin/env python3
"""Test script to verify the new cable section parsing fixes."""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'cable_calc'))

from cable_calc.parsers.utils import parse_section

# Test cases that were failing before (WARN status = section_mm2 == 0.0)
test_cases = [
    # Format: (input_text, expected_section, description)
    ("2x220 мм²", 220.0, "Row 126: 2x220 with units"),
    ("2х(1х20+1х70) мм²", 20.0, "Nested section with outer conductor multiplier"),
    ("2х320 мм²", 320.0, "2x320 with Cyrillic x and units"),
    ("3х1,5 мм²", 1.5, "3x1.5 with comma decimal and units"),
    ("2.5 мм²", 2.5, "Simple number without multiplier"),
    ("0.75", 0.75, "Very small section"),
    # Already working formats (should still work)
    ("3x16", 16.0, "Simple format: 3x16"),
    ("4x95+1x50", 95.0, "Composite: 4x95+1x50"),
    ("2x120", 120.0, "Simple: 2x120"),
    ("95", 95.0, "Raw number"),
    ("1x10", 10.0, "1x10"),
    ("4х95+1х50", 95.0, "Cyrillic x format"),
    # Edge cases with whitespace and mixed formatting
    ("  2 x 25  мм² ", 25.0, "With extra spaces"),
    ("4x95 мм²", 95.0, "Composite with units"),
]

print("=" * 70)
print("TESTING CABLE SECTION PARSING")
print("=" * 70)

passed = 0
failed = 0

for input_text, expected_section, description in test_cases:
    phases, section_mm2, zero_section, raw = parse_section(input_text)
    status = "✓ PASS" if section_mm2 == expected_section else "✗ FAIL"

    if section_mm2 == expected_section:
        passed += 1
    else:
        failed += 1

    print(f"\n{status}")
    print(f"  Input: {input_text!r}")
    print(f"  Expected section: {expected_section} mm²")
    print(f"  Got section: {section_mm2} mm², phases={phases}, zero_section={zero_section}")
    print(f"  Raw match: {raw!r}")
    print(f"  Description: {description}")

print("\n" + "=" * 70)
print(f"RESULTS: {passed} passed, {failed} failed out of {passed + failed} tests")
print("=" * 70)

if failed == 0:
    print("\n✓ All tests passed! The fix is working correctly.")
    sys.exit(0)
else:
    print(f"\n✗ {failed} test(s) failed. Please review the regex patterns.")
    sys.exit(1)
