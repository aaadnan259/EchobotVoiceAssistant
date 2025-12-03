import os
import pickle
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from typing import List, Tuple
from utils.logger import logger

class IntentClassifier:
    def __init__(self):
        self.model_path = "models/intent_model_v2.pkl"
        self.pipeline = None
        self.intents = []
        
        # Default training data
        self.training_data = [
            ("what is the weather", "weather"),
            ("how is the weather in London", "weather"),
            ("is it raining", "weather"),
            ("weather in Toledo", "weather"),
            ("what's the weather like in New York", "weather"),
            ("check weather for Paris", "weather"),
            ("current temperature in Tokyo", "weather"),
            ("forecast for tomorrow", "weather"),
            ("is it sunny outside", "weather"),
            ("do I need an umbrella", "weather"),
            ("search for python tutorials", "search"),
            ("google latest news", "search"),
            ("who is Elon Musk", "wikipedia"),
            ("tell me about quantum physics", "wikipedia"),
            ("set a reminder", "reminder_set"),
            ("remind me to buy milk", "reminder_set"),
            ("list my reminders", "reminder_list"),
            ("what time is it", "time"),
            ("what is the date", "date"),
            ("calculate 5 plus 5", "calculate"),
            ("what is 10 times 10", "calculate"),
            ("help me", "help"),
            ("what can you do", "help"),
            ("let's chat", "chat"),
            ("tell me a joke", "chat"),
            ("how are you", "chat"),
            ("good morning", "chat"),
        ]

    def train(self):
        """Train the intent classification model."""
        logger.info("Training intent classifier...")
        X, y = zip(*self.training_data)
        
        self.pipeline = Pipeline([
            ('tfidf', TfidfVectorizer(ngram_range=(1, 2), stop_words='english')),
            ('clf', LogisticRegression(random_state=42))
        ])
        
        self.pipeline.fit(X, y)
        self.intents = list(set(y))
        
        # Save model
        os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
        with open(self.model_path, 'wb') as f:
            pickle.dump(self.pipeline, f)
        logger.info("Model trained and saved.")

    def load(self):
        """Load the trained model."""
        if os.path.exists(self.model_path):
            with open(self.model_path, 'rb') as f:
                self.pipeline = pickle.load(f)
            logger.info("Intent model loaded.")
        else:
            logger.warning("No trained model found. Training new one.")
            self.train()

    def predict(self, text: str) -> Tuple[str, float]:
        """Predict the intent of the given text."""
        if not self.pipeline:
            self.load()
            
        probas = self.pipeline.predict_proba([text])[0]
        max_idx = np.argmax(probas)
        confidence = probas[max_idx]
        intent = self.pipeline.classes_[max_idx]
        
        logger.debug(f"Intent: {intent} ({confidence:.2f})")
        
        # Threshold for fallback to LLM/Chat
        if confidence < 0.35:
            return "chat", confidence
            
        return intent, confidence

    def add_data(self, text: str, intent: str):
        """Add new training data and retrain."""
        self.training_data.append((text, intent))
        self.train()
