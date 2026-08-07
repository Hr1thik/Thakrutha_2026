const fs = require('fs');
const os = require('os');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const useSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY);

let db = null;

if (!useSupabase) {
  function getWritableDbPath() {
    if (process.env.VERCEL) {
      return path.join(os.tmpdir(), 'thakrutha.db');
    }
    try {
      const localPath = path.join(__dirname, 'thakrutha.db');
      fs.accessSync(__dirname, fs.constants.W_OK);
      return localPath;
    } catch (e) {
      return path.join(os.tmpdir(), 'thakrutha.db');
    }
  }

  const dbPath = getWritableDbPath();
  try {
    db = new DatabaseSync(dbPath);
  } catch (err) {
    console.warn(`Could not open DB at ${dbPath}, trying temp dir:`, err.message);
    db = new DatabaseSync(path.join(os.tmpdir(), 'thakrutha.db'));
  }
}

const ADMIN_USERS = [
  { username: 'admin1', password: process.env.ADMIN1_PASSWORD || 'Thakrutha2023', name: 'Admin 1 (Primary)' },
  { username: 'admin2', password: process.env.ADMIN2_PASSWORD || 'Thakrutha2023', name: 'Admin 2 (Gate Manager)' },
  { username: 'admin3', password: process.env.ADMIN3_PASSWORD || 'Thakrutha2023', name: 'Admin 3 (Finance Manager)' }
];

async function supabaseFetch(endpoint, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
    ...(options.headers || {})
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Supabase Error (${res.status}): ${errText}`);
  }
  return res.json();
}

function initDB() {
  if (useSupabase) {
    console.log('⚡ Connected to Supabase Cloud Database:', SUPABASE_URL);
    return;
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      emergency_contact TEXT NOT NULL,
      pass_type TEXT NOT NULL,
      amount REAL NOT NULL,
      sadhya_type TEXT DEFAULT '100% Pure Veg',
      checked_in INTEGER DEFAULT 0,
      check_in_time TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  try {
    const pragma = db.prepare("PRAGMA table_info(tickets)").all();
    const cols = pragma.map(p => p.name);

    if (!cols.includes('request_code')) db.exec("ALTER TABLE tickets ADD COLUMN request_code TEXT");
    if (!cols.includes('ticket_code')) db.exec("ALTER TABLE tickets ADD COLUMN ticket_code TEXT");
    if (!cols.includes('utr_number')) db.exec("ALTER TABLE tickets ADD COLUMN utr_number TEXT DEFAULT ''");
    if (!cols.includes('status')) db.exec("ALTER TABLE tickets ADD COLUMN status TEXT DEFAULT 'APPROVED'");
    if (!cols.includes('submitted_at')) db.exec("ALTER TABLE tickets ADD COLUMN submitted_at TEXT");
    if (!cols.includes('approved_at')) db.exec("ALTER TABLE tickets ADD COLUMN approved_at TEXT");
    if (!cols.includes('approved_by')) db.exec("ALTER TABLE tickets ADD COLUMN approved_by TEXT");

    db.exec("UPDATE tickets SET request_code = 'REQ-2026-' || id WHERE request_code IS NULL OR request_code = ''");
    db.exec("UPDATE tickets SET status = 'APPROVED' WHERE status IS NULL OR status = ''");

    // Default Settings
    const qrStmt = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('upi_qr_url', 'images/upi_qr.png')");
    const upiStmt = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('upi_id', 'thakrutha@upi')");
    qrStmt.run();
    upiStmt.run();

  } catch (e) {
    console.warn('DB Migration warning:', e.message);
  }
}

initDB();

async function getSetting(key, defaultValue = '') {
  if (useSupabase) {
    try {
      const data = await supabaseFetch(`settings?key=eq.${encodeURIComponent(key)}&select=value`);
      return data.length > 0 ? data[0].value : defaultValue;
    } catch (e) {
      console.warn('Supabase getSetting error:', e.message);
      return defaultValue;
    }
  }
  const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
  const res = stmt.get(key);
  return res ? res.value : defaultValue;
}

async function setSetting(key, value) {
  if (useSupabase) {
    try {
      await supabaseFetch(`settings`, {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({ key, value })
      });
      return;
    } catch (e) {
      console.error('Supabase setSetting error:', e.message);
      throw e;
    }
  }
  const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  stmt.run(key, value);
}

function authenticateAdmin(username, password) {
  const u = (username || '').trim().toLowerCase();
  const p = (password || '').trim();

  const found = ADMIN_USERS.find(user => user.username.toLowerCase() === u && user.password === p);
  if (found) {
    return { success: true, admin: { username: found.username, name: found.name } };
  }
  return { success: false, message: 'Invalid Username or Password!' };
}

function isValidAdmin(username, password) {
  return authenticateAdmin(username, password).success;
}

const TOTAL_CAPACITY = 500;

async function getStats() {
  if (useSupabase) {
    try {
      const approved = await supabaseFetch(`tickets?status=eq.APPROVED&select=id`, { headers: { 'Prefer': 'count=exact' } });
      const pending = await supabaseFetch(`tickets?status=eq.PENDING&select=id`, { headers: { 'Prefer': 'count=exact' } });
      const checkedIn = await supabaseFetch(`tickets?status=eq.APPROVED&checked_in=eq.1&select=id`, { headers: { 'Prefer': 'count=exact' } });

      const approvedCount = approved.length;
      const pendingCount = pending.length;
      const checkedInCount = checkedIn.length;
      const ticketsRemaining = Math.max(0, TOTAL_CAPACITY - approvedCount);
      const remainingPercentage = Math.round((ticketsRemaining / TOTAL_CAPACITY) * 100);

      return {
        totalCapacity: TOTAL_CAPACITY,
        ticketsBooked: approvedCount,
        pendingApprovals: pendingCount,
        ticketsRemaining,
        remainingPercentage,
        checkedInCount,
        totalRevenue: approvedCount * 1100
      };
    } catch (e) {
      console.error('Supabase getStats error:', e.message);
    }
  }

  const approvedStmt = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'APPROVED'");
  const { count: approvedCount } = approvedStmt.get();

  const pendingStmt = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'PENDING'");
  const { count: pendingCount } = pendingStmt.get();

  const checkedInStmt = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'APPROVED' AND checked_in = 1");
  const { count: checkedInCount } = checkedInStmt.get();

  const ticketsRemaining = Math.max(0, TOTAL_CAPACITY - approvedCount);
  const remainingPercentage = Math.round((ticketsRemaining / TOTAL_CAPACITY) * 100);

  return {
    totalCapacity: TOTAL_CAPACITY,
    ticketsBooked: approvedCount,
    pendingApprovals: pendingCount,
    ticketsRemaining,
    remainingPercentage,
    checkedInCount,
    totalRevenue: approvedCount * 1100
  };
}

function cleanRecord(rec) {
  if (!rec) return rec;
  if (Array.isArray(rec)) return rec.map(cleanRecord);
  const cleaned = { ...rec };
  for (const key in cleaned) {
    if (typeof cleaned[key] === 'bigint') {
      cleaned[key] = Number(cleaned[key]);
    }
  }
  return cleaned;
}

async function createTicketSubmission({ name, email, phone, emergencyContact, utrNumber }) {
  const requestCode = `REQ-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString();

  if (useSupabase) {
    const result = await supabaseFetch(`tickets`, {
      method: 'POST',
      body: JSON.stringify({
        name,
        email,
        phone,
        emergency_contact: emergencyContact,
        pass_type: 'THAKRUTHA Stag Festival Pass',
        amount: 1100,
        request_code: requestCode,
        utr_number: utrNumber,
        status: 'PENDING',
        sadhya_type: '100% Pure Veg',
        submitted_at: now,
        created_at: now
      })
    });
    return {
      success: true,
      message: 'Payment details submitted successfully! Pending admin approval.',
      submission: cleanRecord(result[0])
    };
  }

  const stmt = db.prepare(`
    INSERT INTO tickets (name, email, phone, emergency_contact, pass_type, amount, request_code, ticket_code, utr_number, status, sadhya_type, submitted_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    name,
    email,
    phone,
    emergencyContact,
    'THAKRUTHA Stag Festival Pass',
    1100,
    requestCode,
    '',
    utrNumber,
    'PENDING',
    '100% Pure Veg',
    now,
    now
  );

  const getStmt = db.prepare('SELECT * FROM tickets WHERE request_code = ?');
  const record = getStmt.get(requestCode);

  return {
    success: true,
    message: 'Payment details submitted successfully! Pending admin approval.',
    submission: cleanRecord(record)
  };
}

async function createDirectTicket({ name, email, phone, emergencyContact, adminUsername }) {
  const requestCode = `REQ-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const ticketCode = `TK-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString();

  if (useSupabase) {
    const result = await supabaseFetch(`tickets`, {
      method: 'POST',
      body: JSON.stringify({
        name,
        email,
        phone,
        emergency_contact: emergencyContact,
        pass_type: 'THAKRUTHA Stag Festival Pass',
        amount: 1100,
        request_code: requestCode,
        ticket_code: ticketCode,
        utr_number: `DIRECT: Cash Collected (₹1100)`,
        status: 'APPROVED',
        sadhya_type: '100% Pure Veg',
        submitted_at: now,
        approved_at: now,
        approved_by: adminUsername,
        created_at: now
      })
    });
    return {
      success: true,
      message: `Ticket ${ticketCode} directly issued by ${adminUsername}! Sent via Email & SMS.`,
      ticket: result[0]
    };
  }

  const stmt = db.prepare(`
    INSERT INTO tickets (name, email, phone, emergency_contact, pass_type, amount, request_code, ticket_code, utr_number, status, sadhya_type, submitted_at, approved_at, approved_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    name,
    email,
    phone,
    emergencyContact,
    'THAKRUTHA Stag Festival Pass',
    1100,
    requestCode,
    ticketCode,
    `DIRECT: Cash Collected (₹1100)`,
    'APPROVED',
    '100% Pure Veg',
    now,
    now,
    adminUsername,
    now
  );

  const getStmt = db.prepare('SELECT * FROM tickets WHERE ticket_code = ?');
  const ticket = getStmt.get(ticketCode);

  return {
    success: true,
    message: `Ticket ${ticketCode} directly issued by ${adminUsername}! Sent via Email & SMS.`,
    ticket
  };
}

async function getPendingSubmissions() {
  if (useSupabase) {
    return cleanRecord(await supabaseFetch(`tickets?status=eq.PENDING&order=id.desc`));
  }
  const stmt = db.prepare("SELECT * FROM tickets WHERE status = 'PENDING' ORDER BY id DESC");
  return cleanRecord(stmt.all());
}

async function getAllTickets() {
  if (useSupabase) {
    return cleanRecord(await supabaseFetch(`tickets?order=id.desc`));
  }
  const stmt = db.prepare("SELECT * FROM tickets ORDER BY id DESC");
  return cleanRecord(stmt.all());
}

async function approvePayment(requestCode, adminUsername) {
  const ticketCode = `TK-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString();

  if (useSupabase) {
    const result = await supabaseFetch(`tickets?request_code=eq.${encodeURIComponent(requestCode)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'APPROVED',
        ticket_code: ticketCode,
        approved_at: now,
        approved_by: adminUsername
      })
    });

    if (!result || result.length === 0) {
      return { success: false, message: 'Request code not found' };
    }

    return {
      success: true,
      message: `Payment Approved by ${adminUsername}! Ticket ${ticketCode} generated and sent via Email & SMS to ${result[0].phone}.`,
      ticket: cleanRecord(result[0])
    };
  }

  const stmt = db.prepare("SELECT * FROM tickets WHERE request_code = ? AND status = 'PENDING'");
  const ticket = stmt.get(requestCode);

  if (!ticket) {
    return { success: false, message: 'Request code not found or already processed.' };
  }

  const updateStmt = db.prepare(`
    UPDATE tickets 
    SET status = 'APPROVED', ticket_code = ?, approved_at = ?, approved_by = ?
    WHERE request_code = ?
  `);

  updateStmt.run(ticketCode, now, adminUsername, requestCode);

  const updatedTicket = db.prepare('SELECT * FROM tickets WHERE request_code = ?').get(requestCode);

  return {
    success: true,
    message: `Payment Approved by ${adminUsername}! Ticket ${ticketCode} generated and sent via Email & SMS to ${updatedTicket.phone}.`,
    ticket: cleanRecord(updatedTicket)
  };
}

async function rejectPayment(requestCode, adminUsername, reason = 'Invalid UTR Number') {
  const now = new Date().toISOString();

  if (useSupabase) {
    const result = await supabaseFetch(`tickets?request_code=eq.${encodeURIComponent(requestCode)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'REJECTED',
        approved_at: now,
        approved_by: adminUsername
      })
    });
    return { success: true, message: `Submission ${requestCode} Rejected by ${adminUsername}. Reason: ${reason}` };
  }

  const stmt = db.prepare("SELECT * FROM tickets WHERE request_code = ? AND status = 'PENDING'");
  const ticket = stmt.get(requestCode);

  if (!ticket) {
    return { success: false, message: 'Request code not found or already processed.' };
  }

  const updateStmt = db.prepare(`
    UPDATE tickets 
    SET status = 'REJECTED', approved_at = ?, approved_by = ?
    WHERE request_code = ?
  `);

  updateStmt.run(now, adminUsername, requestCode);

  return {
    success: true,
    message: `Submission ${requestCode} Rejected by ${adminUsername}. Reason: ${reason}`
  };
}

async function searchTickets(query) {
  const q = (query || '').trim();
  if (!q) return [];

  if (useSupabase) {
    try {
      return await supabaseFetch(`tickets?or=(phone.ilike.*${encodeURIComponent(q)}*,request_code.ilike.*${encodeURIComponent(q)}*,ticket_code.ilike.*${encodeURIComponent(q)}*,utr_number.ilike.*${encodeURIComponent(q)}*)&order=id.desc`);
    } catch (e) {
      console.error('Supabase searchTickets error:', e.message);
      return [];
    }
  }

  const stmt = db.prepare(`
    SELECT * FROM tickets 
    WHERE phone LIKE ? OR request_code LIKE ? OR ticket_code LIKE ? OR utr_number LIKE ?
    ORDER BY id DESC
  `);
  const searchTerm = `%${q}%`;
  return stmt.all(searchTerm, searchTerm, searchTerm, searchTerm);
}

async function verifyGateTicket(code, adminUsername) {
  const c = (code || '').trim();
  const now = new Date().toISOString();

  if (useSupabase) {
    const records = await supabaseFetch(`tickets?or=(ticket_code.eq.${encodeURIComponent(c)},request_code.eq.${encodeURIComponent(c)})`);
    if (records.length === 0) {
      return { success: false, message: `Invalid Code: "${c}". No ticket found.` };
    }
    const ticket = records[0];
    if (ticket.status !== 'APPROVED') {
      return { success: false, message: `Entry Denied! Payment for "${c}" is ${ticket.status}.` };
    }
    if (ticket.checked_in === 1) {
      return { success: false, message: `ALREADY CHECKED IN! Ticket "${c}" was used at ${ticket.check_in_time}.` };
    }

    await supabaseFetch(`tickets?id=eq.${ticket.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ checked_in: 1, check_in_time: now })
    });

    return {
      success: true,
      message: `ENTRY GRANTED! Verified Attendee: ${ticket.name} (${ticket.ticket_code}). Gate verified by ${adminUsername}.`,
      ticket: { ...ticket, checked_in: 1, check_in_time: now }
    };
  }

  const stmt = db.prepare("SELECT * FROM tickets WHERE ticket_code = ? OR request_code = ?");
  const ticket = stmt.get(c, c);

  if (!ticket) {
    return { success: false, message: `Invalid Code: "${c}". No ticket found.` };
  }

  if (ticket.status !== 'APPROVED') {
    return { success: false, message: `Entry Denied! Payment for "${c}" is ${ticket.status}.` };
  }

  if (ticket.checked_in === 1) {
    return { success: false, message: `ALREADY CHECKED IN! Ticket "${c}" was used at ${ticket.check_in_time}.` };
  }

  const checkInStmt = db.prepare("UPDATE tickets SET checked_in = 1, check_in_time = ? WHERE id = ?");
  checkInStmt.run(now, ticket.id);

  return {
    success: true,
    message: `ENTRY GRANTED! Verified Attendee: ${ticket.name} (${ticket.ticket_code}). Gate verified by ${adminUsername}.`,
    ticket: { ...ticket, checked_in: 1, check_in_time: now }
  };
}

module.exports = {
  getSetting,
  setSetting,
  authenticateAdmin,
  isValidAdmin,
  getStats,
  createTicketSubmission,
  createDirectTicket,
  getPendingSubmissions,
  getAllTickets,
  approvePayment,
  rejectPayment,
  searchTickets,
  verifyGateTicket
};
