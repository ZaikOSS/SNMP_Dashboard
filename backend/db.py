import sqlite3
import json
from werkzeug.security import generate_password_hash, check_password_hash

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
        fan_status TEXT,
        last_seen TIMESTAMP,
        ip_address TEXT,
        vendor TEXT
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
        cpu_utilization REAL,
        ram_utilization REAL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    # Users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'manager', 'visitor')),
        status TEXT NOT NULL CHECK(status IN ('approved', 'pending', 'suspended'))
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
        type TEXT NOT NULL,
        FOREIGN KEY (source_device_id) REFERENCES devices (id) ON DELETE CASCADE,
        FOREIGN KEY (target_device_id) REFERENCES devices (id) ON DELETE CASCADE
    )
    """)
    # Feedback table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        problem TEXT NOT NULL,
        troubleshooting TEXT,
        solution TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
    """)
    conn.commit()
    
    # Check for and create default admin
    cursor.execute("SELECT id FROM users WHERE username = 'admin'")
    if cursor.fetchone() is None:
        hashed_password = generate_password_hash("admin1234")
        cursor.execute("INSERT INTO users (username, password_hash, role, status) VALUES (?, ?, ?, ?)", ('admin', hashed_password, 'admin', 'approved'))
        conn.commit()
        
    conn.close()

def create_user(username, password, role='visitor', status='pending'):
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    password_hash = generate_password_hash(password)
    try:
        cursor.execute("INSERT INTO users (username, password_hash, role, status) VALUES (?, ?, ?, ?)", (username, password_hash, role, status))
        conn.commit()
        cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
        new_user = cursor.fetchone()
        return dict(new_user) if new_user else None
    except sqlite3.IntegrityError:
        return None
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
    cursor.execute("SELECT id, username, role, status FROM users")
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
    if role not in ['admin', 'manager', 'visitor']:
        return False
    try:
        cursor.execute("UPDATE users SET username = ?, role = ? WHERE id = ?", (username, role, user_id))
        conn.commit()
        return cursor.rowcount > 0
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()

def update_user_password(user_id, new_password):
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    cursor = conn.cursor()
    hashed_password = generate_password_hash(new_password)
    cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?", (hashed_password, user_id))
    conn.commit()
    was_updated = cursor.rowcount > 0
    conn.close()
    return was_updated

def update_user_status(user_id, status):
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET status = ? WHERE id = ?", (status, user_id))
    conn.commit()
    was_updated = cursor.rowcount > 0
    conn.close()
    return was_updated

def insert_device(ip, hostname, sysdescr, sysuptime, interfaces_json, cpu, ram, power_status, fan_status, ip_address, vendor):
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO devices (ip, hostname, sysdescr, sysuptime, interfaces_json, cpu_utilization, ram_utilization, power_supply_status, fan_status, last_seen, ip_address, vendor)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
    ON CONFLICT(ip) DO UPDATE SET
        hostname=excluded.hostname,
        sysdescr=excluded.sysdescr,
        sysuptime=excluded.sysuptime,
        interfaces_json=excluded.interfaces_json,
        cpu_utilization=excluded.cpu_utilization,
        ram_utilization=excluded.ram_utilization,
        power_supply_status=excluded.power_supply_status,
        fan_status=excluded.fan_status,
        last_seen=CURRENT_TIMESTAMP,
        ip_address=excluded.ip_address,
        vendor=excluded.vendor;
    """, (ip, hostname, sysdescr, sysuptime, interfaces_json, cpu, ram, power_status, fan_status, ip_address, vendor))
    conn.commit()
    conn.close()

def insert_history(ip, hostname, sysdescr, sysuptime, total_in, total_out, in_throughput, out_throughput, cpu_util, ram_util):
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO history (ip, hostname, sysdescr, sysuptime, total_in_octets, total_out_octets, in_throughput_kbps, out_throughput_kbps, cpu_utilization, ram_utilization) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (ip, hostname, sysdescr, sysuptime, total_in, total_out, in_throughput, out_throughput, cpu_util, ram_util)
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

def create_connection(source_device_id, source_interface, target_device_id, target_interface, conn_type):
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO connections (source_device_id, source_interface, target_device_id, target_interface, type) VALUES (?, ?, ?, ?, ?)",
        (source_device_id, source_interface, target_device_id, target_interface, conn_type)
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

def delete_device(device_id):
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute("SELECT ip FROM devices WHERE id = ?", (device_id,))
    device = cursor.fetchone()
    if device:
        ip = device[0]
        cursor.execute("DELETE FROM history WHERE ip = ?", (ip,))
        cursor.execute("DELETE FROM devices WHERE id = ?", (device_id,))
        conn.commit()
        was_deleted = cursor.rowcount > 0
        conn.close()
        return was_deleted
    conn.close()
    return False

def insert_feedback(user_id, problem, troubleshooting, solution):
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO feedback (user_id, problem, troubleshooting, solution) VALUES (?, ?, ?, ?)",
        (user_id, problem, troubleshooting, solution)
    )
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return new_id

def get_all_feedback():
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT f.*, u.username FROM feedback f JOIN users u ON f.user_id = u.id ORDER BY f.timestamp DESC")
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows

def get_feedback_by_user_id(user_id):
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT f.*, u.username FROM feedback f JOIN users u ON f.user_id = u.id WHERE f.user_id = ? ORDER BY f.timestamp DESC", (user_id,))
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows

def delete_feedback(feedback_id):
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM feedback WHERE id = ?", (feedback_id,))
    conn.commit()
    was_deleted = cursor.rowcount > 0
    conn.close()
    return was_deleted