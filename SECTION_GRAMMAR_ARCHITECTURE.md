# SECTION GRAMMAR ARCHITECTURE

**Status:** 📋 EXTENSIBLE GRAMMAR DESIGN & PATTERN REGISTRY  
**Focus:** Multi-standard section detection (ГОСТ, СТ РК, API, ASME, Latin, Cyrillic)  
**Target:** Production-ready grammar before Week 2 parser implementation

---

## EXECUTIVE SUMMARY

**Current limitation:**
- Single regex pattern inadequate for multilingual + multinational standards
- API 5L + ASME B31.x (decimal) + ГОСТ (Cyrillic decimal) + Cyrillic appendices → conflicts
- No confidence scoring for pattern reliability
- No nesting support (breaks for complex standards)

**After hardening:**
- Extensible registry of grammar patterns
- Per-pattern confidence scoring
- Multilingual support (Latin + Cyrillic + mixed)
- Nesting depth limits
- Priority-based pattern matching

---

## PROBLEM ANALYSIS

### Current Regex Failure Modes

```python
# Current single regex
HEADING_REGEX = r'^\s*((?:\d+\.?)*)\s+([A-ZА-Я].*?)(?:\s*$|\s{2,})'

# Fails for:

# 1. Cyrillic appendices (letter + space)
text = "Приложение А Справочная таблица"
#       ^^^^^^^^^^^ ^ Matches! ✓
#       But confidence should be HIGH (Cyrillic appendix explicit)

# 2. Latin appendices  
text = "Appendix B Welding Standards"
#       ^^^^^^^^^ ^ Matches? NO ✗
#       Regex expects Cyrillic letter

# 3. Roman numerals (sometimes used)
text = "Chapter I Introduction"
#       ^^^^^^^   Matches? MAYBE
#       Ambiguous: could be text "I" not section "I"

# 4. Mixed standards  
text = "ПП 3.2.1.5 Допустимые давления"
#       ^^^^^^^^^^^ Should match, but complex prefix

# 5. CIS standard markers
text = "ГОСТ Р 8.567:2022 Метрология"
#       ^^^^ Only numeric patterns match, no standard marker
```

### Root Causes

1. **Single pattern assumes decimal numbering:** No support for other styles
2. **No confidence scoring:** All matches equally weighted
3. **No context awareness:** Can't distinguish "I" (letter) from "I" (numeral)
4. **No extensibility:** Adding pattern = modifying core regex

---

## ARCHITECTURE: Pattern Registry

### Core Design

```python
from enum import Enum
from dataclasses import dataclass
from typing import List, Optional, Dict, Any, Pattern as RegexPattern
import re

class SectionNumberingStyle(Enum):
    """Numbering scheme classification."""
    
    DECIMAL = "decimal"                 # 1.2.3 / 1.2.3.4.5
    CYRILLIC_DECIMAL = "cyrillic_decimal"  # 1. 2. 3. / Cyrillic context
    ROMAN = "roman"                     # I.II.III / I.II.III.IV
    CYRILLIC_LETTER = "cyrillic_letter"    # А Б В / Appendices
    LATIN_LETTER = "latin_letter"       # A B C / Appendices
    MIXED = "mixed"                     # 2.3.В.4 / Complex standards
    KEYWORD_ONLY = "keyword_only"       # "Section" keyword, no number
    STANDARD_MARKER = "standard_marker" # "ГОСТ 20295-85" / Standard reference

class SectionConfidence(Enum):
    """Confidence levels for pattern matches."""
    VERY_HIGH = (0.95, 1.0, "Clear, unambiguous match")
    HIGH = (0.85, 0.95, "Strong match, minor ambiguity")
    MEDIUM = (0.70, 0.85, "Moderate match, context-dependent")
    LOW = (0.50, 0.70, "Weak match, requires confirmation")
    UNCERTAIN = (0.0, 0.50, "Very weak match, likely false positive")

@dataclass
class SectionPattern:
    """Grammar rule for section detection."""
    
    # Identification
    pattern_id: str                     # Unique identifier
    pattern_name: str                   # Human-readable name
    
    # Matching
    regex: str                          # Regex pattern
    compiled_regex: Optional[RegexPattern] = None  # Compiled regex (lazy)
    
    # Classification
    numbering_style: SectionNumberingStyle
    keywords: List[str]                 # Associated keywords
    
    # Confidence
    base_confidence: float              # Confidence without context
    context_keywords: List[str] = None  # Keywords that boost confidence
    context_boost: float = 0.05         # Confidence boost if context matches
    
    # Nesting rules
    supports_nesting: bool = False
    max_nesting_depth: int = 1
    
    # Priority (for conflict resolution)
    priority: int = 50                  # 0-100, higher = tried first
    
    # Metadata
    supported_languages: List[str] = None  # ['en', 'ru', 'kk']
    supported_standards: List[str] = None  # ['API 5L', 'ГОСТ']
    
    def get_compiled_regex(self) -> RegexPattern:
        """Get or compile regex."""
        if self.compiled_regex is None:
            self.compiled_regex = re.compile(self.regex, re.UNICODE | re.MULTILINE)
        return self.compiled_regex
    
    def match(self, line: str, context: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        """Try to match line against this pattern."""
        regex = self.get_compiled_regex()
        m = regex.match(line.strip())
        
        if not m:
            return None
        
        # Matched! Now compute confidence
        confidence = self.base_confidence
        
        # Context boost
        if context and self.context_keywords:
            for keyword in self.context_keywords:
                if keyword.lower() in str(context).lower():
                    confidence += self.context_boost
                    confidence = min(confidence, 0.99)  # Cap at 0.99
                    break
        
        return {
            'pattern_id': self.pattern_id,
            'pattern_name': self.pattern_name,
            'numbering_style': self.numbering_style.value,
            'match_groups': m.groups(),
            'confidence': confidence,
            'priority': self.priority
        }

class SectionGrammarRegistry:
    """Extensible registry of section grammar patterns."""
    
    def __init__(self):
        self.patterns: List[SectionPattern] = []
        self.pattern_map: Dict[str, SectionPattern] = {}
        self._register_builtin_patterns()
    
    def register(self, pattern: SectionPattern) -> None:
        """Register new pattern."""
        self.patterns.append(pattern)
        self.pattern_map[pattern.pattern_id] = pattern
        # Resort by priority
        self.patterns.sort(key=lambda p: p.priority, reverse=True)
    
    def unregister(self, pattern_id: str) -> None:
        """Remove pattern."""
        self.patterns = [p for p in self.patterns if p.pattern_id != pattern_id]
        del self.pattern_map[pattern_id]
    
    def _register_builtin_patterns(self):
        """Register all standard patterns."""
        
        # PATTERN 1: API/ASME decimal numbered sections
        self.register(SectionPattern(
            pattern_id='api_asme_decimal',
            pattern_name='API/ASME Decimal Numbered',
            regex=r'^((?:\d+\.)*\d+)\s+([A-Z][^~]*?)$',
            numbering_style=SectionNumberingStyle.DECIMAL,
            keywords=['Section', 'Subsection', 'Article'],
            base_confidence=0.90,
            context_keywords=['API', 'ASME'],
            context_boost=0.05,
            supports_nesting=True,
            max_nesting_depth=6,
            priority=95,
            supported_languages=['en'],
            supported_standards=['API 5L', 'ASME B31.4', 'ASME B31.8']
        ))
        
        # PATTERN 2: ГОСТ decimal numbered sections
        self.register(SectionPattern(
            pattern_id='gost_decimal',
            pattern_name='ГОСТ Decimal Numbered',
            regex=r'^((?:\d+\.)*\d+)\s+([А-ЯЁ][^~]*?)$',
            numbering_style=SectionNumberingStyle.CYRILLIC_DECIMAL,
            keywords=['Раздел', 'Пункт', 'Подраздел'],
            base_confidence=0.88,
            context_keywords=['ГОСТ', 'Р', 'СТ РК'],
            context_boost=0.07,
            supports_nesting=True,
            max_nesting_depth=6,
            priority=94,
            supported_languages=['ru'],
            supported_standards=['ГОСТ', 'ГОСТ Р', 'СТ РК']
        ))
        
        # PATTERN 3: Latin letter appendix (A, B, C)
        self.register(SectionPattern(
            pattern_id='appendix_latin',
            pattern_name='Latin Letter Appendix',
            regex=r'^(?:ANNEX|Annex|APPENDIX|Appendix)\s+([A-Z])\s+([A-Z][^~]*?)$',
            numbering_style=SectionNumberingStyle.LATIN_LETTER,
            keywords=['Annex', 'Appendix'],
            base_confidence=0.95,
            context_keywords=[],
            supports_nesting=True,
            max_nesting_depth=3,
            priority=92,
            supported_languages=['en'],
            supported_standards=['API 5L', 'ASME']
        ))
        
        # PATTERN 4: Cyrillic letter appendix (А, Б, В)
        self.register(SectionPattern(
            pattern_id='appendix_cyrillic',
            pattern_name='Cyrillic Letter Appendix',
            regex=r'^(?:Приложение|ПРИЛОЖЕНИЕ)\s+([А-ЯЁ])\s+([А-ЯЁ][^~]*?)$',
            numbering_style=SectionNumberingStyle.CYRILLIC_LETTER,
            keywords=['Приложение', 'Appendix'],
            base_confidence=0.96,
            context_keywords=[],
            supports_nesting=True,
            max_nesting_depth=3,
            priority=91,
            supported_languages=['ru'],
            supported_standards=['ГОСТ', 'СТ РК']
        ))
        
        # PATTERN 5: Roman numeral sections
        self.register(SectionPattern(
            pattern_id='roman_numbered',
            pattern_name='Roman Numeral Numbered',
            regex=r'^(?:Chapter|CHAPTER)\s+([IVXLC]+)\s+([A-Z][^~]*?)$',
            numbering_style=SectionNumberingStyle.ROMAN,
            keywords=['Chapter', 'Part'],
            base_confidence=0.75,  # Lower: ambiguous with text
            context_keywords=['Chapter', 'Roman'],
            context_boost=0.15,    # Higher boost if context confirms
            supports_nesting=True,
            max_nesting_depth=4,
            priority=75,
            supported_languages=['en']
        ))
        
        # PATTERN 6: Mixed Cyrillic prefix + decimal (ПП, СП, etc.)
        self.register(SectionPattern(
            pattern_id='mixed_cyrillic_decimal',
            pattern_name='Mixed Cyrillic Prefix + Decimal',
            regex=r'^((?:[А-ЯЁ]+)\s+(?:\d+\.)*\d+)\s+([А-ЯЁ][^~]*?)$',
            numbering_style=SectionNumberingStyle.MIXED,
            keywords=['Раздел', 'Пункт'],
            base_confidence=0.82,
            context_keywords=['СП', 'ПП', 'СНиП'],
            context_boost=0.08,
            supports_nesting=True,
            max_nesting_depth=6,
            priority=88,
            supported_languages=['ru'],
            supported_standards=['СП', 'СНиП', 'РД']
        ))
        
        # PATTERN 7: Standard marker (ГОСТ 20295-85)
        self.register(SectionPattern(
            pattern_id='standard_marker',
            pattern_name='Standard Marker',
            regex=r'^((?:ГОСТ|СТ РК|СП|СНиП|РД|API|ASME|ISO|IEC)\s+[\w\-\d./:]+)\s+([А-ЯЁA-Z][^~]*?)$',
            numbering_style=SectionNumberingStyle.STANDARD_MARKER,
            keywords=['ГОСТ', 'СТ РК', 'API', 'ASME', 'ISO'],
            base_confidence=0.93,
            context_keywords=[],
            supports_nesting=False,
            priority=96,
            supported_languages=['ru', 'en'],
            supported_standards=['ГОСТ', 'СТ РК', 'API', 'ASME', 'ISO']
        ))
        
        # PATTERN 8: Keyword-only sections (no numbering)
        for keyword in ['Раздел', 'Section', 'РАЗДЕЛ', 'SECTION']:
            self.register(SectionPattern(
                pattern_id=f'keyword_{keyword.lower()}',
                pattern_name=f'Keyword-Only: {keyword}',
                regex=rf'^(?:{keyword})\s+([A-ZА-Я][^~]*?)$',
                numbering_style=SectionNumberingStyle.KEYWORD_ONLY,
                keywords=[keyword],
                base_confidence=0.65,  # Lower: context-dependent
                context_keywords=[],
                supports_nesting=True,
                max_nesting_depth=6,
                priority=50,
                supported_languages=['ru' if keyword[0].isupper() and ord(keyword[0]) > 1040 else 'en']
            ))
    
    def detect_sections(self, text: str, context: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Detect sections using all patterns."""
        sections = []
        
        for line in text.split('\n'):
            line_stripped = line.strip()
            if not line_stripped:
                continue
            
            # Try patterns in priority order
            for pattern in self.patterns:
                match = pattern.match(line_stripped, context)
                if match:
                    match['line'] = line
                    sections.append(match)
                    break  # First match wins
        
        return sections
    
    def get_pattern(self, pattern_id: str) -> Optional[SectionPattern]:
        """Get pattern by ID."""
        return self.pattern_map.get(pattern_id)
    
    def get_patterns_by_language(self, language: str) -> List[SectionPattern]:
        """Get patterns supporting specific language."""
        return [
            p for p in self.patterns
            if not p.supported_languages or language in p.supported_languages
        ]
    
    def get_patterns_by_standard(self, standard: str) -> List[SectionPattern]:
        """Get patterns supporting specific standard."""
        return [
            p for p in self.patterns
            if not p.supported_standards or standard in p.supported_standards
        ]
```

---

## CONFIDENCE SCORING

### Per-Pattern Confidence

```python
# Pattern confidence examples:

# Standard marker (API 5L, ГОСТ, etc.) = VERY HIGH
"ГОСТ Р 8.567:2022 Метрология"  
# → confidence = 0.96 (unambiguous marker)

# Decimal number + Cyrillic = HIGH
"1.2 Введение"
# → confidence = 0.88 (clear section number)

# Keyword-only = MEDIUM (context-dependent)
"Раздел введение"
# → confidence = 0.65 (could be text "раздел" in sentence)
# → confidence = 0.70 with context boost (keyword present)

# Roman numeral = LOW (ambiguous)
"Chapter I Introduction"
# → confidence = 0.75 (could be text "I" not numeral)
# → confidence = 0.90 with context boost (word "Chapter" confirms)
```

### Confidence Composition

```python
@dataclass
class SectionDetectionResult:
    """Section detection result with confidence composition."""
    
    text: str
    pattern_matched: SectionPattern
    base_confidence: float
    context_boost: float
    
    @property
    def final_confidence(self) -> float:
        """Composite confidence."""
        return min(self.base_confidence + self.context_boost, 0.99)
    
    def is_high_confidence(self) -> bool:
        return self.final_confidence >= 0.85
    
    def requires_manual_review(self) -> bool:
        return self.final_confidence < 0.70
```

---

## NESTING SUPPORT

```python
@dataclass
class SectionHierarchy:
    """Multi-level section hierarchy."""
    
    sections: List[SectionDetectionResult]
    max_depth_observed: int
    
    def validate_nesting(self) -> bool:
        """Verify nesting doesn't exceed pattern limits."""
        for section in self.sections:
            if self.max_depth_observed > section.pattern_matched.max_nesting_depth:
                return False
        return True
    
    def get_level(self, index: int) -> int:
        """Get nesting level of section."""
        # Heuristic: sections with more decimal points are deeper
        section = self.sections[index]
        if section.pattern_matched.numbering_style == SectionNumberingStyle.DECIMAL:
            # Count dots in number
            return section.text.count('.')
        return 0
```

---

## PATTERN REGISTRATION EXAMPLE

```python
# Register custom pattern for proprietary standard
registry.register(SectionPattern(
    pattern_id='custom_engineering_spec',
    pattern_name='Custom Engineering Specification',
    regex=r'^(ENG-\d+\.\d+)\s+([A-Z][^~]*?)$',
    numbering_style=SectionNumberingStyle.MIXED,
    keywords=['ENG', 'SPEC'],
    base_confidence=0.85,
    context_keywords=['ENG-'],
    context_boost=0.10,
    supports_nesting=True,
    max_nesting_depth=4,
    priority=89,
    supported_standards=['Custom Engineering Standard']
))
```

---

## PRODUCTION DEPLOYMENT

### Grammar Registry Configuration

```yaml
# section_grammar.yaml
registry:
  version: "1.0"
  patterns:
    - pattern_id: "api_asme_decimal"
      enabled: true
      priority: 95
    
    - pattern_id: "gost_decimal"
      enabled: true
      priority: 94
    
    - pattern_id: "appendix_latin"
      enabled: true
      priority: 92
    
    - pattern_id: "appendix_cyrillic"
      enabled: true
      priority: 91
    
    - pattern_id: "standard_marker"
      enabled: true
      priority: 96
    
    # Custom patterns can be added:
    # - pattern_id: "custom_internal_spec"
    #   enabled: false  # Disabled until testing complete
    #   priority: 50
```

### Extensibility Example

```python
# Week N: Customer introduces proprietary standard
# Action: Register new pattern without modifying core parser

registry = SectionGrammarRegistry.load_from_config('section_grammar.yaml')

# Add custom pattern
registry.register(SectionPattern(...))

# Export updated config
registry.save_to_config('section_grammar.yaml')

# Deploy updated config to production
# → New standard automatically detected
```

---

**Status:** 📋 SECTION GRAMMAR ARCHITECTURE COMPLETE

**Next Step:** PARSER_DETERMINISM_CONTRACT.md (final determinism formalization)
