const roomService = require('../services/roomService');

class RoomController {
  async createRoom(req, res) {
    try {
      const { password, maxParticipants } = req.body;
      const doctorId = req.user.userId;

      if (!password) {
        return res.status(400).json({ error: 'Room password required' });
      }

      if (req.user.role !== 'doctor') {
        return res.status(403).json({ error: 'Only doctors can create rooms' });
      }

      // Check if doctor already has an active room
      const existingRoom = await roomService.getDoctorActiveRoom(doctorId);
      if (existingRoom) {
        // End the existing room first
        await roomService.updateRoomStatus(existingRoom.id, 'ended');
      }

      const room = await roomService.createRoom(doctorId, password, maxParticipants);

      res.status(201).json({
        success: true,
        message: 'Room created successfully',
        data: room,
      });
    } catch (error) {
      console.error('Create room error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getActiveRooms(req, res) {
    try {
      const rooms = await roomService.getActiveRooms();
      res.json({ success: true, data: rooms });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async verifyRoom(req, res) {
    try {
      const { roomCode, password } = req.body;

      if (!roomCode || !password) {
        return res.status(400).json({ error: 'Room code and password required' });
      }

      const result = await roomService.verifyRoomPassword(roomCode, password);

      if (!result.success) {
        return res.status(401).json({ 
          success: false,
          error: result.error || 'Invalid password' 
        });
      }

      res.json({ 
        success: true, 
        data: {
          roomId: result.roomId,
          roomCode: result.roomCode,
          verified: true
        }
      });
    } catch (error) {
      console.error('Verify room error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // NEW: End room endpoint
  async endRoom(req, res) {
    try {
      const { roomCode } = req.body;
      const doctorId = req.user.userId;

      if (!roomCode) {
        return res.status(400).json({ error: 'Room code required' });
      }

      const room = await roomService.getRoomByCode(roomCode);

      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }

      // Verify it's the doctor's room
      if (room.doctor_id !== doctorId) {
        return res.status(403).json({ error: 'Not authorized to end this room' });
      }

      await roomService.updateRoomStatus(room.id, 'ended');

      res.json({ 
        success: true, 
        message: 'Room ended successfully' 
      });
    } catch (error) {
      console.error('End room error:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

const controller = new RoomController();
module.exports = {
  createRoom: controller.createRoom.bind(controller),
  getActiveRooms: controller.getActiveRooms.bind(controller),
  verifyRoom: controller.verifyRoom.bind(controller),
  endRoom: controller.endRoom.bind(controller),
};
