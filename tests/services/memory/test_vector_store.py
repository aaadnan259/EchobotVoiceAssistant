import unittest
from unittest.mock import MagicMock, patch
import sys
import os

# Mock chromadb and other dependencies before importing MemoryService
mock_chromadb = MagicMock()
mock_ef = MagicMock()
sys.modules['chromadb'] = mock_chromadb
sys.modules['chromadb.utils'] = MagicMock()
sys.modules['chromadb.utils.embedding_functions'] = mock_ef

mock_config = MagicMock()
mock_config.get.return_value = "test_db_path"
sys.modules['config.loader'] = mock_config

sys.modules['utils.logger'] = MagicMock()

from services.memory.vector_store import MemoryService

class TestMemoryService(unittest.TestCase):
    def setUp(self):
        # Reset mocks for each test
        mock_chromadb.PersistentClient.reset_mock()

        self.mock_client = MagicMock()
        mock_chromadb.PersistentClient.return_value = self.mock_client
        self.mock_collection = MagicMock()
        self.mock_client.get_or_create_collection.return_value = self.mock_collection

        # Patch os.makedirs to avoid creating real directories
        with patch('os.makedirs'):
            self.service = MemoryService()

    def test_query_success(self):
        # Happy path: query returns documents
        self.mock_collection.query.return_value = {
            'documents': [['memory 1', 'memory 2']],
            'ids': [['id1', 'id2']],
            'metadatas': [[{'type': 'memory'}, {'type': 'memory'}]]
        }

        results = self.service.query("test query")
        self.assertEqual(results, ['memory 1', 'memory 2'])

    def test_query_empty_results_list(self):
        # Empty documents list returned
        self.mock_collection.query.return_value = {
            'documents': []
        }

        results = self.service.query("test query")
        self.assertEqual(results, [])

    def test_query_none_results(self):
        # Database returns None (unexpected but should be handled)
        self.mock_collection.query.return_value = None

        results = self.service.query("test query")
        self.assertEqual(results, [])

    def test_query_missing_documents_key(self):
        # Dictionary returned without 'documents' key
        self.mock_collection.query.return_value = {'ids': []}

        results = self.service.query("test query")
        self.assertEqual(results, [])

    def test_query_exception(self):
        # Database raises an exception
        self.mock_collection.query.side_effect = Exception("Connection failed")

        results = self.service.query("test query")
        self.assertEqual(results, [])

    def test_add_success(self):
        # Test adding a memory
        self.service.add("test memory", metadata={"key": "value"})

        self.mock_collection.add.assert_called_once()
        args, kwargs = self.mock_collection.add.call_args
        self.assertEqual(kwargs['documents'], ["test memory"])
        self.assertEqual(kwargs['metadatas'], [{"key": "value"}])

    def test_add_exception(self):
        # Test adding a memory when an exception occurs
        self.mock_collection.add.side_effect = Exception("Write failed")

        # Should not crash
        self.service.add("test memory")
        self.mock_collection.add.assert_called_once()

if __name__ == '__main__':
    unittest.main()
