from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

class LLMProvider(ABC):
    """Abstract base class for LLM providers."""
    
    @abstractmethod
    def generate_response(self, messages: List[Dict[str, str]], tools: List[Dict[str, Any]] = None) -> Any:
        """
        Generate a non-streaming response.
        
        Args:
            messages: List of message dicts (role, content)
            tools: Optional list of tool definitions
            
        Returns:
            Provider-specific response object or simplified content
        """
        pass

    @abstractmethod
    def generate_stream(self, messages: List[Dict[str, str]], system_instruction: str) -> Any:
        """
        Generate a streaming response generator.
        
        Args:
            messages: List of message dicts
            system_instruction: System prompt
            
        Returns:
            Generator yielding chunks
        """
        pass
