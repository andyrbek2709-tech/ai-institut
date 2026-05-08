"""Secure formula executor with 3-layer security model."""
import re
import time
import sympy as sp
from typing import Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum


class ExecutionStatus(str, Enum):
    """Status of formula execution."""
    SUCCESS = "success"
    SECURITY_ERROR = "security_error"
    TIMEOUT = "timeout"
    INVALID_FORMULA = "invalid_formula"
    EXECUTION_ERROR = "execution_error"


class SecurityLevel(str, Enum):
    """Security error severity."""
    CRITICAL = "critical"  # Injection attack
    HIGH = "high"          # Resource exhaustion
    MEDIUM = "medium"      # Unexpected operation
    LOW = "low"            # Minor issue


@dataclass
class ExecutionResult:
    """Result of safe formula execution."""
    status: ExecutionStatus
    value: Optional[float] = None
    unit: Optional[str] = None
    duration_ms: float = 0.0
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    formula: Optional[str] = None
    variables_used: Optional[dict] = None

    def is_success(self) -> bool:
        """Check if execution succeeded."""
        return self.status == ExecutionStatus.SUCCESS


class SafeFormulaExecutor:
    """
    Production-grade formula executor with 3-layer security model.

    Layer 1: Input Validation (pattern detection)
    Layer 2: Operation Whitelist (allowed functions only)
    Layer 3: Execution Sandbox (timeout + error handling)
    """

    # Layer 1: Forbidden patterns (code injection, reflection, file access)
    FORBIDDEN_PATTERNS = {
        # Code execution
        '__import__': 'Code execution via import',
        'eval': 'Arbitrary code evaluation',
        'exec': 'Arbitrary code execution',
        'compile': 'Code compilation',
        'globals': 'Global namespace access',
        'locals': 'Local namespace access',
        '__builtin': 'Built-in access',

        # Reflection
        '__class__': 'Class introspection',
        '__bases__': 'Base class access',
        '__subclasses__': 'Subclass enumeration',
        '__dict__': 'Object dictionary access',
        '__mro__': 'Method resolution order',
        '__getattribute__': 'Attribute access override',
        '__setattr__': 'Attribute setting override',
        '__delattr__': 'Attribute deletion override',
        '__code__': 'Code object access',
        '__func__': 'Function object access',

        # File/Network/System
        'open': 'File access',
        'file': 'File access (Python 2)',
        'input': 'Input from stdin',
        'raw_input': 'Input from stdin',
        'print': 'Output to stdout',
        'os': 'Operating system access',
        'sys': 'System access',
        'subprocess': 'Subprocess execution',
        'socket': 'Network access',
        'urllib': 'URL access',
        'requests': 'HTTP requests',

        # Data manipulation
        'getattr': 'Attribute access',
        'setattr': 'Attribute modification',
        'delattr': 'Attribute deletion',
        'vars': 'Variable enumeration',
        'dir': 'Directory enumeration',
        'type': 'Type inspection',

        # Async/Concurrency
        'asyncio': 'Async operations',
        'concurrent': 'Concurrent operations',
        'thread': 'Threading',
        'multiprocessing': 'Multiprocessing',

        # Database/Pickle
        'pickle': 'Pickle deserialization',
        'dill': 'Dill deserialization',
        'marshal': 'Marshal deserialization',
    }

    # Layer 2: Allowed mathematical functions (whitelist)
    ALLOWED_FUNCTIONS = {
        # Trigonometric
        'sin', 'cos', 'tan',
        'asin', 'acos', 'atan', 'atan2',
        'sinh', 'cosh', 'tanh',
        'asinh', 'acosh', 'atanh',
        'csc', 'sec', 'cot',

        # Logarithmic/Exponential
        'exp', 'log', 'log10', 'log2', 'sqrt',
        'ln',  # Natural logarithm

        # Algebraic
        'abs', 'sign', 'Abs',  # Both Python and SymPy versions
        'ceiling', 'floor', 'Ceiling', 'Floor',
        'Pow',  # SymPy power function

        # Special functions
        'gamma', 'Gamma',
        'erf', 'erfc',
        'factorial',  # Allowed but with checks
        'Factorial',

        # Constants
        'pi', 'Pi',
        'e', 'E', 'Exp1',
        'euler_gamma',
        'I',  # Imaginary unit

        # Hyperbolic/Inverse
        'atan2',
        'degrees', 'radians',

        # Complex numbers
        're', 'im',  # Real and imaginary parts
        'conjugate', 'arg', 'Abs',

        # Logical (for conditions)
        'Piecewise',  # For conditional logic
        'And', 'Or', 'Not',
        'Max', 'Min',

        # Differentiation/Integration (read-only, non-evaluated)
        # Note: We don't EXECUTE integration, just parse
    }

    # Functions we explicitly forbid (too dangerous even if in allowed set)
    FORBIDDEN_FUNCTIONS = {
        'integrate',  # Can hang
        'summation', 'Sum',  # Can be slow
        'product', 'Product',  # Can be slow
        'series',  # Power series expansion can be slow
        'solve',  # Equation solving can be slow
        'limit',  # Limit evaluation can be slow
        'diff',  # Differentiation (not needed for evaluation)
        'Derivative',
    }

    # Layer 3: Execution configuration
    DEFAULT_TIMEOUT_MS = 1000  # 1 second
    MAX_FORMULA_LENGTH = 10000  # 10 KB
    MAX_EXPRESSION_DEPTH = 100  # Nesting limit
    MAX_LARGE_NUMBER_DIGITS = 6  # Reject >999999

    def __init__(self, timeout_ms: int = DEFAULT_TIMEOUT_MS):
        """
        Initialize executor.

        Args:
            timeout_ms: Execution timeout in milliseconds
        """
        self.timeout_ms = timeout_ms
        self.expression_cache = {}  # Cache parsed expressions
        self.execution_count = 0

    def execute(
        self,
        formula: str,
        variables: dict[str, float],
        formula_id: str = "unknown"
    ) -> ExecutionResult:
        """
        Safely execute formula with given variables.

        Three-layer security model:
        1. Input validation (pattern detection)
        2. Operation whitelist (allowed functions only)
        3. Execution sandbox (timeout + error handling)

        Args:
            formula: SymPy-compatible formula string
            variables: Dictionary of {var_name: value}
            formula_id: Formula identifier (for logging)

        Returns:
            ExecutionResult with value, status, error details
        """
        start_time = time.time()

        try:
            # LAYER 1: Input Validation
            self._validate_input(formula)

            # LAYER 2: Parse and check allowed operations
            expr = self._parse_and_check(formula)

            # LAYER 3: Execute with timeout
            result = self._execute_with_timeout(expr, variables)

            duration_ms = (time.time() - start_time) * 1000

            self.execution_count += 1

            return ExecutionResult(
                status=ExecutionStatus.SUCCESS,
                value=float(result),
                duration_ms=duration_ms,
                formula=formula,
                variables_used=variables
            )

        except SecurityError as e:
            duration_ms = (time.time() - start_time) * 1000
            return ExecutionResult(
                status=ExecutionStatus.SECURITY_ERROR,
                error_code="SECURITY_VIOLATION",
                error_message="Formula evaluation blocked due to security policy",
                duration_ms=duration_ms,
                formula=None  # Don't echo formula back (security)
            )

        except TimeoutError:
            duration_ms = (time.time() - start_time) * 1000
            return ExecutionResult(
                status=ExecutionStatus.TIMEOUT,
                error_code="EXECUTION_TIMEOUT",
                error_message=f"Formula execution exceeded {self.timeout_ms}ms timeout",
                duration_ms=duration_ms
            )

        except InvalidFormulaError as e:
            duration_ms = (time.time() - start_time) * 1000
            return ExecutionResult(
                status=ExecutionStatus.INVALID_FORMULA,
                error_code="INVALID_FORMULA",
                error_message="Formula is not valid SymPy expression",
                duration_ms=duration_ms
            )

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            return ExecutionResult(
                status=ExecutionStatus.EXECUTION_ERROR,
                error_code="EXECUTION_ERROR",
                error_message="Formula evaluation failed during execution",
                duration_ms=duration_ms
            )

    def _validate_input(self, formula: str) -> None:
        """
        LAYER 1: Input validation using pattern detection.

        Checks:
        - String length (prevent DoS)
        - Forbidden patterns (code injection, reflection)
        - Number sizes (prevent resource exhaustion)

        Raises:
            SecurityError: If validation fails
        """
        # Check length
        if len(formula) > self.MAX_FORMULA_LENGTH:
            raise SecurityError(
                f"Formula too long ({len(formula)} > {self.MAX_FORMULA_LENGTH} bytes)"
            )

        if not formula or not formula.strip():
            raise SecurityError("Formula cannot be empty")

        # Check for forbidden patterns (case-insensitive)
        formula_lower = formula.lower()
        for pattern, description in self.FORBIDDEN_PATTERNS.items():
            if pattern in formula_lower:
                raise SecurityError(f"Forbidden pattern: {pattern} ({description})")

        # Check for suspiciously large numbers (>6 digits)
        large_numbers = re.findall(r'\d{' + str(self.MAX_LARGE_NUMBER_DIGITS + 1) + r',}', formula)
        if large_numbers:
            raise SecurityError(f"Suspiciously large numbers detected: {large_numbers[:3]}")

        # Check for scientific notation of huge numbers (e.g., 1e10000)
        huge_exponents = re.findall(r'\d+e[0-9]{4,}', formula, re.IGNORECASE)
        if huge_exponents:
            raise SecurityError(f"Suspiciously large exponents: {huge_exponents[:3]}")

        # Check for excessive parentheses nesting (indicates deep recursion)
        max_nesting = self._max_paren_depth(formula)
        if max_nesting > 50:
            raise SecurityError(f"Expression nesting too deep ({max_nesting} levels)")

    def _parse_and_check(self, formula: str) -> sp.Expr:
        """
        LAYER 2: Parse formula and check against whitelist.

        Checks:
        - Formula is valid SymPy expression
        - Only allowed functions are used
        - No forbidden functions
        - Expression tree not too deep

        Raises:
            InvalidFormulaError: If formula is invalid
            SecurityError: If forbidden operations detected
        """
        # Check cache first
        if formula in self.expression_cache:
            return self.expression_cache[formula]

        # Parse using SymPy (parse-only mode, no code execution)
        try:
            expr = sp.sympify(formula, transformations=sp.parse_expr)
        except Exception as e:
            raise InvalidFormulaError(f"Invalid SymPy expression: {str(e)}")

        # Check allowed functions only
        functions_used = {f.name for f in expr.atoms(sp.Function)}
        for func in functions_used:
            # Check if function is forbidden explicitly
            if func in self.FORBIDDEN_FUNCTIONS:
                raise SecurityError(f"Forbidden function: {func}")

            # Check if function is in allowed list
            if func not in self.ALLOWED_FUNCTIONS:
                raise SecurityError(f"Disallowed function: {func}")

        # Check expression tree depth
        depth = self._expression_depth(expr)
        if depth > self.MAX_EXPRESSION_DEPTH:
            raise SecurityError(f"Expression tree too deep ({depth} > {self.MAX_EXPRESSION_DEPTH})")

        # Cache and return
        self.expression_cache[formula] = expr
        return expr

    def _execute_with_timeout(
        self,
        expr: sp.Expr,
        variables: dict[str, float],
        timeout_ms: Optional[int] = None
    ) -> float:
        """
        LAYER 3: Execute formula with timeout sandbox.

        Uses threading-based timeout (cross-platform).

        Args:
            expr: Parsed SymPy expression
            variables: Variable values
            timeout_ms: Execution timeout (uses default if None)

        Returns:
            Floating point result

        Raises:
            TimeoutError: If execution exceeds timeout
        """
        import threading

        if timeout_ms is None:
            timeout_ms = self.timeout_ms

        result = [None]
        error = [None]

        def execute_formula():
            try:
                # Perform substitution and evaluation
                r = expr.subs(variables)

                # Convert to float (may raise if result is complex, symbolic, etc)
                if hasattr(r, 'evalf'):
                    r = float(r.evalf())
                else:
                    r = float(r)

                result[0] = r
            except Exception as e:
                error[0] = e

        # Run in thread with timeout
        thread = threading.Thread(target=execute_formula, daemon=True)
        thread.start()
        thread.join(timeout=timeout_ms / 1000.0)

        # Check if thread completed
        if thread.is_alive():
            raise TimeoutError(f"Formula execution exceeded {timeout_ms}ms")

        # Check for execution errors
        if error[0]:
            raise ExecutionError(str(error[0]))

        # Return result
        return result[0]

    def _max_paren_depth(self, s: str) -> int:
        """Calculate maximum parenthesis nesting depth."""
        max_depth = 0
        current_depth = 0
        for char in s:
            if char == '(':
                current_depth += 1
                max_depth = max(max_depth, current_depth)
            elif char == ')':
                current_depth -= 1
        return max_depth

    def _expression_depth(self, expr: sp.Expr) -> int:
        """Calculate SymPy expression tree depth."""
        if expr.is_leaf:
            return 1
        if not expr.args:
            return 1
        return 1 + max(self._expression_depth(arg) for arg in expr.args)

    def clear_cache(self):
        """Clear expression cache."""
        self.expression_cache.clear()

    def get_statistics(self) -> dict:
        """Get executor statistics."""
        return {
            "execution_count": self.execution_count,
            "cache_size": len(self.expression_cache),
            "timeout_ms": self.timeout_ms,
        }


# Custom Exceptions

class FormulaExecutionError(Exception):
    """Base exception for formula execution."""
    pass


class SecurityError(FormulaExecutionError):
    """Security violation in formula execution."""
    pass


class InvalidFormulaError(FormulaExecutionError):
    """Formula is syntactically invalid."""
    pass


class TimeoutError(FormulaExecutionError):
    """Formula execution exceeded timeout."""
    pass


class ExecutionError(FormulaExecutionError):
    """Error during formula execution."""
    pass
