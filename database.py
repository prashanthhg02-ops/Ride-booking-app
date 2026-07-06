import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'rides.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # Create rides table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS rides (
        id TEXT PRIMARY KEY,
        pickup_name TEXT,
        pickup_lat REAL,
        pickup_lng REAL,
        dropoff_name TEXT,
        dropoff_lat REAL,
        dropoff_lng REAL,
        fare REAL,
        ride_type TEXT,
        status TEXT,
        driver_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (driver_id) REFERENCES drivers (id)
    )
    ''')
    
    # Create drivers table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS drivers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        vehicle_type TEXT,
        vehicle_model TEXT,
        vehicle_plate TEXT,
        lat REAL,
        lng REAL,
        status TEXT,
        rating REAL
    )
    ''')
    
    # Insert default drivers if table is empty
    cursor.execute('SELECT COUNT(*) FROM drivers')
    if cursor.fetchone()[0] == 0:
        default_drivers = [
            ("John Doe", "Premium", "Tesla Model 3", "SF-RIDE1", 37.7830, -122.4160, "idle", 4.95),
            ("Sarah Smith", "Economy", "Toyota Prius", "SF-RIDE2", 37.7680, -122.4280, "idle", 4.82),
            ("David Lee", "Comfort", "Honda CR-V", "SF-RIDE3", 37.7720, -122.4050, "idle", 4.75),
            ("Emma Watson", "Economy", "Nissan Leaf", "SF-RIDE4", 37.7890, -122.4010, "idle", 4.90),
            ("Michael Jordan", "Premium", "BMW 5 Series", "SF-RIDE5", 37.7550, -122.4190, "idle", 4.88)
        ]
        cursor.executemany('''
        INSERT INTO drivers (name, vehicle_type, vehicle_model, vehicle_plate, lat, lng, status, rating)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', default_drivers)
        
    conn.commit()
    conn.close()
    print("Database initialized successfully at:", DB_PATH)

if __name__ == '__main__':
    init_db()
