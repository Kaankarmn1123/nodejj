require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL and Anon Key must be provided in environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Geliştirme için, daha sonra kısıtlanmalı
  },
});

io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('joinRoom', ({ roomId, user }) => {
    socket.join(roomId);
    console.log(`user ${user.name} joined room ${roomId}`);
    
    // Send success response to the joining user
    socket.emit('joinRoomSuccess', { roomId, players: [{ id: user.id, name: user.name, score: 0 }] });
    
    // Notify other users in the room
    socket.to(roomId).emit('user-joined', user);

    socket.on('drawing', (data) => {
      socket.to(roomId).emit('drawing', data);
    });

    socket.on('guess', (guess) => {
      io.to(roomId).emit('guess', { ...guess, user });
      
      // Simple guess validation - in a real game you'd have proper prompts/answers
      const isCorrect = Math.random() > 0.7; // 30% chance of being correct for demo
      if (isCorrect) {
        socket.emit('guessResult', { correct: true, points: 10 });
        // Update player score and broadcast updated players list
        socket.to(roomId).emit('playersUpdate', { 
          players: [{ id: user.id, name: user.name, score: 10 }] 
        });
      } else {
        socket.emit('guessResult', { correct: false, points: 0 });
      }
    });

    socket.on('saveRound', async (roundData) => {
      try {
        const { data, error } = await supabase
          .from('game_rounds')
          .insert([{ ...roundData, session_id: roomId }]);

        if (error) {
          console.error('Error saving round:', error);
          socket.emit('saveRoundError', { message: 'Failed to save round.' });
        } else {
          console.log('Round saved successfully:', data);
          socket.emit('saveRoundSuccess', { message: 'Round saved successfully.' });
        }
      } catch (err) {
        console.error('Unexpected error saving round:', err);
        socket.emit('saveRoundError', { message: 'An unexpected error occurred.' });
      }
    });

    socket.on('clearCanvas', ({ roomId }) => {
      console.log(`Canvas cleared in room ${roomId} by user ${user.name}`);
      // Broadcast clear event to all other users in the room
      socket.to(roomId).emit('canvasCleared');
    });

    socket.on('disconnect', () => {
      console.log(`user ${user.name} disconnected from room ${roomId}`);
      io.to(roomId).emit('user-left', user);
    });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});