const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const Message = require('./models/Message');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Express middleware
app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);

// Socket.io configuration
const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Join a specific chat room
  socket.on('join_room', async (roomName) => {
    socket.join(roomName);
    console.log(`User ${socket.id} joined room: ${roomName}`);

    // Load last 50 messages for this room
    try {
      const messages = await Message.find({ room: roomName })
        .sort({ createdAt: 1 })
        .limit(50);
      socket.emit('load_history', messages);
    } catch (err) {
      console.error('Failed to load room messages:', err);
    }
  });

  // Handle outgoing messages
  socket.on('send_message', async (data) => {
    const { room, sender, text } = data;

    if (!text || !text.trim()) return;

    try {
      const newMessage = new Message({
        room,
        sender,
        text: text.trim(),
      });

      await newMessage.save();

      // Emit to everybody in that room (including sender)
      io.to(room).emit('receive_message', newMessage);
    } catch (err) {
      console.error('Failed to save message:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Database connection & Server initialization
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/chatapp';

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB successfully connected.');
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });