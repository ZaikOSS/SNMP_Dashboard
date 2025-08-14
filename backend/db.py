import sqlite3
import json
from werkzeug.security import generate_password_hash

DB_FILE = "network_data.db"

def init_db():
    """Initializes the database and creates tables if they don't exist."""
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    cursor = conn.cursor()
    # Devices table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip TEXT UNIQUE,
        hostname TEXT,
        sysdescr TEXT,
        sysuptime TEXT,
        interfaces_json TEXT,
        cpu_utilization REAL,
        ram_utilization REAL,
        power_supply_status TEXT,
        last_seen TIMESTAMP
    )
    """)
    # History table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip TEXT,
        hostname TEXT,
        sysdescr TEXT,
        sysuptime TEXT,
        total_in_octets INTEGER,
        total_out_octets INTEGER,
        in_throughput_kbps REAL,
        out_throughput_kbps REAL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    # Users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'visitor'))
    )
    """)
    # Connections table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS connections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_device_id INTEGER NOT NULL,
        source_interface TEXT NOT NULL,
        target_device_id INTEGER NOT NULL,
        target_interface TEXT NOT NULL,
        FOREIGN KEY (source_device_id) REFERENCES devices (id) ON DELETE CASCADE,
        FOREIGN KEY (target_device_id) REFERENCES devices (id) ON DELETE CASCADE
    )
    """)
    conn.commit()
    conn.close()

def create_user(username, password, role='visitor'):
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    password_hash = generate_password_hash(password)
    try:
        cursor.execute("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", (username, password_hash, role))
        conn.commit()
        cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
        new_user = cursor.fetchone()
        return dict(new_user) if new_user else None
    except sqlite3.IntegrityError:
        return None # Username already exists
    finally:
        conn.close()

def get_user_by_username(username):
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
    user_row = cursor.fetchone()
    conn.close()
    return dict(user_row) if user_row else None

def get_user_by_id(user_id):
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    user_row = cursor.fetchone()
    conn.close()
    return dict(user_row) if user_row else None

def get_all_users():
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, role FROM users")
    users = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return users

def delete_user_by_id(user_id):
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    was_deleted = cursor.rowcount > 0
    conn.close()
    return was_deleted

def update_user(user_id, username, role):
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    cursor = conn.cursor()
    try:
        cursor.execute("UPDATE users SET username = ?, role = ? WHERE id = ?", (username, role, user_id))
        conn.commit()
        # Check if the update was successful
        return cursor.rowcount > 0
    except sqlite3.IntegrityError:
        # This will happen if the new username is already taken
        return False
    finally:
        conn.close()

def insert_device(ip, hostname, sysdescr, sysuptime, interfaces_json, cpu, ram, power_status):
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO devices (ip, hostname, sysdescr, sysuptime, interfaces_json, cpu_utilization, ram_utilization, power_supply_status, last_seen)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(ip) DO UPDATE SET
        hostname=excluded.hostname,
        sysdescr=excluded.sysdescr,
        sysuptime=excluded.sysuptime,
        interfaces_json=excluded.interfaces_json,
        cpu_utilization=excluded.cpu_utilization,
        ram_utilization=excluded.ram_utilization,
        power_supply_status=excluded.power_supply_status,
        last_seen=CURRENT_TIMESTAMP;
    """, (ip, hostname, sysdescr, sysuptime, interfaces_json, cpu, ram, power_status))
    conn.commit()
    conn.close()

def insert_history(ip, hostname, sysdescr, sysuptime, total_in, total_out, in_throughput, out_throughput):
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO history (ip, hostname, sysdescr, sysuptime, total_in_octets, total_out_octets, in_throughput_kbps, out_throughput_kbps) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (ip, hostname, sysdescr, sysuptime, total_in, total_out, in_throughput, out_throughput)
    )
    conn.commit()
    conn.close()

def get_devices():
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM devices")
    rows = []
    for row in cursor.fetchall():
        device_dict = dict(row)
        if device_dict.get('interfaces_json'):
            device_dict['interfaces'] = json.loads(device_dict['interfaces_json'])
        else:
            device_dict['interfaces'] = []
        del device_dict['interfaces_json']
        rows.append(device_dict)
    conn.close()
    return rows

def get_device_history(ip):
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    # Limit the results to the last 30 records for a cleaner graph
    cursor.execute("SELECT * FROM history WHERE ip = ? ORDER BY timestamp DESC LIMIT 30", (ip,))
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows

def get_latest_device_history(ip):
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT total_in_octets, total_out_octets, timestamp FROM history WHERE ip = ? ORDER BY timestamp DESC LIMIT 2", (ip,))
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows

def create_connection(source_device_id, source_interface, target_device_id, target_interface):
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO connections (source_device_id, source_interface, target_device_id, target_interface) VALUES (?, ?, ?, ?)",
        (source_device_id, source_interface, target_device_id, target_interface)
    )
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return new_id

def get_connections():
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM connections")
    connections = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return connections

def delete_connection(connection_id):
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM connections WHERE id = ?", (connection_id,))
    conn.commit()
    was_deleted = cursor.rowcount > 0
    conn.close()
    return was_deleted

# Deletes a device and its history from the database
def delete_device(device_id):
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    cursor = conn.cursor()
    # First, get the IP address of the device to delete its history
    cursor.execute("SELECT ip FROM devices WHERE id = ?", (device_id,))
    device = cursor.fetchone()
    if device:
        ip = device[0]
        # Delete history for the device
        cursor.execute("DELETE FROM history WHERE ip = ?", (ip,))
        # Then, delete the device itself
        cursor.execute("DELETE FROM devices WHERE id = ?", (device_id,))
        conn.commit()
        was_deleted = cursor.rowcount > 0
        conn.close()
        return was_deleted
    conn.close()
    return False

