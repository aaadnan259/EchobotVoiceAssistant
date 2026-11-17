import re
import ast
import operator as op
from typing import Dict, Any
from services.plugin_manager import Plugin

MAX_RESULT_BITS = 10_000  # ~3,000 decimal digits; keeps ** and * chains cheap
_STRICT_ALLOWED = re.compile(r"[0-9+\-*/().\s]+")


class CalculatorPlugin(Plugin):
    name = "Calculator"
    description = "Performs basic arithmetic calculations."
    intents = ["calculate"]

    def evaluate_strict(self, expression: str) -> str:
        """Evaluate an arithmetic expression, rejecting anything unsupported.

        Unlike handle(), which strips unknown characters (so "sqrt(16)" silently
        becomes "(16)" and returns 16), this raises ValueError with a message that
        is safe to show to a model or user."""
        expr = (expression or "").strip()
        if not expr:
            raise ValueError("Expression is empty.")
        if not _STRICT_ALLOWED.fullmatch(expr):
            raise ValueError(
                "Unsupported characters in expression. Only digits, + - * / ( ) and . "
                "are allowed; functions such as sqrt are not supported."
            )
        try:
            result = self._safe_eval(expr)
        except ZeroDivisionError:
            raise ValueError("Division by zero.")
        except OverflowError:
            raise ValueError("Result is too large.")
        except ValueError:
            raise
        except (SyntaxError, TypeError, KeyError, RecursionError):
            raise ValueError("Not a valid arithmetic expression.")

        if isinstance(result, complex):
            raise ValueError("Result is not a real number.")
        if isinstance(result, int) and result.bit_length() > MAX_RESULT_BITS:
            raise ValueError("Result is too large.")
        if isinstance(result, float):
            if result != result or result in (float("inf"), float("-inf")):
                raise ValueError("Result is not a finite number.")
            value = f"{result:.12g}"
        else:
            value = str(result)
        return f"{expr} = {value}"

    def _safe_eval(self, expr: str) -> Any:
        """
        Safely evaluate a mathematical expression using AST.
        """
        operators = {
            ast.Add: op.add,
            ast.Sub: op.sub,
            ast.Mult: op.mul,
            ast.Div: op.truediv,
            ast.Pow: op.pow,
            ast.USub: op.neg,
            ast.UAdd: op.pos,
        }

        def _eval(node):
            if isinstance(node, ast.Constant):
                if not isinstance(node.value, (int, float)):
                    raise TypeError(f"Unsupported constant type: {type(node.value)}")
                return node.value
            elif isinstance(node, ast.BinOp):
                left = _eval(node.left)
                right = _eval(node.right)
                if isinstance(node.op, ast.Pow):
                    if right > 1000:
                        raise ValueError("Exponent too large for safety")
                    # Nested powers like (9**999)**999 pass the exponent check on
                    # every level but grow without bound; cap the size up front.
                    if (
                        isinstance(left, int) and isinstance(right, int)
                        and right > 0 and left.bit_length() * right > MAX_RESULT_BITS
                    ):
                        raise ValueError("Result is too large.")
                return operators[type(node.op)](left, right)
            elif isinstance(node, ast.UnaryOp):
                return operators[type(node.op)](_eval(node.operand))
            else:
                raise TypeError(f"Unsupported node type: {type(node)}")

        try:
            tree = ast.parse(expr, mode='eval')
            return _eval(tree.body)
        except Exception:
            raise

    def handle(self, intent: str, entities: Dict[str, Any], context: Dict[str, Any]) -> str:
        expression = entities.get("expression")
        if not expression:
            return "What would you like me to calculate?"
        
        # Security: Allow only digits and math operators
        cleaned_expr = re.sub(r'[^0-9+\-*/().]', '', expression)
        
        try:
            # Using safe AST evaluation instead of eval()
            result = self._safe_eval(cleaned_expr)
            return f"The answer is {result}."
        except Exception:
            return "Sorry, I couldn't calculate that."
