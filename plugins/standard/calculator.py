import re
import ast
import operator as op
from typing import Dict, Any
from services.plugin_manager import Plugin

class CalculatorPlugin(Plugin):
    name = "Calculator"
    description = "Performs basic arithmetic calculations."
    intents = ["calculate"]

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
