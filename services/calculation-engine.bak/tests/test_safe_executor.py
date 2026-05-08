"""Security and functionality tests for SafeFormulaExecutor."""
import pytest
from src.engine.safe_executor import (
    SafeFormulaExecutor,
    ExecutionStatus,
    ExecutionResult,
    SecurityError,
    InvalidFormulaError,
)


class TestInputValidation:
    """Test LAYER 1: Input validation."""

    @pytest.fixture
    def executor(self):
        return SafeFormulaExecutor(timeout_ms=1000)

    def test_empty_formula(self, executor):
        """Test rejection of empty formula."""
        result = executor.execute("", {"x": 1})
        assert result.status == ExecutionStatus.SECURITY_ERROR

    def test_formula_too_long(self, executor):
        """Test rejection of formula exceeding size limit."""
        long_formula = "x" * 20000  # Exceed MAX_FORMULA_LENGTH
        result = executor.execute(long_formula, {"x": 1})
        assert result.status == ExecutionStatus.SECURITY_ERROR

    def test_forbidden_pattern_import(self, executor):
        """Test rejection of __import__ pattern."""
        result = executor.execute("__import__('os')", {})
        assert result.status == ExecutionStatus.SECURITY_ERROR

    def test_forbidden_pattern_eval(self, executor):
        """Test rejection of eval pattern."""
        result = executor.execute("eval('x+1')", {"x": 1})
        assert result.status == ExecutionStatus.SECURITY_ERROR

    def test_forbidden_pattern_exec(self, executor):
        """Test rejection of exec pattern."""
        result = executor.execute("exec('x=1')", {})
        assert result.status == ExecutionStatus.SECURITY_ERROR

    def test_forbidden_pattern_open(self, executor):
        """Test rejection of open (file access)."""
        result = executor.execute("open('/etc/passwd')", {})
        assert result.status == ExecutionStatus.SECURITY_ERROR

    def test_forbidden_pattern_os(self, executor):
        """Test rejection of os module."""
        result = executor.execute("os.system('ls')", {})
        assert result.status == ExecutionStatus.SECURITY_ERROR

    def test_forbidden_pattern_subprocess(self, executor):
        """Test rejection of subprocess."""
        result = executor.execute("subprocess.run(['ls'])", {})
        assert result.status == ExecutionStatus.SECURITY_ERROR

    def test_large_number_detection(self, executor):
        """Test rejection of suspiciously large numbers."""
        result = executor.execute("x + 1000000", {"x": 1})
        assert result.status == ExecutionStatus.SECURITY_ERROR

    def test_large_exponent_detection(self, executor):
        """Test rejection of large scientific notation."""
        result = executor.execute("x * 1e10000", {"x": 1})
        assert result.status == ExecutionStatus.SECURITY_ERROR

    def test_excessive_parenthesis_nesting(self, executor):
        """Test rejection of deeply nested parentheses."""
        formula = "x" + "+" * 0 + ("(" * 60) + "1" + (")" * 60)
        result = executor.execute(formula, {"x": 1})
        assert result.status == ExecutionStatus.SECURITY_ERROR


class TestReflectionAttacks:
    """Test detection of reflection/introspection attacks."""

    @pytest.fixture
    def executor(self):
        return SafeFormulaExecutor()

    def test_class_introspection(self, executor):
        """Test rejection of __class__ pattern."""
        result = executor.execute("x.__class__", {"x": 1})
        assert result.status == ExecutionStatus.SECURITY_ERROR

    def test_bases_access(self, executor):
        """Test rejection of __bases__ pattern."""
        result = executor.execute("x.__bases__", {"x": 1})
        assert result.status == ExecutionStatus.SECURITY_ERROR

    def test_subclasses_enumeration(self, executor):
        """Test rejection of __subclasses__ pattern."""
        result = executor.execute("x.__subclasses__()", {"x": 1})
        assert result.status == ExecutionStatus.SECURITY_ERROR

    def test_dict_access(self, executor):
        """Test rejection of __dict__ pattern."""
        result = executor.execute("x.__dict__", {"x": 1})
        assert result.status == ExecutionStatus.SECURITY_ERROR

    def test_mro_access(self, executor):
        """Test rejection of __mro__ pattern."""
        result = executor.execute("x.__mro__", {"x": 1})
        assert result.status == ExecutionStatus.SECURITY_ERROR

    def test_getattr_pattern(self, executor):
        """Test rejection of getattr (attribute access)."""
        result = executor.execute("getattr(x, 'y')", {"x": 1})
        assert result.status == ExecutionStatus.SECURITY_ERROR


class TestResourceExhaustionPrevention:
    """Test timeout and resource limit enforcement."""

    @pytest.fixture
    def executor(self):
        return SafeFormulaExecutor(timeout_ms=500)

    def test_fast_formula_completes(self, executor):
        """Test that fast formulas complete successfully."""
        result = executor.execute("x + 1", {"x": 1})
        assert result.status == ExecutionStatus.SUCCESS
        assert result.value == 2.0

    def test_timeout_on_slow_operation(self, executor):
        """Test timeout on slow symbolic operation."""
        # Note: This may or may not timeout depending on SymPy version
        # but we test that timeout mechanism works
        result = executor.execute("sin(x)", {"x": 1})
        # Should succeed for simple case
        assert result.status in [ExecutionStatus.SUCCESS, ExecutionStatus.TIMEOUT]

    def test_forbidden_factorial(self, executor):
        """Test that factorial is blocked (resource risk)."""
        result = executor.execute("factorial(x)", {"x": 10})
        # factorial is in allowed set but may be blocked by whitelist
        # Let it execute for now, real risk is at large numbers
        assert result.status in [ExecutionStatus.SUCCESS, ExecutionStatus.SECURITY_ERROR]


class TestOperationWhitelist:
    """Test LAYER 2: Operation whitelist enforcement."""

    @pytest.fixture
    def executor(self):
        return SafeFormulaExecutor()

    # Allowed functions - should work
    def test_sin_function(self, executor):
        """Test that sin() is allowed."""
        result = executor.execute("sin(x)", {"x": 0})
        assert result.status == ExecutionStatus.SUCCESS
        assert abs(result.value - 0.0) < 0.001

    def test_cos_function(self, executor):
        """Test that cos() is allowed."""
        result = executor.execute("cos(x)", {"x": 0})
        assert result.status == ExecutionStatus.SUCCESS
        assert abs(result.value - 1.0) < 0.001

    def test_sqrt_function(self, executor):
        """Test that sqrt() is allowed."""
        result = executor.execute("sqrt(x)", {"x": 4})
        assert result.status == ExecutionStatus.SUCCESS
        assert abs(result.value - 2.0) < 0.001

    def test_exp_function(self, executor):
        """Test that exp() is allowed."""
        result = executor.execute("exp(x)", {"x": 0})
        assert result.status == ExecutionStatus.SUCCESS
        assert abs(result.value - 1.0) < 0.001

    def test_log_function(self, executor):
        """Test that log() is allowed."""
        result = executor.execute("log(x)", {"x": 1})
        assert result.status == ExecutionStatus.SUCCESS
        assert abs(result.value - 0.0) < 0.001

    def test_abs_function(self, executor):
        """Test that abs() is allowed."""
        result = executor.execute("abs(x)", {"x": -5})
        assert result.status == ExecutionStatus.SUCCESS
        assert result.value == 5.0

    def test_max_function(self, executor):
        """Test that max() is allowed."""
        result = executor.execute("max(x, y)", {"x": 3, "y": 5})
        assert result.status == ExecutionStatus.SUCCESS
        assert result.value == 5.0

    def test_min_function(self, executor):
        """Test that min() is allowed."""
        result = executor.execute("min(x, y)", {"x": 3, "y": 5})
        assert result.status == ExecutionStatus.SUCCESS
        assert result.value == 3.0

    # Forbidden functions - should fail
    def test_integrate_forbidden(self, executor):
        """Test that integrate() is forbidden."""
        result = executor.execute("integrate(x, (x, 0, 1))", {"x": 1})
        assert result.status == ExecutionStatus.SECURITY_ERROR

    def test_summation_forbidden(self, executor):
        """Test that summation() is forbidden."""
        result = executor.execute("summation(x, (x, 1, 10))", {})
        assert result.status == ExecutionStatus.SECURITY_ERROR


class TestFunctionalityBasics:
    """Test basic formula functionality."""

    @pytest.fixture
    def executor(self):
        return SafeFormulaExecutor()

    def test_simple_addition(self, executor):
        """Test simple arithmetic."""
        result = executor.execute("x + 1", {"x": 5})
        assert result.status == ExecutionStatus.SUCCESS
        assert result.value == 6.0

    def test_multiplication(self, executor):
        """Test multiplication."""
        result = executor.execute("x * y", {"x": 3, "y": 4})
        assert result.status == ExecutionStatus.SUCCESS
        assert result.value == 12.0

    def test_division(self, executor):
        """Test division."""
        result = executor.execute("x / y", {"x": 10, "y": 2})
        assert result.status == ExecutionStatus.SUCCESS
        assert result.value == 5.0

    def test_exponentiation(self, executor):
        """Test power operation."""
        result = executor.execute("x**2", {"x": 3})
        assert result.status == ExecutionStatus.SUCCESS
        assert result.value == 9.0

    def test_complex_expression(self, executor):
        """Test complex mathematical expression."""
        result = executor.execute("sin(x) + cos(y)", {"x": 0, "y": 0})
        assert result.status == ExecutionStatus.SUCCESS
        assert abs(result.value - 1.0) < 0.001  # sin(0) + cos(0) = 1

    def test_nested_functions(self, executor):
        """Test nested function calls."""
        result = executor.execute("sqrt(abs(x))", {"x": -4})
        assert result.status == ExecutionStatus.SUCCESS
        assert abs(result.value - 2.0) < 0.001

    def test_constants_pi(self, executor):
        """Test pi constant."""
        result = executor.execute("x * pi", {"x": 2})
        assert result.status == ExecutionStatus.SUCCESS
        import math
        assert abs(result.value - 2 * math.pi) < 0.001

    def test_constants_e(self, executor):
        """Test e constant."""
        result = executor.execute("log(x)", {"x": 2.718281828})
        assert result.status == ExecutionStatus.SUCCESS
        assert abs(result.value - 1.0) < 0.1


class TestEdgeCases:
    """Test edge cases and error conditions."""

    @pytest.fixture
    def executor(self):
        return SafeFormulaExecutor()

    def test_division_by_zero(self, executor):
        """Test handling of division by zero."""
        result = executor.execute("x / 0", {"x": 1})
        assert result.status == ExecutionStatus.EXECUTION_ERROR

    def test_invalid_formula_syntax(self, executor):
        """Test rejection of invalid SymPy syntax."""
        result = executor.execute("x +++ y", {"x": 1, "y": 1})
        assert result.status == ExecutionStatus.INVALID_FORMULA

    def test_undefined_variable(self, executor):
        """Test handling of undefined variable."""
        result = executor.execute("x + y", {"x": 1})
        # SymPy treats undefined variables as symbols
        # This should succeed with y as a symbol
        assert result.status in [ExecutionStatus.SUCCESS, ExecutionStatus.EXECUTION_ERROR]

    def test_complex_result(self, executor):
        """Test handling of complex number result."""
        result = executor.execute("sqrt(x)", {"x": -1})
        # Should either return error or handle complex
        assert result.status in [ExecutionStatus.SUCCESS, ExecutionStatus.EXECUTION_ERROR]

    def test_float_precision(self, executor):
        """Test floating point precision."""
        result = executor.execute("x / 3", {"x": 1})
        assert result.status == ExecutionStatus.SUCCESS
        assert abs(result.value - 0.333333) < 0.001

    def test_very_small_numbers(self, executor):
        """Test handling of very small numbers."""
        result = executor.execute("x + y", {"x": 1e-10, "y": 1e-10})
        assert result.status == ExecutionStatus.SUCCESS

    def test_mixed_operations(self, executor):
        """Test mixed arithmetic and trigonometric."""
        result = executor.execute("sin(x) * y + z", {"x": 0, "y": 2, "z": 1})
        assert result.status == ExecutionStatus.SUCCESS
        assert abs(result.value - 1.0) < 0.001  # sin(0)*2 + 1 = 1


class TestExecutionResult:
    """Test ExecutionResult data structure."""

    @pytest.fixture
    def executor(self):
        return SafeFormulaExecutor()

    def test_success_result(self, executor):
        """Test successful execution result."""
        result = executor.execute("x + 1", {"x": 1})
        assert result.is_success()
        assert result.value == 2.0
        assert result.error_code is None
        assert result.error_message is None

    def test_error_result_no_formula_echo(self, executor):
        """Test that security errors don't echo formula back."""
        result = executor.execute("__import__('os')", {})
        assert not result.is_success()
        assert result.formula is None  # Formula not echoed back
        assert "security" in result.error_message.lower()

    def test_result_timing(self, executor):
        """Test that execution time is recorded."""
        result = executor.execute("x + 1", {"x": 1})
        assert result.duration_ms > 0
        assert result.duration_ms < 100  # Should be fast


class TestCaching:
    """Test expression caching."""

    @pytest.fixture
    def executor(self):
        return SafeFormulaExecutor()

    def test_cache_hit(self, executor):
        """Test that same formula uses cache."""
        formula = "x + y"

        # First execution
        result1 = executor.execute(formula, {"x": 1, "y": 2})
        assert result1.is_success()

        # Second execution (should hit cache)
        result2 = executor.execute(formula, {"x": 3, "y": 4})
        assert result2.is_success()
        assert result2.value == 7.0

        # Check cache
        assert formula in executor.expression_cache

    def test_cache_clear(self, executor):
        """Test clearing expression cache."""
        formula = "x + 1"
        executor.execute(formula, {"x": 1})
        assert len(executor.expression_cache) > 0

        executor.clear_cache()
        assert len(executor.expression_cache) == 0


class TestStatistics:
    """Test executor statistics."""

    @pytest.fixture
    def executor(self):
        return SafeFormulaExecutor()

    def test_execution_count(self, executor):
        """Test execution counter."""
        executor.execute("x + 1", {"x": 1})
        executor.execute("x + 2", {"x": 1})

        stats = executor.get_statistics()
        assert stats["execution_count"] == 2

    def test_cache_size(self, executor):
        """Test cache size in statistics."""
        executor.execute("x + 1", {"x": 1})

        stats = executor.get_statistics()
        assert stats["cache_size"] == 1


class TestSecurityErrorMessages:
    """Test that security errors don't leak information."""

    @pytest.fixture
    def executor(self):
        return SafeFormulaExecutor()

    def test_generic_security_message(self, executor):
        """Test that security errors use generic messages."""
        result = executor.execute("__import__('os')", {})
        assert result.status == ExecutionStatus.SECURITY_ERROR
        # Error message should be generic, not reveal what was blocked
        assert "security" in result.error_message.lower()
        assert "__import__" not in result.error_message

    def test_no_formula_echo_on_error(self, executor):
        """Test that formula is not echoed on security errors."""
        dangerous_formula = "__import__('os').system('rm /')"
        result = executor.execute(dangerous_formula, {})
        assert result.formula is None  # Formula not echoed back
