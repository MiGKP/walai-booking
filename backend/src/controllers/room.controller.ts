import { Request, Response } from 'express';
import pool from '../config/database';

export const getAllRooms = async (req: Request, res: Response): Promise<void> => {
  try {
    const { min_price, max_price, capacity } = req.query;
    
    let query = `
      SELECT rt.id, rt.room_name, rt.type_name, rt.description, 
             rt.price as price_per_night, rt.capacity, rt.room_image as main_image, rt.status,
             (SELECT json_agg(image_path) FROM room_images ri WHERE ri.room_type_id = rt.id) as images,
             (SELECT COUNT(*) FROM rooms r WHERE r.room_type_id = rt.id AND r.status = 'available') as available_count
      FROM room_types rt 
      WHERE rt.status = true
    `;
    
    const params: any[] = [];
    let idx = 1;

    if (min_price) { query += ` AND rt.price >= $${idx++}`; params.push(Number(min_price)); }
    if (max_price) { query += ` AND rt.price <= $${idx++}`; params.push(Number(max_price)); }
    if (capacity) { query += ` AND rt.capacity >= $${idx++}`; params.push(Number(capacity)); }

    query += ' ORDER BY rt.price ASC';
    
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getRoomById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    // Fetch room type details
    const rtResult = await pool.query(`
      SELECT rt.id, rt.room_name, rt.type_name, rt.description, 
             rt.price as price_per_night, rt.capacity, rt.room_image as main_image, rt.status,
             (SELECT json_agg(image_path) FROM room_images ri WHERE ri.room_type_id = rt.id) as images,
             (SELECT json_agg(json_build_object('room_id', r.room_id, 'room_number', r.room_number, 'status', r.status)) 
              FROM rooms r WHERE r.room_type_id = rt.id) as rooms
      FROM room_types rt 
      WHERE rt.id = $1 AND rt.status = true
    `, [id]);

    if (rtResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Room type not found' });
      return;
    }
    
    // Attempt to fetch amenities (if linked to room_amenities)
    let amenities: string[] = [];
    const roomType = rtResult.rows[0];
    const amResult = await pool.query('SELECT name FROM room_amenities WHERE status = true');
    if (amResult.rows.length > 0) {
      // Temporary mock since relation requires mapping tables or JSON
      amenities = amResult.rows.map(r => r.name); 
    }

    res.json({ success: true, data: { ...roomType, amenities } });
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const checkRoomAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const { room_type_id, check_in_date, check_out_date } = req.query;

    if (!room_type_id || !check_in_date || !check_out_date) {
      res.status(400).json({ success: false, message: 'Missing parameters' });
      return;
    }

    // Find a room of this type that is NOT booked during this period
    const availableRoom = await pool.query(
      `SELECT r.room_id, r.room_number 
       FROM rooms r
       WHERE r.room_type_id = $1 AND r.status != 'maintenance'
       AND r.room_id NOT IN (
         SELECT rb.room_id FROM room_bookings rb
         WHERE rb.status NOT IN ('cancelled', 'rejected')
         AND (rb.check_in < $3 AND rb.check_out > $2)
       ) LIMIT 1`,
      [room_type_id, check_in_date, check_out_date]
    );

    res.json({
      success: true,
      data: { 
        available: availableRoom.rows.length > 0,
        available_room: availableRoom.rows[0] || null
      },
    });
  } catch (error) {
    console.error('Check availability error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const createRoom = async (req: Request, res: Response): Promise<void> => {
  try {
    const { room_name, type_name, description, capacity, price, room_image, amenity_id, quantity } = req.body;

    const result = await pool.query(
      `INSERT INTO room_types (room_name, type_name, description, capacity, price, room_image, amenity_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true) RETURNING *`,
      [room_name, type_name, description, capacity, price, room_image, amenity_id]
    );

    const roomType = result.rows[0];
    const qty = quantity || 1;
    
    // Auto generate actual rooms based on quantity
    for(let i=1; i<=qty; i++) {
      await pool.query(
        `INSERT INTO rooms (room_type_id, room_number, status) VALUES ($1, $2, 'available')`,
        [roomType.id, `${roomType.room_name}-${i}`]
      );
    }

    res.status(201).json({ success: true, message: 'Room type created', data: roomType });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const createSingleRoom = async (req: Request, res: Response): Promise<void> => {
  try {
    const { room_type_id, room_number } = req.body;
    
    const result = await pool.query(
      `INSERT INTO rooms (room_type_id, room_number, status) VALUES ($1, $2, 'available') RETURNING *`,
      [room_type_id, room_number]
    );
    
    res.status(201).json({ success: true, message: 'Room created', data: result.rows[0] });
  } catch (error) {
    console.error('Create single room error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const createRoomAmenity = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, icon } = req.body;
    
    // Assuming table structure: room_amenities (amenity_id, name, icon, status)
    // Check if table exists and create amenity
    // Note: If icon is not in schema, we just insert name and status=true
    const result = await pool.query(
      `INSERT INTO room_amenities (name, status) VALUES ($1, true) RETURNING *`,
      [name]
    );
    
    res.status(201).json({ success: true, message: 'Amenity created', data: result.rows[0] });
  } catch (error) {
    console.error('Create amenity error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updateRoom = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { room_name, type_name, description, capacity, price, room_image, amenity_id, status } = req.body;

    const result = await pool.query(
      `UPDATE room_types SET room_name=$1, type_name=$2, description=$3, capacity=$4, price=$5,
       room_image=$6, amenity_id=$7, status=$8
       WHERE id=$9 RETURNING *`,
      [room_name, type_name, description, capacity, price, room_image, amenity_id, status, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Room type not found' });
      return;
    }
    res.json({ success: true, message: 'Room type updated', data: result.rows[0] });
  } catch (error) {
    console.error('Update room error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const deleteRoom = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE room_types SET status = false WHERE id = $1', [id]);
    res.json({ success: true, message: 'Room type deactivated' });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

