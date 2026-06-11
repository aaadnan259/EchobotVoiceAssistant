import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock
from web.backend.app import ConnectionManager

@pytest.mark.asyncio
async def test_two_client_isolation():
    manager = ConnectionManager()
    ws1 = AsyncMock()
    ws1.client.host = "192.168.1.1"
    ws2 = AsyncMock()
    ws2.client.host = "192.168.1.2"
    
    await manager.connect(ws1)
    await manager.connect(ws2)
    
    assert len(manager.active_connections) == 2

@pytest.mark.asyncio
async def test_dead_socket_mid_send():
    manager = ConnectionManager()
    ws1 = AsyncMock()
    ws1.client.host = "1.1.1.1"
    ws1.send_text.side_effect = Exception("Dead socket")
    
    await manager.connect(ws1)
    assert len(manager.active_connections) == 1
    
    await manager.broadcast("test message")
    
    assert len(manager.active_connections) == 0

@pytest.mark.asyncio
async def test_idempotent_double_disconnect():
    manager = ConnectionManager()
    ws1 = AsyncMock()
    ws1.client.host = "2.2.2.2"
    
    await manager.connect(ws1)
    
    manager.disconnect(ws1)
    assert len(manager.active_connections) == 0
    
    manager.disconnect(ws1)
    assert len(manager.active_connections) == 0
