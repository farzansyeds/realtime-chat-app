import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';

const BACKEND_URL = 'http://localhost:5000';
let socket;

const ROOMS = ['General', 'Development', 'Random'];

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [user, setUser] = useState(
    JSON.parse(localStorage.getItem('user')) || null
  );

  // Auth form state
  const [isLogin, setIsLogin] = useState(true);
  const [usernameInput, setUsernameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  // Chat state
  const [currentRoom, setCurrentRoom] = useState('General');
  const [messages, setMessages] = useState([]);
  const [textInput, setTextInput] = useState('');

  const messagesEndRef = useRef(null);

  // Initialize socket when authenticated
  useEffect(() => {
    if (!token) return;

    socket = io(BACKEND_URL);

    // Join default room
    socket.emit('join_room', currentRoom);

    // Initial message history
    socket.on('load_history', (history) => {
      setMessages(history);
    });

    // Real-time message listener
    socket.on('receive_message', (newMessage) => {
      setMessages((prev) => [...prev, newMessage]);
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  // Handle switching rooms
  const handleRoomChange = (room) => {
    if (room === currentRoom) return;
    setCurrentRoom(room);
    setMessages([]);
    socket.emit('join_room', room);
  };

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Authentication Handlers
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const payload = isLogin
      ? { email: emailInput, password: passwordInput }
      : { username: usernameInput, email: emailInput, password: passwordInput };

    try {
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Authentication failed');
      }

      // Persist auth
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    if (socket) socket.disconnect();
  };

  // Send message
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!textInput.trim() || !socket) return;

    socket.emit('send_message', {
      room: currentRoom,
      sender: user.username,
      text: textInput,
    });

    setTextInput('');
  };

  // Render Login / Register if unauthenticated
  if (!token) {
    return (
      <div className="auth-container">
        <h1 className="auth-title">Pulse Chat</h1>
        <p className="auth-subtitle">
          {isLogin ? 'Sign in to your account' : 'Create a new account'}
        </p>

        {authError && <div className="error-banner">{authError}</div>}

        <form onSubmit={handleAuthSubmit} className="auth-form">
          {!isLogin && (
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                required
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="johndoe"
              />
            </div>
          )}

          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              required
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="user@example.com"
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              required
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button type="submit" className="btn-primary">
            {isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="toggle-link">
          {isLogin ? (
            <>
              Don't have an account?{' '}
              <span onClick={() => { setIsLogin(false); setAuthError(''); }}>
                Register
              </span>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <span onClick={() => { setIsLogin(true); setAuthError(''); }}>
                Sign In
              </span>
            </>
          )}
        </div>
      </div>
    );
  }

  // Render Main Chat Application
  return (
    <div className="chat-app">
      {/* Left Sidebar */}
      <aside className="chat-sidebar">
        <div className="sidebar-header">
          <h2># Channels</h2>
        </div>
        <div className="rooms-list">
          {ROOMS.map((room) => (
            <div
              key={room}
              className={`room-item ${currentRoom === room ? 'active' : ''}`}
              onClick={() => handleRoomChange(room)}
            >
              # {room}
            </div>
          ))}
        </div>
        <div className="sidebar-footer">
          <div className="user-badge">@{user?.username}</div>
          <button onClick={handleLogout} className="btn-logout">
            Logout
          </button>
        </div>
      </aside>

      {/* Main Chat Interface */}
      <main className="chat-main">
        <header className="chat-header">
          <h3>#{currentRoom}</h3>
        </header>

        <div className="messages-viewport">
          {messages.map((msg, index) => {
            const isSelf = msg.sender === user?.username;
            return (
              <div
                key={msg._id || index}
                className={`message-bubble ${isSelf ? 'outgoing' : 'incoming'}`}
              >
                {!isSelf && <div className="message-sender">{msg.sender}</div>}
                <div className="message-text">{msg.text}</div>
                <div className="message-time">
                  {new Date(msg.createdAt || Date.now()).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSendMessage} className="message-form">
          <input
            type="text"
            className="message-input"
            placeholder={`Message #${currentRoom}`}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
          />
          <button type="submit" className="btn-send">
            Send
          </button>
        </form>
      </main>
    </div>
  );
}