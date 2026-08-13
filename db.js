const fs = require('fs');
const os = require('os');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

let rawUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
let rawKey = (process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

const SUPABASE_URL = rawUrl.replace(/\/+$/, '');
const SUPABASE_KEY = rawKey;

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
  const method = (options.method || 'GET').toUpperCase();
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const defaultPrefer = method !== 'GET' ? 'return=representation' : undefined;

  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...(defaultPrefer ? { 'Prefer': defaultPrefer } : {}),
    ...(options.headers || {})
  };

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Supabase Error (${res.status}): ${errText}`);
  }
  return res.json();
}

async function sendRealEmail({ to, subject, html }) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.log(`[EMAIL NOTICE TO ${to}] Subject: ${subject}`);
    return;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'THAKRUTHA 2026 <onboarding@resend.dev>',
        to: [to],
        subject: subject,
        html: html
      })
    });
    const data = await res.json();
    console.log('📧 REAL EMAIL SENT via Resend:', data);
  } catch (err) {
    console.error('Email dispatch error:', err.message);
  }
}

async function sendRealSMS({ phone, message }) {
  const fast2smsKey = process.env.FAST2SMS_API_KEY;
  if (!fast2smsKey) {
    console.log(`[SMS NOTICE TO +91 ${phone}] Message: ${message}`);
    return;
  }
  try {
    const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);
    const res = await fetch(`https://www.fast2sms.com/dev/bulkV2?authorization=${fast2smsKey}&route=q&message=${encodeURIComponent(message)}&flash=0&numbers=${cleanPhone}`);
    const data = await res.json();
    console.log('📱 REAL SMS SENT via Fast2SMS:', data);
  } catch (err) {
    console.error('SMS dispatch error:', err.message);
  }
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
    if (!cols.includes('payment_screenshot')) db.exec("ALTER TABLE tickets ADD COLUMN payment_screenshot TEXT DEFAULT ''");
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
        headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
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
  let approvedCount = 0;
  let pendingCount = 0;
  let checkedInCount = 0;
  let engine = useSupabase ? 'Supabase Cloud DB' : 'Local SQLite Database';

  if (useSupabase) {
    try {
      const all = await supabaseFetch(`tickets?select=id,name,status,checked_in,request_code,ticket_code,utr_number`);
      if (Array.isArray(all)) {
        const validTickets = all.filter(t => (t.name && t.name.trim() !== '') || (t.request_code && t.request_code.trim() !== ''));
        approvedCount = validTickets.filter(t => (t.status || '').trim().toUpperCase() === 'APPROVED').length;
        
        // Match exact pending list calculation
        const pendingList = await getPendingSubmissions();
        pendingCount = pendingList.length;

        checkedInCount = validTickets.filter(t => (t.status || '').trim().toUpperCase() === 'APPROVED' && Number(t.checked_in) === 1).length;

        const ticketsRemaining = Math.max(0, TOTAL_CAPACITY - approvedCount);
        const remainingPercentage = Math.round((ticketsRemaining / TOTAL_CAPACITY) * 100);

        return {
          datastoreEngine: engine,
          totalCapacity: TOTAL_CAPACITY,
          ticketsBooked: approvedCount,
          pendingApprovals: pendingCount,
          ticketsRemaining,
          remainingPercentage,
          checkedInCount,
          totalRevenue: approvedCount * 1100
        };
      }
    } catch (e) {
      console.warn('Supabase getStats fallback to local:', e.message);
    }
  }

  if (db) {
    try {
      const approvedStmt = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'APPROVED'");
      approvedCount = approvedStmt.get() ? approvedStmt.get().count : 0;

      const pendingStmt = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'PENDING'");
      pendingCount = pendingStmt.get() ? pendingStmt.get().count : 0;

      const checkedInStmt = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'APPROVED' AND checked_in = 1");
      checkedInCount = checkedInStmt.get() ? checkedInStmt.get().count : 0;
    } catch (e) {
      console.error('SQLite getStats error:', e.message);
    }
  }

  const ticketsRemaining = Math.max(0, TOTAL_CAPACITY - approvedCount);
  const remainingPercentage = Math.round((ticketsRemaining / TOTAL_CAPACITY) * 100);

  return {
    datastoreEngine: engine,
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

async function createTicketSubmission({ name, email, phone, emergencyContact, utrNumber, paymentScreenshot }) {
  const requestCode = `REQ-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString();

  if (useSupabase) {
    let payload = {
      name,
      email,
      phone,
      emergency_contact: emergencyContact,
      pass_type: 'THAKRUTHA Stag Festival Pass',
      amount: 1100,
      request_code: requestCode,
      utr_number: utrNumber,
      payment_screenshot: paymentScreenshot || '',
      status: 'PENDING',
      sadhya_type: '100% Pure Veg',
      submitted_at: now,
      created_at: now
    };

    try {
      const result = await supabaseFetch(`tickets`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return {
        success: true,
        message: 'Registration details and payment screenshot submitted successfully! Pending admin approval.',
        submission: cleanRecord(result[0])
      };
    } catch (supabaseErr) {
      if (supabaseErr.message && supabaseErr.message.includes('payment_screenshot')) {
        console.warn('payment_screenshot column missing in Supabase, retrying insert without image payload...');
        delete payload.payment_screenshot;
        const result = await supabaseFetch(`tickets`, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        return {
          success: true,
          message: 'Registration details submitted successfully! Pending admin approval.',
          submission: cleanRecord(result[0])
        };
      }
      throw supabaseErr;
    }
  }

  const stmt = db.prepare(`
    INSERT INTO tickets (name, email, phone, emergency_contact, pass_type, amount, request_code, ticket_code, utr_number, payment_screenshot, status, sadhya_type, submitted_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    paymentScreenshot || '',
    'PENDING',
    '100% Pure Veg',
    now,
    now
  );

  const getStmt = db.prepare('SELECT * FROM tickets WHERE request_code = ?');
  const record = getStmt.get(requestCode);

  return {
    success: true,
    message: 'Registration details and payment screenshot submitted successfully! Pending admin approval.',
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
      message: `Ticket ${ticketCode} directly issued by ${adminUsername}! Ready for PDF download.`,
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
    message: `Ticket ${ticketCode} directly issued by ${adminUsername}! Ready for PDF download.`,
    ticket
  };
}

async function getPendingSubmissions() {
  if (useSupabase) {
    try {
      // 1. Auto-clean XSS, bot & dummy test rows from Supabase
      try {
        await supabaseFetch(`tickets?or=(phone.eq.9988776655,utr_number.eq.9876543210,email.ilike.*mushraf*,email.eq.@gmail.com,email.ilike.@gmail.com,email.ilike.*@test.com,email.ilike.*xss*,name.ilike.*script*,name.ilike.*onerror*,name.eq.test,name.eq.tes,name.eq.aaa,name.eq.adrianna,phone.eq.9876543210,utr_number.eq.987654321234)`, {
          method: 'DELETE'
        });
      } catch (errClean) {
        // Continue if clean filter warning
      }

      // 2. Fetch official pending registrations
      let data = await supabaseFetch(`tickets?status=eq.PENDING&request_code=ilike.REQ-2026-*&select=id,request_code,ticket_code,name,email,phone,emergency_contact,utr_number,status,submitted_at,approved_at,approved_by,checked_in,check_in_time&order=id.desc`);
      if (Array.isArray(data)) {
        const pending = data.filter(t => {
          if ((t.status || '').trim().toUpperCase() !== 'PENDING') return false;
          const name = (t.name || '').toLowerCase();
          const email = (t.email || '').toLowerCase();
          const phone = (t.phone || '').trim();
          const utr = (t.utr_number || '').trim();
          const reqCode = (t.request_code || '').trim();

          // Real attendee submissions strictly start with REQ-2026-
          if (!reqCode.startsWith('REQ-2026-')) return false;

          // Real bank UTR numbers are strictly 12 digits long
          if (utr.length !== 12 || utr === '987654321234' || utr === '123456789012' || utr === '9876543210') return false;

          // Exclude fake phone numbers
          if (phone === '9988776655' || phone === '9876543210' || phone === '1234567890') return false;

          // Exclude dictionary bot & test names
          if (!name || name === 'test' || name === 'tes' || name === 'aaa' || name === 'adrianna' || name === 'admin' || name === 'access' || name === 'academic' || name === 'adrian' || name === 'academia' || name === 'ada' || name === 'abc' || name.includes('script') || name.includes('img') || name.includes('onerror')) return false;

          // Exclude test emails
          if (email.includes('xss') || email.endsWith('@test.com') || email.includes('mushraf') || email === '@gmail.com' || email === 'abc@gmail.com' || email === 'test@gmail.com' || email.startsWith('@')) return false;

          return true;
        });
        return cleanRecord(pending);
      }
    } catch (e1) {
      console.warn('Supabase pending query failed, trying fallback:', e1.message);
      try {
        let data = await supabaseFetch(`tickets?select=id,request_code,ticket_code,name,email,phone,emergency_contact,utr_number,status,submitted_at,approved_at,approved_by,checked_in,check_in_time`);
        if (Array.isArray(data)) {
          const pending = data.filter(t => {
            if ((t.status || '').trim().toUpperCase() !== 'PENDING') return false;
            const name = (t.name || '').toLowerCase();
            const email = (t.email || '').toLowerCase();
            const phone = (t.phone || '').trim();
            const utr = (t.utr_number || '').trim();

            if (!name || name === 'test' || name === 'tes' || name === 'aaa' || name === 'adrianna' || name.includes('script')) return false;
            if (email.includes('xss') || email.endsWith('@test.com') || email.includes('mushraf')) return false;
            if (phone === '9876543210' || utr === '987654321234') return false;
            return true;
          });
          return cleanRecord(pending);
        }
      } catch (e2) {
        console.error('Supabase getPendingSubmissions select error:', e2.message);
      }
    }
  }

  if (db) {
    try {
      const stmt = db.prepare("SELECT id, request_code, ticket_code, name, email, phone, emergency_contact, utr_number, status, submitted_at, approved_at, approved_by, checked_in, check_in_time FROM tickets WHERE status = 'PENDING' AND utr_number != '987654321234' AND phone != '9876543210' AND name NOT LIKE '%script%' AND email NOT LIKE '%xss%' ORDER BY id DESC");
      return cleanRecord(stmt.all());
    } catch (e) {
      console.error('SQLite getPendingSubmissions error:', e.message);
    }
  }

  return [];
}

async function getAllTickets() {
  if (useSupabase) {
    try {
      let data = await supabaseFetch(`tickets?select=id,request_code,ticket_code,name,email,phone,emergency_contact,utr_number,status,submitted_at,approved_at,approved_by,checked_in,check_in_time&order=id.desc`);
      if (Array.isArray(data)) {
        const valid = data.filter(t => 
          (t.status || '').trim().toUpperCase() === 'APPROVED' || 
          (t.name && t.name.trim() !== '' && t.utr_number && t.utr_number.trim() !== '')
        );
        return cleanRecord(valid);
      }
    } catch (e1) {
      console.warn('Supabase getAllTickets order=id.desc failed, trying plain query:', e1.message);
      try {
        let data = await supabaseFetch(`tickets?select=id,request_code,ticket_code,name,email,phone,emergency_contact,utr_number,status,submitted_at,approved_at,approved_by,checked_in,check_in_time`);
        if (Array.isArray(data)) {
          const valid = data.filter(t => 
            (t.status || '').trim().toUpperCase() === 'APPROVED' || 
            (t.name && t.name.trim() !== '' && t.utr_number && t.utr_number.trim() !== '')
          );
          return cleanRecord(valid);
        }
      } catch (e2) {
        console.error('Supabase getAllTickets plain query error:', e2.message);
      }
    }
  }

  if (db) {
    try {
      const stmt = db.prepare("SELECT id, request_code, ticket_code, name, email, phone, emergency_contact, utr_number, status, submitted_at, approved_at, approved_by, checked_in, check_in_time FROM tickets ORDER BY id DESC");
      return cleanRecord(stmt.all());
    } catch (e) {
      console.error('SQLite getAllTickets error:', e.message);
    }
  }

  return [];
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
      message: `Payment Approved by ${adminUsername}! Ticket ${ticketCode} generated and ready for PDF download.`,
      ticket: cleanRecord(result[0])
    };
  }

  const stmt = db.prepare("SELECT * FROM tickets WHERE request_code = ? AND status = 'PENDING'");
  const ticket = stmt.get(requestCode);

  const updatedTicket = db.prepare('SELECT * FROM tickets WHERE request_code = ?').get(requestCode);

  return {
    success: true,
    message: `Payment Approved by ${adminUsername}! Ticket ${ticketCode} generated and ready for PDF download.`,
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

async function deleteTicket(code, adminUsername) {
  const c = (code || '').trim();
  if (!c) return { success: false, message: 'Ticket code is required' };

  if (useSupabase) {
    try {
      await supabaseFetch(`tickets?or=(ticket_code.eq.${encodeURIComponent(c)},request_code.eq.${encodeURIComponent(c)})`, {
        method: 'DELETE'
      });
      return { success: true, message: `Ticket "${c}" permanently deleted by ${adminUsername}.` };
    } catch (e) {
      console.error('Supabase deleteTicket error:', e.message);
      return { success: false, message: 'Failed to delete ticket: ' + e.message };
    }
  }

  const stmt = db.prepare("DELETE FROM tickets WHERE ticket_code = ? OR request_code = ?");
  const info = stmt.run(c, c);

  if (info.changes > 0) {
    return { success: true, message: `Ticket "${c}" permanently deleted by ${adminUsername}.` };
  }
  return { success: false, message: `Ticket "${c}" not found.` };
}

async function purgeJunkPending(adminUsername) {
  if (useSupabase) {
    try {
      await supabaseFetch(`tickets?status=eq.PENDING&or=(name.is.null,name.eq.,request_code.is.null)`, {
        method: 'DELETE'
      });
      return { success: true, message: `Orphaned junk pending records cleaned up by ${adminUsername}.` };
    } catch (e) {
      console.error('Supabase purgeJunkPending error:', e.message);
      return { success: false, message: 'Purge failed: ' + e.message };
    }
  }

  if (db) {
    try {
      const stmt = db.prepare("DELETE FROM tickets WHERE status = 'PENDING' AND (name IS NULL OR name = '' OR request_code IS NULL)");
      const info = stmt.run();
      return { success: true, message: `Cleaned ${info.changes} junk pending records by ${adminUsername}.` };
    } catch (e) {
      return { success: false, message: 'Purge error: ' + e.message };
    }
  }
  return { success: false, message: 'Datastore unavailable' };
}

async function clearAllPending(adminUsername) {
  if (useSupabase) {
    try {
      await supabaseFetch(`tickets?status=eq.PENDING`, {
        method: 'DELETE'
      });
      return { success: true, message: `All test pending records successfully deleted by ${adminUsername}.` };
    } catch (e) {
      console.error('Supabase clearAllPending error:', e.message);
      return { success: false, message: 'Delete failed: ' + e.message };
    }
  }

  if (db) {
    try {
      const stmt = db.prepare("DELETE FROM tickets WHERE status = 'PENDING'");
      const info = stmt.run();
      return { success: true, message: `Deleted ${info.changes} pending records by ${adminUsername}.` };
    } catch (e) {
      return { success: false, message: 'Delete error: ' + e.message };
    }
  }
  return { success: false, message: 'Datastore unavailable' };
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
  verifyGateTicket,
  deleteTicket,
  purgeJunkPending,
  clearAllPending
};
