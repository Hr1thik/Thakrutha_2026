const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, 'thakrutha.db');
const db = new DatabaseSync(dbPath);

const ADMIN_USERS = [
  { username: 'admin1', password: 'Thakrutha2023', name: 'Admin 1 (Primary)' },
  { username: 'admin2', password: 'Thakrutha2023', name: 'Admin 2 (Gate Manager)' },
  { username: 'admin3', password: 'Thakrutha2023', name: 'Admin 3 (Finance Manager)' }
];

function initDB() {
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

function getSetting(key, defaultValue = '') {
  const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
  const res = stmt.get(key);
  return res ? res.value : defaultValue;
}

function setSetting(key, value) {
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

function getStats() {
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

function submitPaymentRequest({ name, email, phone, emergencyContact, utrNumber }) {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const requestCode = `REQ-2026-${randomNum}`;
  const submittedAt = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO tickets (request_code, ticket_code, name, email, phone, emergency_contact, pass_type, amount, sadhya_type, utr_number, status, checked_in, submitted_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 0, ?, ?)
  `);

  stmt.run(
    requestCode,
    requestCode,
    name.trim(),
    email.trim(),
    phone.trim(),
    emergencyContact.trim(),
    'THAKRUTHA Stag Festival Pass',
    1100,
    '100% Pure Veg',
    utrNumber.trim(),
    submittedAt,
    submittedAt
  );

  const getStmt = db.prepare('SELECT * FROM tickets WHERE request_code = ?');
  return getStmt.get(requestCode);
}

// Admin Direct Ticket Creation (For Cash / Offline Attendees)
function createDirectTicket({ name, email, phone, emergencyContact, paymentNotes, adminUsername = 'admin1' }) {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const requestCode = `REQ-2026-${randomNum}`;
  const ticketCode = `TK-2026-${randomNum}`;
  const now = new Date().toISOString();
  const utrRef = paymentNotes ? `DIRECT: ${paymentNotes.trim()}` : 'DIRECT-CASH-PAYMENT';

  const stmt = db.prepare(`
    INSERT INTO tickets (request_code, ticket_code, name, email, phone, emergency_contact, pass_type, amount, sadhya_type, utr_number, status, checked_in, submitted_at, approved_at, approved_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'APPROVED', 0, ?, ?, ?, ?)
  `);

  stmt.run(
    requestCode,
    ticketCode,
    name.trim(),
    email.trim(),
    phone.trim(),
    emergencyContact.trim(),
    'THAKRUTHA Stag Festival Pass',
    1100,
    '100% Pure Veg',
    utrRef,
    now,
    now,
    adminUsername,
    now
  );

  const getStmt = db.prepare('SELECT * FROM tickets WHERE ticket_code = ?');
  const ticket = getStmt.get(ticketCode);

  // Email Notification Dispatch
  console.log(`
    📧 =======================================================
    [EMAIL DISPATCHED TO ATTENDEE (DIRECT ADMIN TICKET)]
    Issued By Admin: ${adminUsername}
    To: ${ticket.email} (${ticket.name})
    Subject: 🎟️ Your Official THAKRUTHA 2026 Ticket (${ticket.ticket_code})
    Content:
    Dear ${ticket.name},
    Your ticket has been directly issued by Admin (${adminUsername})!
    Official Ticket Code: ${ticket.ticket_code}
    Payment Note: ${ticket.utr_number}
    Event Date: August 23, 2026 | Timing: 09:00 AM to 07:00 PM
    =======================================================
  `);

  // SMS Notification Dispatch
  console.log(`
    📱 =======================================================
    [SMS DISPATCHED TO REGISTERED PHONE (DIRECT TICKET)]
    To: +91 ${ticket.phone}
    Message: Hi ${ticket.name}, your THAKRUTHA 2026 ticket (${ticket.ticket_code}) was issued directly by Admin (${adminUsername})! Event Date: Aug 23, 9 AM - 7 PM. View pass: ${process.env.APP_URL || 'http://localhost:3000'}
    =======================================================
  `);

  return {
    success: true,
    message: `Direct Ticket ${ticketCode} created successfully by ${adminUsername}! Sent via Email & SMS to ${ticket.phone}.`,
    ticket
  };
}

function getPendingPayments() {
  const stmt = db.prepare("SELECT * FROM tickets WHERE status = 'PENDING' ORDER BY id DESC");
  return stmt.all();
}

function approvePayment(requestCode, adminUsername = 'admin1') {
  const checkStmt = db.prepare('SELECT * FROM tickets WHERE request_code = ?');
  const record = checkStmt.get(requestCode);
  
  if (!record) {
    return { success: false, message: 'Submission request not found.' };
  }
  if (record.status === 'APPROVED') {
    return { success: false, message: 'Request is already approved!', ticket: record };
  }

  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const ticketCode = `TK-2026-${randomNum}`;
  const approvedAt = new Date().toISOString();

  const updateStmt = db.prepare(`
    UPDATE tickets
    SET status = 'APPROVED', ticket_code = ?, approved_at = ?, approved_by = ?
    WHERE request_code = ?
  `);
  updateStmt.run(ticketCode, approvedAt, adminUsername, requestCode);

  const updatedTicket = checkStmt.get(requestCode);

  // Email Notification Dispatch
  console.log(`
    📧 =======================================================
    [EMAIL DISPATCHED TO ATTENDEE]
    Approved By Admin: ${adminUsername}
    To: ${updatedTicket.email} (${updatedTicket.name})
    Subject: 🎟️ Your Official THAKRUTHA 2026 Ticket (${updatedTicket.ticket_code})
    Content:
    Dear ${updatedTicket.name},
    Your UPI payment (UTR: ${updatedTicket.utr_number}) has been APPROVED!
    Official Ticket Code: ${updatedTicket.ticket_code}
    Event Date: August 23, 2026
    Timing: 09:00 AM to 07:00 PM
    Venue: Venue Will Be Revealed Soon
    =======================================================
  `);

  // SMS Notification Dispatch
  console.log(`
    📱 =======================================================
    [SMS DISPATCHED TO REGISTERED PHONE]
    To: +91 ${updatedTicket.phone}
    Message: Hi ${updatedTicket.name}, your THAKRUTHA 2026 ticket (${updatedTicket.ticket_code}) is APPROVED! Date: Aug 23, 9 AM - 7 PM. View pass: ${process.env.APP_URL || 'http://localhost:3000'}
    =======================================================
  `);

  return {
    success: true,
    message: `Payment Approved by ${adminUsername}! Ticket ${ticketCode} generated and sent via Email & SMS to ${updatedTicket.phone}.`,
    ticket: updatedTicket
  };
}

function rejectPayment(requestCode, adminUsername = 'admin1', reason = 'UTR Verification Failed') {
  const stmt = db.prepare("UPDATE tickets SET status = 'REJECTED', approved_by = ? WHERE request_code = ?");
  stmt.run(adminUsername, requestCode);
  return { success: true, message: `Request ${requestCode} rejected by ${adminUsername}.` };
}

function getTicketByCodeOrPhone(query) {
  const q = query.trim().toUpperCase();
  const stmt = db.prepare(`
    SELECT * FROM tickets 
    WHERE UPPER(request_code) = ? 
       OR UPPER(ticket_code) = ? 
       OR phone = ? 
       OR utr_number = ?
    ORDER BY id DESC
  `);
  return stmt.all(q, q, query.trim(), query.trim());
}

function verifyTicket(code) {
  const stmt = db.prepare("SELECT * FROM tickets WHERE (UPPER(ticket_code) = UPPER(?) OR UPPER(request_code) = UPPER(?))");
  const ticket = stmt.get(code.trim(), code.trim());

  if (!ticket) {
    return { success: false, message: 'Invalid Code! No booking found.' };
  }
  if (ticket.status !== 'APPROVED') {
    return { success: false, message: `Ticket is pending admin payment approval! Status: ${ticket.status}` };
  }
  if (ticket.checked_in === 1) {
    return {
      success: false,
      alreadyCheckedIn: true,
      message: `Ticket ${ticket.ticket_code} was ALREADY checked in on ${ticket.check_in_time}.`,
      ticket
    };
  }

  const checkInTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const updateStmt = db.prepare('UPDATE tickets SET checked_in = 1, check_in_time = ? WHERE id = ?');
  updateStmt.run(checkInTime, ticket.id);

  const updatedTicket = stmt.get(code.trim(), code.trim());
  return {
    success: true,
    message: `Entry Granted! Ticket ${ticket.ticket_code} for ${ticket.name} successfully checked in.`,
    ticket: updatedTicket
  };
}

function getAllTickets() {
  const stmt = db.prepare('SELECT * FROM tickets ORDER BY id DESC');
  return stmt.all();
}

module.exports = {
  getSetting,
  setSetting,
  authenticateAdmin,
  isValidAdmin,
  getStats,
  submitPaymentRequest,
  createDirectTicket,
  getPendingPayments,
  approvePayment,
  rejectPayment,
  getTicketByCodeOrPhone,
  verifyTicket,
  getAllTickets
};
