document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chat-input');
    const chatForm = document.getElementById('chat-form');
    const chatMessages = document.getElementById('chat-messages');
    const sendBtn = document.getElementById('send-btn');
    const micBtn = document.getElementById('mic-btn');
    const micToggleBtn = document.getElementById('mic-toggle-btn');
    const statusText = document.getElementById('status-text');
    const avatarGlow = document.getElementById('avatar-glow');
    const pupils = document.querySelectorAll('.pupil');

    let isMicActive = false;
    let botState = 'idle'; // idle, listening, processing, happy

    // WebSocket Connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let socket;

    function connectWebSocket() {
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            console.log('Connected to EchoBot');
        };

        socket.onmessage = (event) => {
            const message = event.data;
            addMessage(message, 'bot');
            setBotState('happy');
            setTimeout(() => setBotState('idle'), 2000);
        };

        socket.onclose = () => {
            console.log('Disconnected. Retrying...');
            setTimeout(connectWebSocket, 3000);
        };
    }

    connectWebSocket();

    // UI State Management
    function setBotState(state) {
        botState = state;

        // Reset styles
        avatarGlow.style.transform = 'translate(-50%, -50%) scale(1)';
        avatarGlow.style.opacity = '0.3';

        pupils.forEach(pupil => {
            pupil.style.transform = 'scale(1)';
        });

        switch (state) {
            case 'idle':
                statusText.textContent = 'How can I assist you?';
                avatarGlow.style.background = 'radial-gradient(circle, rgba(168, 85, 247, 0.3) 0%, transparent 70%)';
                break;
            case 'listening':
                statusText.textContent = 'Listening...';
                avatarGlow.style.background = 'radial-gradient(circle, rgba(34, 211, 238, 0.4) 0%, transparent 70%)';
                avatarGlow.style.transform = 'translate(-50%, -50%) scale(1.2)';
                avatarGlow.style.opacity = '0.6';
                break;
            case 'processing':
                statusText.textContent = 'Thinking...';
                avatarGlow.style.background = 'radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 70%)';
                pupils.forEach(pupil => {
                    pupil.style.transform = 'scale(1.2) translateX(2px)'; // Simple animation
                });
                break;
            case 'happy':
                statusText.textContent = 'Got it!';
                avatarGlow.style.background = 'radial-gradient(circle, rgba(251, 191, 36, 0.3) 0%, transparent 70%)';
                pupils.forEach(pupil => {
                    pupil.style.transform = 'scale(1.3)';
                });
                break;
        }
    }

    // Chat Logic
    function addMessage(text, sender) {
        const div = document.createElement('div');
        div.className = `flex ${sender === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`;

        const bubble = document.createElement('div');
        bubble.className = `max-w-[70%] rounded-2xl px-6 py-4 ${sender === 'user'
                ? 'bg-[#6366f1] text-white shadow-lg shadow-indigo-500/20'
                : 'bg-white/5 backdrop-blur-sm text-white/90 border border-white/5'
            }`;

        const p = document.createElement('p');
        p.className = 'break-words';
        p.textContent = text;

        const time = document.createElement('p');
        time.className = `mt-2 text-sm ${sender === 'user' ? 'text-white/50' : 'text-white/30'}`;
        time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        bubble.appendChild(p);
        bubble.appendChild(time);
        div.appendChild(bubble);
        chatMessages.appendChild(div);

        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Event Listeners
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (text) {
            addMessage(text, 'user');
            socket.send(text);
            chatInput.value = '';
            setBotState('processing');
        }
    });

    // Mic Toggle
    function toggleMic() {
        isMicActive = !isMicActive;
        const icon = micBtn.querySelector('i');
        const toggleIcon = micToggleBtn.querySelector('i');

        if (isMicActive) {
            micBtn.classList.add('bg-indigo-500', 'shadow-indigo-500/40');
            micBtn.classList.remove('bg-white/10');
            icon.classList.remove('text-white/70');
            icon.classList.add('text-white');

            toggleIcon.className = 'fas fa-microphone text-white';

            setBotState('listening');
        } else {
            micBtn.classList.remove('bg-indigo-500', 'shadow-indigo-500/40');
            micBtn.classList.add('bg-white/10');
            icon.classList.add('text-white/70');
            icon.classList.remove('text-white');

            toggleIcon.className = 'fas fa-microphone-slash text-white/70';

            setBotState('idle');
        }
    }

    micBtn.addEventListener('click', toggleMic);
    micToggleBtn.addEventListener('click', toggleMic);

    // Simple idle animation for eyes
    setInterval(() => {
        if (botState === 'idle') {
            pupils.forEach(pupil => {
                pupil.style.height = '1px'; // Blink
                setTimeout(() => pupil.style.height = '12px', 150);
            });
        }
    }, 4000);
});
