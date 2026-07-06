from flask import Flask, jsonify, request, render_template
import uuid
import database
import sqlite3

app = Flask(__name__, template_folder='templates', static_folder='static')

# Initialize DB on start to ensure tables exist
database.init_db()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/drivers', methods=['GET'])
def get_drivers():
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM drivers')
    drivers = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(drivers)

@app.route('/api/rides', methods=['GET'])
def get_rides():
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT r.*, d.name as driver_name, d.vehicle_model, d.vehicle_plate, d.rating as driver_rating
        FROM rides r
        LEFT JOIN drivers d ON r.driver_id = d.id
        ORDER BY r.created_at DESC
        LIMIT 10
    ''')
    rides = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(rides)

@app.route('/api/rides', methods=['POST'])
def create_ride():
    data = request.json
    pickup_name = data.get('pickup_name')
    pickup_lat = float(data.get('pickup_lat'))
    pickup_lng = float(data.get('pickup_lng'))
    dropoff_name = data.get('dropoff_name')
    dropoff_lat = float(data.get('dropoff_lat'))
    dropoff_lng = float(data.get('dropoff_lng'))
    ride_type = data.get('ride_type', 'Economy')
    fare = float(data.get('fare'))
    
    ride_id = f"RIDE-{uuid.uuid4().hex[:6].upper()}"
    
    conn = database.get_db()
    cursor = conn.cursor()
    
    # Try to find an idle driver of the requested class
    cursor.execute('SELECT * FROM drivers WHERE status = "idle" AND vehicle_type = ?', (ride_type,))
    drivers = cursor.fetchall()
    
    if not drivers:
        # Fallback to any idle driver
        cursor.execute('SELECT * FROM drivers WHERE status = "idle"')
        drivers = cursor.fetchall()
        
    if not drivers:
        # For demo purposes, if all drivers are busy, force free them
        cursor.execute('UPDATE drivers SET status = "idle"')
        conn.commit()
        cursor.execute('SELECT * FROM drivers')
        drivers = cursor.fetchall()
        
    nearest_driver = None
    min_dist = float('inf')
    
    for d in drivers:
        dist = ((d['lat'] - pickup_lat)**2 + (d['lng'] - pickup_lng)**2)**0.5
        if dist < min_dist:
            min_dist = dist
            nearest_driver = d
            
    if not nearest_driver:
        conn.close()
        return jsonify({'error': 'No drivers available at this moment.'}), 400
        
    driver_id = nearest_driver['id']
    
    # Update driver to busy
    cursor.execute('UPDATE drivers SET status = "busy" WHERE id = ?', (driver_id,))
    
    # Insert ride
    cursor.execute('''
        INSERT INTO rides (id, pickup_name, pickup_lat, pickup_lng, dropoff_name, dropoff_lat, dropoff_lng, fare, ride_type, status, driver_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (ride_id, pickup_name, pickup_lat, pickup_lng, dropoff_name, dropoff_lat, dropoff_lng, fare, ride_type, 'accepted', driver_id))
    
    conn.commit()
    
    # Fetch details of created ride
    cursor.execute('''
        SELECT r.*, d.name as driver_name, d.vehicle_model, d.vehicle_plate, d.rating as driver_rating
        FROM rides r
        JOIN drivers d ON r.driver_id = d.id
        WHERE r.id = ?
    ''', (ride_id,))
    
    ride_row = dict(cursor.fetchone())
    conn.close()
    
    return jsonify(ride_row)

@app.route('/api/rides/<ride_id>', methods=['GET'])
def get_ride_details(ride_id):
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT r.*, d.name as driver_name, d.vehicle_model, d.vehicle_plate, d.rating as driver_rating, d.lat as driver_lat, d.lng as driver_lng
        FROM rides r
        LEFT JOIN drivers d ON r.driver_id = d.id
        WHERE r.id = ?
    ''', (ride_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return jsonify({'error': 'Ride not found'}), 404
    return jsonify(dict(row))

@app.route('/api/rides/<ride_id>/status', methods=['POST'])
def update_ride_status(ride_id):
    data = request.json
    new_status = data.get('status')
    driver_lat = data.get('driver_lat')
    driver_lng = data.get('driver_lng')
    
    if new_status not in ['accepted', 'arrived', 'in_progress', 'completed', 'cancelled']:
        return jsonify({'error': 'Invalid status'}), 400
        
    conn = database.get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM rides WHERE id = ?', (ride_id,))
    ride = cursor.fetchone()
    if not ride:
        conn.close()
        return jsonify({'error': 'Ride not found'}), 404
        
    cursor.execute('UPDATE rides SET status = ? WHERE id = ?', (new_status, ride_id))
    
    driver_id = ride['driver_id']
    if driver_id:
        if driver_lat is not None and driver_lng is not None:
            cursor.execute('UPDATE drivers SET lat = ?, lng = ? WHERE id = ?', (float(driver_lat), float(driver_lng), driver_id))
            
        if new_status in ['completed', 'cancelled']:
            cursor.execute('UPDATE drivers SET status = "idle" WHERE id = ?', (driver_id,))
            
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'status': new_status})

@app.route('/api/drivers/<int:driver_id>/location', methods=['POST'])
def update_driver_location(driver_id):
    data = request.json
    lat = float(data.get('lat'))
    lng = float(data.get('lng'))
    
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute('UPDATE drivers SET lat = ?, lng = ? WHERE id = ?', (lat, lng, driver_id))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
