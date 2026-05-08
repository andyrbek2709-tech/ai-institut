"""Formula execution graph engine for dependency resolution and execution planning."""
import networkx as nx
from typing import Any, Optional
from dataclasses import dataclass, field
from enum import Enum


class VariableCategory(str, Enum):
    """Variable classification in execution flow."""
    INPUT = "input"
    OUTPUT = "output"
    INTERMEDIATE = "intermediate"
    CONSTANT = "constant"


@dataclass
class FormulaNode:
    """Metadata for a single formula in the execution graph."""
    formula_id: str
    expression: str
    description: str
    depends_on: list[str] = field(default_factory=list)
    outputs: Optional[list[str]] = None  # Which variables this formula computes
    unit: Optional[str] = None
    engineering_meaning: Optional[str] = None


@dataclass
class ExecutionPlan:
    """Execution plan generated from dependency graph."""
    formula_order: list[str]  # Topological order of formula IDs
    dependencies: dict[str, set[str]]  # formula_id -> set of formula_ids it depends on
    dependents: dict[str, set[str]]  # formula_id -> set of formula_ids that depend on it
    required_inputs: set[str]  # All variable IDs needed as input
    intermediate_formulas: set[str]  # Formula IDs that produce intermediate results
    output_formulas: set[str]  # Formula IDs that produce final outputs
    is_executable: bool = True  # False if circular deps or other issues


@dataclass
class ExecutionTrace:
    """Trace of a single formula execution."""
    formula_id: str
    expression: str
    inputs_used: dict[str, Any]
    output: float
    unit: Optional[str] = None
    duration_ms: float = 0.0
    status: str = "success"
    error: Optional[str] = None


class FormulaExecutionGraph:
    """
    Manages formula dependency graph and execution planning.

    Responsibilities:
    - Build DAG from template formulas
    - Detect circular dependencies
    - Generate topological execution order
    - Track intermediate variables
    - Provide dependency introspection
    """

    def __init__(self, template_dict: dict):
        """
        Initialize execution graph from template.

        Args:
            template_dict: Parsed YAML template with:
                - metadata: template info
                - variables: {var_id: {category, label, description, ...}}
                - formulas: {formula_id: {expression, depends_on, description, ...}}

        Raises:
            ValueError: If template structure is invalid
        """
        self.template_dict = template_dict
        self.metadata = template_dict.get("metadata", {})
        self.variables = template_dict.get("variables", {})
        self.formulas = template_dict.get("formulas", {})

        # Build internal structures
        self.graph = nx.DiGraph()  # Directed acyclic graph
        self.formula_nodes = {}  # formula_id -> FormulaNode
        self.execution_plan: Optional[ExecutionPlan] = None
        self.execution_traces: dict[str, ExecutionTrace] = {}

        # Build the graph
        self._build_graph()

    def _build_graph(self):
        """Build NetworkX directed graph from formulas."""
        # Create nodes for each formula
        for formula_id, formula_def in self.formulas.items():
            node = FormulaNode(
                formula_id=formula_id,
                expression=formula_def.get("expression", ""),
                description=formula_def.get("description", ""),
                depends_on=formula_def.get("depends_on", []),
                outputs=formula_def.get("outputs"),  # Which variables this produces
                unit=formula_def.get("unit"),
                engineering_meaning=formula_def.get("engineering_meaning")
            )
            self.formula_nodes[formula_id] = node
            self.graph.add_node(formula_id)

        # Create edges for formula-to-formula dependencies
        # Formula A depends on formula B if A's depends_on includes
        # a variable that B produces
        for formula_id, node in self.formula_nodes.items():
            depends_on_vars = set(node.depends_on)

            # Check which other formulas produce these variables
            for other_formula_id, other_node in self.formula_nodes.items():
                if formula_id == other_formula_id:
                    continue

                other_outputs = set(other_node.outputs or [])
                if other_outputs & depends_on_vars:
                    # other_formula_id produces variables that formula_id depends on
                    self.graph.add_edge(other_formula_id, formula_id)

    def is_executable(self) -> bool:
        """Check if graph is acyclic (executable)."""
        return nx.is_directed_acyclic_graph(self.graph)

    def get_cycles(self) -> list[list[str]]:
        """
        Find all circular dependencies.

        Returns:
            List of cycles (each cycle is a list of formula IDs)
        """
        if self.is_executable():
            return []

        try:
            cycles = list(nx.simple_cycles(self.graph))
            return cycles
        except:
            return []

    def get_execution_order(self) -> list[str]:
        """
        Get topological sort order for formula execution.

        Returns:
            List of formula IDs in execution order

        Raises:
            ValueError: If graph contains cycles
        """
        if not self.is_executable():
            cycles = self.get_cycles()
            raise ValueError(
                f"Cannot generate execution order: circular dependencies detected. "
                f"Cycles: {cycles}"
            )

        return list(nx.topological_sort(self.graph))

    def plan_execution(self) -> ExecutionPlan:
        """
        Generate execution plan.

        Returns:
            ExecutionPlan with formula order and dependency info
        """
        if self.execution_plan:
            return self.execution_plan

        # Check executability
        is_executable = self.is_executable()

        formula_order = []
        if is_executable:
            try:
                formula_order = self.get_execution_order()
            except ValueError:
                is_executable = False

        # Build dependency maps
        dependencies = {}
        dependents = {}

        for formula_id in self.formula_nodes:
            # Direct predecessors (formulas that must execute before this one)
            dependencies[formula_id] = set(self.graph.predecessors(formula_id))
            # Direct successors (formulas that depend on this one)
            dependents[formula_id] = set(self.graph.successors(formula_id))

        # Identify intermediate vs output formulas
        intermediate_formulas = set()
        output_formulas = set()

        for formula_id, node in self.formula_nodes.items():
            outputs = node.outputs or []

            # Check if any output variables have category "intermediate" or "output"
            for output_var in outputs:
                if output_var in self.variables:
                    var_def = self.variables[output_var]
                    category = var_def.get("category", "intermediate")

                    if category == "intermediate":
                        intermediate_formulas.add(formula_id)
                    elif category == "output":
                        output_formulas.add(formula_id)

        # Collect all required input variables
        required_inputs = set()
        for formula_id, node in self.formula_nodes.items():
            for var_id in node.depends_on:
                # Check if this var is an input (not computed by another formula)
                is_computed = any(
                    f_node.outputs and var_id in f_node.outputs
                    for f_node in self.formula_nodes.values()
                )

                if not is_computed:
                    # This variable must come from inputs
                    required_inputs.add(var_id)

        self.execution_plan = ExecutionPlan(
            formula_order=formula_order,
            dependencies=dependencies,
            dependents=dependents,
            required_inputs=required_inputs,
            intermediate_formulas=intermediate_formulas,
            output_formulas=output_formulas,
            is_executable=is_executable
        )

        return self.execution_plan

    def get_dependencies(self, formula_id: str) -> set[str]:
        """
        Get all formulas that formula_id depends on (directly and indirectly).

        Args:
            formula_id: Formula to analyze

        Returns:
            Set of formula IDs
        """
        if formula_id not in self.graph:
            return set()

        # Use transitive closure to get all ancestors
        ancestors = nx.ancestors(self.graph, formula_id)
        return ancestors

    def get_dependents(self, formula_id: str) -> set[str]:
        """
        Get all formulas that depend on formula_id (directly and indirectly).

        Args:
            formula_id: Formula to analyze

        Returns:
            Set of formula IDs
        """
        if formula_id not in self.graph:
            return set()

        # Use transitive closure to get all descendants
        descendants = nx.descendants(self.graph, formula_id)
        return descendants

    def get_required_for_output(self, output_var_ids: Optional[list[str]] = None) -> set[str]:
        """
        Get all formulas required to compute given output variables.

        This implements lazy evaluation: only formulas needed to compute
        the specified outputs are included.

        Args:
            output_var_ids: List of variable IDs to compute. If None, compute all outputs.

        Returns:
            Set of formula IDs needed for outputs
        """
        if output_var_ids is None:
            # Use all output variables
            output_var_ids = [
                vid for vid, vdef in self.variables.items()
                if vdef.get("category") == "output"
            ]

        required_formulas = set()

        for output_var in output_var_ids:
            # Find formula(s) that produce this variable
            for formula_id, node in self.formula_nodes.items():
                if node.outputs and output_var in node.outputs:
                    # Include this formula and all its dependencies
                    required_formulas.add(formula_id)
                    required_formulas.update(self.get_dependencies(formula_id))

        return required_formulas

    def visualize_mermaid(self) -> str:
        """
        Generate Mermaid diagram of execution graph.

        Returns:
            Mermaid graph definition string
        """
        lines = ["graph TD"]

        for formula_id, node in self.formula_nodes.items():
            # Node definition with label
            label = f"{formula_id}<br/>{node.description[:30]}..."
            lines.append(f'    {formula_id}["{label}"]')

        for formula_id in self.formula_nodes:
            for dependent in self.graph.successors(formula_id):
                lines.append(f"    {formula_id} --> {dependent}")

        return "\n".join(lines)

    def get_statistics(self) -> dict[str, Any]:
        """
        Get graph statistics.

        Returns:
            Dictionary with graph metrics
        """
        plan = self.plan_execution()

        return {
            "total_formulas": len(self.formula_nodes),
            "is_executable": plan.is_executable,
            "num_cycles": len(self.get_cycles()) if not plan.is_executable else 0,
            "num_inputs": len(plan.required_inputs),
            "num_intermediate": len(plan.intermediate_formulas),
            "num_outputs": len(plan.output_formulas),
            "max_depth": self._compute_max_depth(),
            "avg_branching_factor": self._compute_avg_branching_factor(),
        }

    def _compute_max_depth(self) -> int:
        """Compute maximum depth of dependency chain."""
        if not self.is_executable():
            return -1

        max_length = 0
        for formula_id in self.formula_nodes:
            depth = len(nx.ancestors(self.graph, formula_id))
            max_length = max(max_length, depth)

        return max_length

    def _compute_avg_branching_factor(self) -> float:
        """Compute average number of dependents per formula."""
        if not self.formula_nodes:
            return 0.0

        total_dependents = sum(
            len(list(self.graph.successors(fid)))
            for fid in self.formula_nodes
        )

        return total_dependents / len(self.formula_nodes)

    def add_trace(self, formula_id: str, trace: ExecutionTrace):
        """Record execution trace for a formula."""
        self.execution_traces[formula_id] = trace

    def get_trace(self, formula_id: str) -> Optional[ExecutionTrace]:
        """Retrieve execution trace for a formula."""
        return self.execution_traces.get(formula_id)

    def get_all_traces(self) -> list[ExecutionTrace]:
        """Get all execution traces in execution order."""
        plan = self.plan_execution()
        traces = []

        for formula_id in plan.formula_order:
            if formula_id in self.execution_traces:
                traces.append(self.execution_traces[formula_id])

        return traces

    def clear_traces(self):
        """Clear all execution traces."""
        self.execution_traces.clear()
