const roomService = require('../services/roomService');

// Store active connections
const activeConnections = new Map(); // roomCode -> { doctor: socketId, patient: socketId, lastActivity: timestamp }

const initializeSignaling = (io) => {
  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.id}`);

    // Doctor creates a room
    socket.on('create-room', async ({ roomCode, password }, callback) => {
      try {
        const room = await roomService.createRoom(
          socket.user.userId,
          password,
          2
        );

        socket.join(room.room_code);
        socket.roomCode = room.room_code;

        // Track connection
        activeConnections.set(room.room_code, {
          doctor: socket.id,
          patient: null,
          lastActivity: Date.now(),
          roomId: room.id,
        });

        callback({ success: true, room });
        
        // Broadcast updated room list
        const activeRooms = await roomService.getActiveRooms();
        io.emit('rooms-updated', activeRooms);

        console.log(`🏥 Room created: ${room.room_code} by ${socket.user.userId}`);
      } catch (error) {
        callback({ success: false, error: error.message });
      }
    });

    // Get active rooms
    socket.on('get-rooms', async (callback) => {
      try {
        const rooms = await roomService.getActiveRooms();
        callback({ success: true, rooms });
      } catch (error) {
        callback({ success: false, error: error.message });
      }
    });

    // Patient joins room
    socket.on('join-room', async ({ roomCode, password }, callback) => {
      try {
        // If password is 'already-verified', skip password check
        // (HTTP endpoint already verified it)
        if (password !== 'already-verified') {
          const result = await roomService.verifyRoomPassword(roomCode, password);

          if (!result.success) {
            return callback({ success: false, error: result.error });
          }
          
          socket.join(roomCode);
          socket.roomCode = roomCode;
          
          const connection = activeConnections.get(roomCode);
          if (connection) {
            connection.patient = socket.id;
            connection.lastActivity = Date.now();
          }

          await roomService.updateRoomStatus(result.roomId, 'active');
        } else {
          // Already verified via HTTP - just join
          const room = await roomService.getRoomByCode(roomCode);
          
          if (!room) {
            return callback({ success: false, error: 'Room not found' });
          }

          socket.join(roomCode);
          socket.roomCode = roomCode;

          const connection = activeConnections.get(roomCode);
          if (connection) {
            connection.patient = socket.id;
            connection.lastActivity = Date.now();
          }

          await roomService.updateRoomStatus(room.id, 'active');
        }

        // Notify doctor that patient joined
        socket.to(roomCode).emit('participant-joined', {
          peerId: socket.id,
          userId: socket.user?.userId,
        });

        callback({ success: true, roomId: socket.roomCode });

        console.log(`👤 Patient ${socket.id} joined room: ${roomCode}`);
      } catch (error) {
        console.error('Join room socket error:', error);
        callback({ success: false, error: error.message });
      }
    });

    // WebRTC Signaling: Offer
    socket.on('offer', ({ roomCode, offer }) => {
      console.log(`📤 Sending offer to room: ${roomCode}`);
      updateActivity(roomCode);
      socket.to(roomCode).emit('offer', {
        offer,
        senderId: socket.id,
      });
    });

    // WebRTC Signaling: Answer
    socket.on('answer', ({ roomCode, answer }) => {
      console.log(`📥 Sending answer to room: ${roomCode}`);
      updateActivity(roomCode);
      socket.to(roomCode).emit('answer', {
        answer,
        senderId: socket.id,
      });
    });

    // WebRTC Signaling: ICE Candidate
    socket.on('ice-candidate', ({ roomCode, candidate }) => {
      updateActivity(roomCode);
      socket.to(roomCode).emit('ice-candidate', {
        candidate,
        senderId: socket.id,
      });
    });

    // End call
    socket.on('end-call', async () => {
      if (socket.roomCode) {
        const room = await roomService.getRoomByCode(socket.roomCode);
        
        if (room) {
          await roomService.updateRoomStatus(room.id, 'ended');
        }

        socket.to(socket.roomCode).emit('call-ended');
        
        // Clean up connection
        activeConnections.delete(socket.roomCode);
        
        console.log(`📞 Call ended in room: ${socket.roomCode}`);

        // Update room list
        const activeRooms = await roomService.getActiveRooms();
        io.emit('rooms-updated', activeRooms);
      }
    });

    // Disconnect
    socket.on('disconnect', async () => {
      if (socket.roomCode) {
        socket.to(socket.roomCode).emit('participant-left', {
          peerId: socket.id,
        });

        // Schedule cleanup after 2 minutes
        const connection = activeConnections.get(socket.roomCode);
        if (connection) {
          setTimeout(async () => {
            const stillActive = activeConnections.get(socket.roomCode);
            if (stillActive && Date.now() - stillActive.lastActivity > 2 * 60 * 1000) {
              // No activity for 2 minutes - end room
              const room = await roomService.getRoomByCode(socket.roomCode);
              if (room) {
                await roomService.updateRoomStatus(room.id, 'ended');
                io.to(socket.roomCode).emit('room-timeout');
                activeConnections.delete(socket.roomCode);
                console.log(`⏰ Room ${socket.roomCode} auto-ended due to inactivity`);
                
                // Update room list
                const activeRooms = await roomService.getActiveRooms();
                io.emit('rooms-updated', activeRooms);
              }
            }
          }, 2 * 60 * 1000);
        }
      }
      console.log(`❌ User disconnected: ${socket.id}`);
    });
  });

  // Update last activity
  function updateActivity(roomCode) {
    const connection = activeConnections.get(roomCode);
    if (connection) {
      connection.lastActivity = Date.now();
    }
  }

  // Cleanup expired rooms every 10 minutes
  setInterval(async () => {
    await roomService.deleteExpiredRooms();
  }, 10 * 60 * 1000);
};

module.exports = { initializeSignaling };
