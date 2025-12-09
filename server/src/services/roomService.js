const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

class RoomService {
  generateRoomCode() {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  async createRoom(doctorId, password, maxParticipants = 2) {
    const roomCode = this.generateRoomCode();
    const passwordHash = await bcrypt.hash(password, 10);
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

    const query = `
      INSERT INTO rooms (room_code, doctor_id, password_hash, max_participants, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await pool.query(query, [
      roomCode,
      doctorId,
      passwordHash,
      maxParticipants,
      expiresAt,
    ]);

    return result.rows[0];
  }

  async getRoomByCode(roomCode) {
    const query = 'SELECT * FROM rooms WHERE room_code = $1';
    const result = await pool.query(query, [roomCode]);
    return result.rows[0];
  }

  async getRoomById(roomId) {
    const query = 'SELECT * FROM rooms WHERE id = $1';
    const result = await pool.query(query, [roomId]);
    return result.rows[0];
  }

  async getActiveRooms() {
    const query = `
      SELECT 
        r.id,
        r.room_code,
        r.status,
        r.created_at,
        u.full_name as doctor_name,
        u.email as doctor_email,
        u.license_number
      FROM rooms r
      JOIN users u ON r.doctor_id = u.id
      WHERE r.status IN ('waiting', 'active')
        AND r.expires_at > NOW()
      ORDER BY r.created_at DESC
    `;

    const result = await pool.query(query);
    return result.rows;
  }

  async verifyRoomPassword(roomCode, password) {
    const room = await this.getRoomByCode(roomCode);

    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    if (room.status === 'ended') {
      return { success: false, error: 'Room has ended' };
    }

    if (new Date(room.expires_at) < new Date()) {
      return { success: false, error: 'Room has expired' };
    }

    const isValid = await bcrypt.compare(password, room.password_hash);

    if (!isValid) {
      return { success: false, error: 'Invalid password' };
    }

    return { success: true, roomId: room.id, roomCode: room.room_code };
  }

  async updateRoomStatus(roomId, status) {
    const query = 'UPDATE rooms SET status = $1 WHERE id = $2 RETURNING *';
    const result = await pool.query(query, [status, roomId]);
    return result.rows[0];
  }

  async deleteRoom(roomId) {
    const query = 'DELETE FROM rooms WHERE id = $1';
    await pool.query(query, [roomId]);
  }

  async deleteExpiredRooms() {
    const query = `
      DELETE FROM rooms 
      WHERE expires_at < NOW() 
         OR (status = 'ended' AND created_at < NOW() - INTERVAL '2 minutes')
         OR (status = 'waiting' AND created_at < NOW() - INTERVAL '30 minutes')
    `;
    
    const result = await pool.query(query);
    console.log(`🗑️ Cleaned up ${result.rowCount} expired rooms`);
    return result.rowCount;
  }

  async scheduleRoomCleanup(roomId) {
    setTimeout(async () => {
      try {
        const room = await this.getRoomById(roomId);
        if (room && room.status !== 'ended') {
          await this.updateRoomStatus(roomId, 'ended');
          console.log(`⏰ Auto-ended room ${roomId} after timeout`);
        }
      } catch (error) {
        console.error('Room cleanup error:', error);
      }
    }, 2 * 60 * 1000);
  }

  async getDoctorActiveRoom(doctorId) {
    const query = `
      SELECT * FROM rooms 
      WHERE doctor_id = $1 
        AND status IN ('waiting', 'active')
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const result = await pool.query(query, [doctorId]);
    return result.rows[0];
  }
}

module.exports = new RoomService();
