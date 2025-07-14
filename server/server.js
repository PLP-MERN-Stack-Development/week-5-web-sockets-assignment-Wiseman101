// // server.js - Main server file for Socket.io chat application

// const express = require('express');
// const http = require('http');
// const { Server } = require('socket.io');
// const cors = require('cors');
// const dotenv = require('dotenv');
// const path = require('path');

// // Load environment variables
// dotenv.config();

// // Initialize Express app
// const app = express();
// const server = http.createServer(app);
// const io = new Server(server, {
//   cors: {
//     origin: process.env.CLIENT_URL || 'http://localhost:5173',
//     methods: ['GET', 'POST'],
//     credentials: true,
//   },
// });

// // Middleware
// app.use(cors());
// app.use(express.json());
// app.use(express.static(path.join(__dirname, 'public')));

// // Store connected users and messages
// const users = {};
// const messages = [];
// const typingUsers = {};

// // Socket.io connection handler
// io.on('connection', (socket) => {
//   console.log(`User connected: ${socket.id}`);

//   // Handle user joining
//   socket.on('user_join', (username) => {
//     users[socket.id] = { username, id: socket.id };
//     io.emit('user_list', Object.values(users));
//     io.emit('user_joined', { username, id: socket.id });
//     console.log(`${username} joined the chat`);
//   });

//   // Handle chat messages
//   socket.on('send_message', (messageData) => {
//     const message = {
//       ...messageData,
//       id: Date.now(),
//       sender: users[socket.id]?.username || 'Anonymous',
//       senderId: socket.id,
//       timestamp: new Date().toISOString(),
//     };
    
//     messages.push(message);
    
//     // Limit stored messages to prevent memory issues
//     if (messages.length > 100) {
//       messages.shift();
//     }
    
//     io.emit('receive_message', message);
//   });

//   // Handle typing indicator
//   socket.on('typing', (isTyping) => {
//     if (users[socket.id]) {
//       const username = users[socket.id].username;
      
//       if (isTyping) {
//         typingUsers[socket.id] = username;
//       } else {
//         delete typingUsers[socket.id];
//       }
      
//       io.emit('typing_users', Object.values(typingUsers));
//     }
//   });

//   // Handle private messages
//   socket.on('private_message', ({ to, message }) => {
//     const messageData = {
//       id: Date.now(),
//       sender: users[socket.id]?.username || 'Anonymous',
//       senderId: socket.id,
//       message,
//       timestamp: new Date().toISOString(),
//       isPrivate: true,
//     };
    
//     socket.to(to).emit('private_message', messageData);
//     socket.emit('private_message', messageData);
//   });

//   // Handle disconnection
//   socket.on('disconnect', () => {
//     if (users[socket.id]) {
//       const { username } = users[socket.id];
//       io.emit('user_left', { username, id: socket.id });
//       console.log(`${username} left the chat`);
//     }
    
//     delete users[socket.id];
//     delete typingUsers[socket.id];
    
//     io.emit('user_list', Object.values(users));
//     io.emit('typing_users', Object.values(typingUsers));
//   });
// });

// // API routes
// app.get('/api/messages', (req, res) => {
//   res.json(messages);
// });

// app.get('/api/users', (req, res) => {
//   res.json(Object.values(users));
// });

// // Root route
// app.get('/', (req, res) => {
//   res.send('Socket.io Chat Server is running');
// });

// // Start server
// const PORT = process.env.PORT || 5000;
// server.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });

// module.exports = { app, server, io }; 

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

const onlineUsers = new Map(); // socketId => username

io.on('connection', (socket) => {
  console.log('⚡ A user connected:', socket.id);

  socket.on('newUser', (username) => {
    socket.username = username;
    onlineUsers.set(socket.id, username);
    io.emit('updateUsers', Array.from(new Set(onlineUsers.values())));
  });

  socket.on('joinRoom', (room) => {
    socket.join(room);
    socket.currentRoom = room;
    socket.to(room).emit('message', {
      user: 'System',
      text: `${socket.username} joined ${room}`,
      time: new Date().toLocaleTimeString()
    });
  });

  socket.on('roomMessage', (data) => {
    if (socket.currentRoom) {
      io.to(socket.currentRoom).emit('message', data);
    }
  });

  socket.on('privateMessage', ({ to, ...message }) => {
    const recipientSocketId = [...onlineUsers.entries()].find(([id, name]) => name === to)?.[0];
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('privateMessage', { ...message, from: socket.username });
    }
  });

  socket.on('typing', (username) => {
    if (socket.currentRoom) {
      socket.to(socket.currentRoom).emit('typing', username);
    }
  });

  socket.on('stopTyping', () => {
    if (socket.currentRoom) {
      socket.to(socket.currentRoom).emit('stopTyping');
    }
  });

  socket.on('readMessage', ({ from }) => {
    const senderSocketId = [...onlineUsers.entries()].find(([id, name]) => name === from)?.[0];
    if (senderSocketId) {
      io.to(senderSocketId).emit('messageRead', {
        by: socket.username,
        time: new Date().toLocaleTimeString()
      });
    }
  });

  socket.on('reactToMessage', ({ id, emoji, room }) => {
    if (room) {
      io.to(room).emit('messageReaction', { id, emoji });
    }
  });

  socket.on('disconnect', () => {
    const name = onlineUsers.get(socket.id);
    onlineUsers.delete(socket.id);
    io.emit('updateUsers', Array.from(new Set(onlineUsers.values())));
    if (socket.currentRoom) {
      socket.to(socket.currentRoom).emit('message', {
        user: 'System',
        text: `${name} left ${socket.currentRoom}`,
        time: new Date().toLocaleTimeString()
      });
    }
    console.log('❌ Disconnected:', socket.id);
  });
});

app.get('/', (req, res) => {
  res.send('✅ Socket.io server running');
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
