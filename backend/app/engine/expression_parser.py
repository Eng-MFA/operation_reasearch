import ast
import operator
from typing import Dict, Any, Set, Tuple
import sympy

SAFE_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}

SAFE_FUNCTIONS = {
    "sqrt": sympy.sqrt,
    "exp": sympy.exp,
    "log": sympy.log,
    "ln": sympy.log,
    "sin": sympy.sin,
    "cos": sympy.cos,
    "tan": sympy.tan,
    "abs": sympy.Abs,
}

class SafeExpressionParser:
    """
    Safely parses user-supplied mathematical expressions into SymPy symbols/expressions
    and extracts linear coefficients or evaluates non-linear functions without using eval() or exec().
    """

    @classmethod
    def validate_and_parse(cls, expr_str: str) -> sympy.Expr:
        """Parse expression safely into a SymPy expression."""
        clean_str = expr_str.strip().replace("^", "**")
        try:
            tree = ast.parse(clean_str, mode='eval')
        except SyntaxError as e:
            raise ValueError(f"Invalid mathematical syntax: {str(e)}")

        cls._verify_ast_safety(tree.body)
        
        # Sympy parse_expr with standard transformations to preserve variables like x1, x2
        sympy_expr = sympy.parse_expr(
            clean_str,
            local_dict=SAFE_FUNCTIONS,
            transformations=sympy.parsing.sympy_parser.standard_transformations,
            evaluate=False
        )
        return sympy_expr

    @classmethod
    def _verify_ast_safety(cls, node: ast.AST):
        if isinstance(node, ast.Constant):
            return
        elif isinstance(node, ast.Name):
            # Valid variable identifier
            if node.id.startswith("__"):
                raise ValueError(f"Prohibited variable identifier: {node.id}")
            return
        elif isinstance(node, ast.UnaryOp):
            if type(node.op) not in SAFE_OPERATORS:
                raise ValueError(f"Unsupported unary operator: {type(node.op).__name__}")
            cls._verify_ast_safety(node.operand)
        elif isinstance(node, ast.BinOp):
            if type(node.op) not in SAFE_OPERATORS:
                raise ValueError(f"Unsupported binary operator: {type(node.op).__name__}")
            cls._verify_ast_safety(node.left)
            cls._verify_ast_safety(node.right)
        elif isinstance(node, ast.Call):
            if not isinstance(node.func, ast.Name) or node.func.id not in SAFE_FUNCTIONS:
                raise ValueError(f"Call to unauthorized function: {ast.dump(node.func)}")
            for arg in node.args:
                cls._verify_ast_safety(arg)
        else:
            raise ValueError(f"Disallowed syntax node: {type(node).__name__}")

    @classmethod
    def extract_linear_coefficients(
        cls, expr_str: str, variable_names: list[str]
    ) -> Tuple[Dict[str, float], float]:
        """
        Parses a linear expression and returns a dictionary of variable coefficients and constant term.
        Raises ValueError if the expression contains non-linear terms.
        """
        sympy_expr = cls.validate_and_parse(expr_str)
        expanded = sympy.expand(sympy_expr)

        symbol_map = {s.name: s for s in expanded.free_symbols}
        coeffs: Dict[str, float] = {}
        for var_name in variable_names:
            if var_name in symbol_map:
                var_sym = symbol_map[var_name]
                deg = sympy.degree(expanded, gen=var_sym)
                if deg > 1:
                    raise ValueError(f"Expression is non-linear in variable '{var_name}' (degree {deg}).")
                coeff = expanded.coeff(var_sym)
                try:
                    coeffs[var_name] = float(coeff)
                except Exception:
                    coeffs[var_name] = 0.0
            else:
                coeffs[var_name] = 0.0

        # Extract constant term by substituting all free symbols with 0
        subs_zeros = {s: 0 for s in expanded.free_symbols}
        const_val = expanded.subs(subs_zeros)
        constant = float(const_val) if const_val.is_number else 0.0
        return coeffs, constant
