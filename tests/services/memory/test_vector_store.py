import unittest
from unittest.mock import MagicMock, patch
import sys
import importlib

# Clean up any potential previous pollution if config.loader was mocked globally elsewhere
if 'config.loader' in sys.modules and isinstance(sys.modules['config.loader'], MagicMock):
    del sys.modules['config.loader']

class TestMemoryService(unittest.TestCase):
    def setUp(self):
        # Create mocks
        self.mock_chromadb = MagicMock()
        self.mock_ef = MagicMock()
        self.mock_config_loader = MagicMock()
        self.mock_logger = MagicMock()

        # Setup ConfigLoader mock behavior
        # The module is config.loader, it exports ConfigLoader class.
        self.mock_config_class = MagicMock()
        self.mock_config_class.get.return_value = "test_db_path"
        self.mock_config_loader.ConfigLoader = self.mock_config_class

        # Setup chromadb mock
        self.mock_client = MagicMock()
        # chromadb.PersistentClient() -> self.mock_client
        self.mock_chromadb.PersistentClient.return_value = self.mock_client
        self.mock_collection = MagicMock()
        self.mock_client.get_or_create_collection.return_value = self.mock_collection

        # Patch sys.modules
        self.modules_patcher = patch.dict(sys.modules, {
            'chromadb': self.mock_chromadb,
            'chromadb.utils': MagicMock(),
            'chromadb.utils.embedding_functions': self.mock_ef,
            'config.loader': self.mock_config_loader,
            'utils.logger': self.mock_logger,
        })
        self.modules_patcher.start()

        # Patch os.makedirs
        self.makedirs_patcher = patch('os.makedirs')
        self.makedirs_patcher.start()

        # Import MemoryService inside the patched environment
        # If it was already imported, reload it to pick up the mocks
        import services.memory.vector_store
        importlib.reload(services.memory.vector_store)

        self.MemoryService = services.memory.vector_store.MemoryService
        self.service = self.MemoryService()

    def tearDown(self):
        self.makedirs_patcher.stop()
        self.modules_patcher.stop()

        # Clean up the module from sys.modules to avoid pollution
        if 'services.memory.vector_store' in sys.modules:
            del sys.modules['services.memory.vector_store']

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

    def test_add_with_doc_id(self):
        # Test adding a memory with a specific doc_id
        self.service.add("test memory", doc_id="custom_id")

        self.mock_collection.add.assert_called_once()
        args, kwargs = self.mock_collection.add.call_args
        self.assertEqual(kwargs['ids'], ["custom_id"])

    def test_add_without_doc_id(self):
        # Test adding a memory without a doc_id (should generate one)
        with patch('uuid.uuid4', return_value="generated_uuid"):
            self.service.add("test memory")

        self.mock_collection.add.assert_called_once()
        args, kwargs = self.mock_collection.add.call_args
        self.assertEqual(kwargs['ids'], ["generated_uuid"])

    def test_add_default_metadata(self):
        # Test adding a memory without metadata (should use default)
        self.service.add("test memory")

        self.mock_collection.add.assert_called_once()
        args, kwargs = self.mock_collection.add.call_args
        self.assertEqual(kwargs['metadatas'], [{"type": "memory"}])

if __name__ == '__main__':
    unittest.main()
