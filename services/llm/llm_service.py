import google.generativeai as genai
import openai
from typing import List, Dict, Any, Optional
from config.loader import ConfigLoader
from utils.logger import logger

class MockMessage:
    def __init__(self, content: str, tool_calls: Optional[List] = None):
        self.content = content
        self.tool_calls = tool_calls

class LLMService:
    def __init__(self):
        self.provider = ConfigLoader.get("ai.provider", "openai")
        self.api_key = None
        self.model_name = ConfigLoader.get("ai.llm_model", "gpt-4o-mini")
        self.client = None
        
        if self.provider == "google":
            self.api_key = ConfigLoader.get("ai.google_api_key")
            if self.api_key:
                try:
                    genai.configure(api_key=self.api_key)
                    self.model = genai.GenerativeModel(self.model_name)
                    logger.info(f"Initialized Google Gemini with model: {self.model_name}")
                except Exception as e:
                    logger.error(f"Failed to initialize Google Gemini: {e}")
            else:
                logger.warning("Google API Key not found.")
        
        else:
            # Fallback to OpenAI or existing logic
            self.api_key = ConfigLoader.get("ai.openai_api_key")
            if self.api_key:
                self.client = openai.OpenAI(api_key=self.api_key)
            else:
                logger.warning("AI Provider is OpenAI but no API Key found.")

        # Initialize Memory
        try:
            from services.memory.vector_store import MemoryService
            self.memory_service = MemoryService()
            logger.info("MemoryService initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize MemoryService: {e}")
            self.memory_service = None

    def get_response(self, messages: List[Dict[str, str]], tools: List[Dict[str, Any]] = None) -> Any:
        """
        Get a response from the LLM, abstracting the provider.
        """
        if self.provider == "google":
            return self._get_google_response(messages, tools)
        else:
            return self._get_openai_response(messages, tools)

    def _get_google_response(self, messages: List[Dict[str, str]], tools: List[Dict[str, Any]] = None) -> Any:
        try:
            print(f"=== LLM SERVICE: _get_google_response ===")
            print(f"Model: {self.model_name}")
            
            # 1. Convert OpenAI messages to Gemini Contents
            gemini_contents = []
            system_instruction = None
            
            for msg in messages:
                role = msg.get("role")
                content = msg.get("content", "")
                
                if role == "system":
                    if system_instruction:
                        system_instruction += "\n" + content
                    else:
                        system_instruction = content
                
                elif role == "user":
                    gemini_contents.append({"role": "user", "parts": [content]})
                
                elif role == "assistant":
                    if msg.get("tool_calls"):
                        parts = []
                        for tc in msg.get("tool_calls"):
                             from google.ai.generativelanguage import FunctionCall
                             import json
                             
                             fn_name = ""
                             fn_args = {}
                             
                             if isinstance(tc, dict):
                                 fn_name = tc.get("function", {}).get("name")
                                 args_str = tc.get("function", {}).get("arguments", "{}")
                             else:
                                 fn_name = tc.function.name
                                 args_str = tc.function.arguments

                             try:
                                 fn_args = json.loads(args_str)
                             except:
                                 fn_args = {}

                             parts.append(FunctionCall(name=fn_name, args=fn_args))
                        
                        gemini_contents.append({"role": "model", "parts": parts})
                    else:
                        gemini_contents.append({"role": "model", "parts": [content]})
                
                elif role == "tool":
                    function_name = msg.get("name")
                    try:
                        import json
                        result_content = json.loads(content)
                    except:
                        result_content = content
                        
                    tool_response = {
                        "function_response": {
                            "name": function_name,
                            "response": {"result": result_content} 
                        }
                    }
                    gemini_contents.append({"role": "function", "parts": [tool_response]})

            # 2. Convert Tools
            gemini_tools = None
            if tools:
                gemini_tools = self._convert_tools_to_gemini(tools)

            # 3. Create Model
            # Ensure model name is correct (already fixed in init/settings)
            
            print(f"Instantiating GenerativeModel: {self.model_name}")
            model = genai.GenerativeModel(self.model_name, system_instruction=system_instruction)
            
            # 4. Generate Content
            print(f"Sending content to Gemini... ({len(gemini_contents)} parts)")
            response = model.generate_content(gemini_contents, tools=gemini_tools)
            
            print(f"Gemini response received. Parts: {len(response.parts) if response.parts else 0}")
            if response.text:
                 print(f"Response text start: {response.text[:50]}...")
            else:
                 print("Response text was empty/None")

            # 5. Parse Response
            return self._parse_gemini_response(response)

        except Exception as e:
            import sys
            import traceback
            print(f"ERROR in Gemini API call: {e}")
            traceback.print_exc()
            logger.error(f"Google Gemini Error: {e}", exc_info=True)
            return MockMessage("I'm having trouble thinking with Gemini right now.")

    def _convert_tools_to_gemini(self, openai_tools: List[Dict[str, Any]]) -> Any:
        # Convert OpenAI tool definitions to Gemini FunctionDeclarations
        gemini_tools = []
        for tool in openai_tools:
            if tool.get("type") == "function":
                f = tool.get("function", {})
                gemini_tools.append({
                    "name": f.get("name"),
                    "description": f.get("description"),
                    "parameters": self._convert_schema(f.get("parameters"))
                })
        return gemini_tools

    def _convert_schema(self, schema: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively convert OpenAI JSON schema types to Gemini compatible types (UPPERCASE)."""
        if not schema:
            return {}
        
        new_schema = schema.copy()
        
        # specific fix for 'type'
        if "type" in new_schema:
            val = new_schema["type"]
            if isinstance(val, str):
                new_schema["type"] = val.upper()
        
        # recurse for properties
        if "properties" in new_schema:
            new_props = {}
            for k, v in new_schema["properties"].items():
                new_props[k] = self._convert_schema(v)
            new_schema["properties"] = new_props
            
        # recurse for items (array)
        if "items" in new_schema:
            new_schema["items"] = self._convert_schema(new_schema["items"])
            
        return new_schema

    def _parse_gemini_response(self, response) -> MockMessage:
        # Check for function calls
        if response.parts:
            for part in response.parts:
                if fn := part.function_call:
                    # Found a function call
                    import json
                    import uuid
                    # Convert args to JSON string as OpenAI expects
                    # Gemini returns a Map/Dict for args
                    args = dict(fn.args)
                    
                    # Create a mock tool call object
                    class MockToolCall:
                        def __init__(self, id, name, args_str):
                            self.id = id
                            self.function = type('obj', (object,), {'name': name, 'arguments': args_str})
                            self.type = 'function'

                    tool_call = MockToolCall(
                        id=f"call_{uuid.uuid4().hex[:8]}",
                        name=fn.name,
                        args_str=json.dumps(args)
                    )
                    
                    return MockMessage(content=None, tool_calls=[tool_call])
        
        # Default to text
        return MockMessage(content=response.text, tool_calls=None)


    def _get_openai_response(self, messages: List[Dict[str, str]], tools: List[Dict[str, Any]] = None) -> Any:
        if not self.client:
            return MockMessage("I'm sorry, OpenAI is not connected.")

        try:
            params = {
                "model": self.model_name,
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": 150
            }
            if tools:
                params["tools"] = tools
                params["tool_choice"] = "auto"

            response = self.client.chat.completions.create(**params)
            return response.choices[0].message
        except Exception as e:
            logger.error(f"OpenAI Error: {e}", exc_info=True)
            return MockMessage(f"OpenAI Error: {str(e)}")

    def chat(self, user_input: str, context: List[Dict[str, str]] = None, tools: List[Dict[str, Any]] = None) -> Any:
        """Simple chat interface with Memory (RAG) and Tools."""
        if context is None:
            context = []
        
        # 1. Retrieve Memories (RAG)
        memory_context = ""
        if hasattr(self, 'memory_service') and self.memory_service:
            try:
                # Assuming query exists
                if hasattr(self.memory_service, 'query'):
                    # Use only latest relevant memories to keep context clean
                    relevant_memories = self.memory_service.query(user_input)
                    if relevant_memories:
                        memory_context = f"\n\nRelevant Past Memories:\n{relevant_memories}"
                        logger.info(f"Retrieved Memory: {relevant_memories[:50]}...")
            except Exception as e:
                logger.error(f"Memory Retrieval Error: {e}")

        # 2. Construct System Prompt (UPGRADED: Chain of Thought)
        system_prompt_content = (
            f"You are EchoBot. You have access to external tools. "
            f"Use them immediately when asked for real-time info. Do not ask for permission. "
            f"Think step-by-step before answering complex queries."
            f"{memory_context}"
        )

        messages = [
            {"role": "system", "content": system_prompt_content}
        ] + context + [
            {"role": "user", "content": user_input}
        ]
        
        logger.debug(f"Sending {len(messages)} messages to LLM")
        response_message = self.get_response(messages, tools)

        # Handle simplified string return or object
        if isinstance(response_message, str):
             # Backward compatibility or error
             return response_message, None
 
        # Check for tool_calls attribute (OpenAI/Mock)
        if hasattr(response_message, 'tool_calls') and response_message.tool_calls:
            logger.info(f"LLM requested {len(response_message.tool_calls)} tool calls")
            return None, response_message.tool_calls
        
        response_text = getattr(response_message, 'content', "No response")

        # 3. Store Interaction
        if hasattr(self, 'memory_service') and self.memory_service and response_text:
            try:
                if hasattr(self.memory_service, 'add'):
                    full_exchange = f"User: {user_input}\nAssistant: {response_text}"
                    self.memory_service.add(full_exchange)
            except Exception as e:
                logger.error(f"Memory Storage Error: {e}")
        
        return response_text, None
