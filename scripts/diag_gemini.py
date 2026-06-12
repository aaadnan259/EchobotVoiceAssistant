import os
import sys
from google import genai
from google.genai import types

def main():
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("ERROR: GOOGLE_API_KEY environment variable is not set.")
        sys.exit(1)

    print("Initializing Gemini Client...")
    try:
        client = genai.Client(api_key=api_key)
    except Exception as e:
        print(f"Failed to initialize client: {e}")
        sys.exit(1)

    print("Checking model availability for 'gemini-2.5-flash'...")
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents="Say 'Diagnostic successful: gemini-2.5-flash is available.' exactly as written."
        )
        print(f"\nResponse: {response.text}")
    except Exception as e:
        print(f"\nModel check failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
