const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const PORT = process.env.PORT || 3001;

io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('join-room', async (roomId, userId) => {
    socket.join(roomId);
    socket.to(roomId).emit('user-connected', userId);

    try {
      const { data, error } = await supabase
        .from('game_session_players')
        .insert([{ session_id: roomId, user_id: userId, is_ready: false }]);
      if (error) throw error;
    } catch (error) {
      console.error('Error joining room:', error);
    }

    socket.on('disconnect', async () => {
      socket.to(roomId).emit('user-disconnected', userId);
      try {
        const { data, error } = await supabase
          .from('game_session_players')
          .delete()
          .match({ session_id: roomId, user_id: userId });
        if (error) throw error;
      } catch (error) {
        console.error('Error leaving room:', error);
      }
    });
  });

  socket.on('start-game', async (roomId) => {
    try {
      const { data, error } = await supabase
        .from('game_sessions')
        .update({ status: 'in_progress' })
        .match({ id: roomId });
      if (error) throw error;
      io.to(roomId).emit('game-started');
    } catch (error) {
      console.error('Error starting game:', error);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
