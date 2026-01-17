# test_gemini.py
import os
import sys
from dotenv import load_dotenv
import google.generativeai as genai

# Add current directory to path so we can import config if needed, 
# but this script is standalone.
sys.path.append(os.getcwd())

load_dotenv()

def test_gemini():
    print("=== GEMINI CONNECTION TEST ===")
    
    # 1. Check API Key
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    
    if not api_key:
        print("❌ No API key found in Environment (GEMINI_API_KEY or GOOGLE_API_KEY)!")
        return False
    
    print(f"✓ API key found (length: {len(api_key)})")
    
    # 2. Configure Gemini
    try:
        genai.configure(api_key=api_key)
        print("✓ Gemini configured")
    except Exception as e:
        print(f"❌ Configuration failed: {e}")
        return False

    # 3. Test Model
    model_name = "gemini-2.0-flash"
    print(f"Testing model: {model_name}...")
    
    try:
        model = genai.GenerativeModel(model_name)
        response = model.generate_content("Say 'Hello, I am working!' and nothing else.")
        
        if response.text:
            print(f"✓ Response: {response.text}")
            return True
        else:
            print("❌ Response was empty!")
            return False
            
    except Exception as e:
        print(f"❌ Error during generation: {e}")
        return False

if __name__ == "__main__":
    success = test_gemini()
    sys.exit(0 if success else 1)
