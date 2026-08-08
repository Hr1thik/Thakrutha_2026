const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
  const pathname = url.pathname;

  // --- REST API ENDPOINTS ---
  if (pathname.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');

    // 1. Event Metadata
    if (pathname === '/api/event' && req.method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify({
        title: 'THAKRUTHA (താക്കൃഥ)',
        subtitle: 'Grand Onam Celebration 2026',
        date: 'August 23, 2026',
        time: '09:00 AM - 07:00 PM',
        registrationDeadline: 'August 20, 2026',
        venueStatus: 'Venue Will Be Revealed Soon',
        rules: ['Strictly stag entry only', 'No Drugs and Alcohol Allowed'],
        passPrice: 1100,
        passName: 'THAKRUTHA Stag Festival Pass'
      }));
      return;
    }

    // 2. Settings (UPI ID & QR Code Image URL)
    if (pathname === '/api/settings' && req.method === 'GET') {
      try {
        const upiQrUrl = await db.getSetting('upi_qr_url', 'images/upi_qr.png');
        const upiId = await db.getSetting('upi_id', 'thakrutha@upi');
        res.writeHead(200);
        res.end(JSON.stringify({ upiQrUrl, upiId }));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    // 3. Stats
    if (pathname === '/api/stats' && req.method === 'GET') {
      try {
        const stats = await db.getStats();
        res.writeHead(200);
        res.end(JSON.stringify(stats));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    // 4. Admin Login
    if (pathname === '/api/admin/login' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { username, password } = JSON.parse(body);
          const result = db.authenticateAdmin(username, password);

          if (result.success) {
            res.writeHead(200);
            res.end(JSON.stringify(result));
          } else {
            res.writeHead(401);
            res.end(JSON.stringify(result));
          }
        } catch (err) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Login error: ' + err.message }));
        }
      });
      return;
    }

    // 5. Admin Direct Ticket Creation (Offline / Cash / Complimentary)
    if (pathname === '/api/admin/create-ticket' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const { name, email, phone, emergencyContact, username, password } = JSON.parse(body);

          if (!db.isValidAdmin(username, password)) {
            res.writeHead(403);
            res.end(JSON.stringify({ success: false, message: 'Unauthorized Admin Credentials.' }));
            return;
          }

          if (!name || !email || !phone || !emergencyContact) {
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, message: 'All attendee fields are required.' }));
            return;
          }

          const result = await db.createDirectTicket({
            name,
            email,
            phone,
            emergencyContact,
            adminUsername: username
          });

          res.writeHead(201);
          res.end(JSON.stringify(result));

        } catch (err) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to create direct ticket: ' + err.message }));
        }
      });
      return;
    }

    // 6. Admin Update UPI ID & Upload QR Code
    if (pathname === '/api/admin/update-qr' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const { username, password, upiId, qrBase64 } = JSON.parse(body);

          if (!db.isValidAdmin(username, password)) {
            res.writeHead(403);
            res.end(JSON.stringify({ success: false, message: 'Unauthorized Admin Credentials.' }));
            return;
          }

          if (upiId) {
            await db.setSetting('upi_id', upiId.trim());
          }

          if (qrBase64) {
            const base64Data = qrBase64.replace(/^data:image\/\w+;base64,/, '');
            const filePath = path.join(PUBLIC_DIR, 'images', 'custom_upi_qr.png');
            try {
              fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
              await db.setSetting('upi_qr_url', 'images/custom_upi_qr.png?v=' + Date.now());
            } catch (e) {
              await db.setSetting('upi_qr_url', qrBase64);
            }
          }

          const upiQrUrl = await db.getSetting('upi_qr_url');
          const activeUpiId = await db.getSetting('upi_id');

          res.writeHead(200);
          res.end(JSON.stringify({
            success: true,
            message: 'UPI QR Code & ID updated successfully!',
            upiQrUrl,
            upiId: activeUpiId
          }));

        } catch (err) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Error updating QR Code: ' + err.message }));
        }
      });
      return;
    }

    // 7. Submit UPI UTR Payment Reference
    if (pathname === '/api/tickets/submit-payment' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);

          if (!data.name || !data.email || !data.phone || !data.emergencyContact || !data.utrNumber) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'All fields (Name, Email, Phone, Emergency Contact, and UTR Number) are required.' }));
            return;
          }

          if (!data.paymentScreenshot) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Payment screenshot proof is mandatory. Please upload your payment screenshot before submitting.' }));
            return;
          }

          if (data.utrNumber.trim().length < 6) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Please enter a valid 12-digit UPI Transaction / UTR Reference Number.' }));
            return;
          }

          if (!data.agreedToRules) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'You must agree to the event rules (Stag Entry & Zero Tolerance Policy) to submit.' }));
            return;
          }

          const result = await db.createTicketSubmission(data);
          res.writeHead(201);
          res.end(JSON.stringify(result));
        } catch (err) {
          console.error("submit-payment ERROR:", err);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Server error submitting payment: ' + err.message, stack: err.stack }));
        }
      });
      return;
    }

    // 8. Admin Pending Approvals List
    if (pathname === '/api/admin/pending-payments' && req.method === 'GET') {
      const username = url.searchParams.get('username');
      const password = url.searchParams.get('password');

      if (!db.isValidAdmin(username, password)) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: 'Unauthorized Admin Credentials.' }));
        return;
      }
      try {
        const pending = await db.getPendingSubmissions();
        const stats = await db.getStats();
        res.writeHead(200);
        res.end(JSON.stringify({ pending, stats }));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    // 9. Admin Approve Payment
    if (pathname === '/api/admin/approve-payment' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const { requestCode, username, password } = JSON.parse(body);
          if (!db.isValidAdmin(username, password)) {
            res.writeHead(403);
            res.end(JSON.stringify({ success: false, message: 'Invalid Admin Credentials!' }));
            return;
          }

          const result = await db.approvePayment(requestCode, username);
          res.writeHead(200);
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Approval failed: ' + err.message }));
        }
      });
      return;
    }

    // 10. Admin Reject Payment
    if (pathname === '/api/admin/reject-payment' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const { requestCode, username, password, reason } = JSON.parse(body);
          if (!db.isValidAdmin(username, password)) {
            res.writeHead(403);
            res.end(JSON.stringify({ success: false, message: 'Invalid Admin Credentials!' }));
            return;
          }

          const result = await db.rejectPayment(requestCode, username, reason);
          res.writeHead(200);
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Rejection failed: ' + err.message }));
        }
      });
      return;
    }

    // 11. Ticket Lookup
    if (pathname === '/api/tickets/lookup' && req.method === 'GET') {
      const q = url.searchParams.get('q') || url.searchParams.get('code') || url.searchParams.get('phone');
      if (q) {
        try {
          const tickets = await db.searchTickets(q);
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, tickets }));
        } catch (e) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: e.message }));
        }
      } else {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Search parameter q is required.' }));
      }
      return;
    }

    // 12. Gate QR Scanner Verify
    if (pathname === '/api/admin/verify' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const { code, username, password } = JSON.parse(body);
          if (!db.isValidAdmin(username, password)) {
            res.writeHead(403);
            res.end(JSON.stringify({ success: false, message: 'Invalid Admin Credentials!' }));
            return;
          }
          const result = await db.verifyGateTicket(code, username);
          res.writeHead(200);
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Verification error: ' + err.message }));
        }
      });
      return;
    }

    // 14. Admin Delete Ticket (Remove Ticket)
    if (pathname === '/api/admin/delete-ticket' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const { code, username, password } = JSON.parse(body);
          if (!db.isValidAdmin(username, password)) {
            res.writeHead(403);
            res.end(JSON.stringify({ success: false, message: 'Invalid Admin Credentials!' }));
            return;
          }

          const result = await db.deleteTicket(code, username);
          res.writeHead(200);
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Delete failed: ' + err.message }));
        }
      });
      return;
    }

    // 13. Admin All Tickets
    if (pathname === '/api/admin/tickets' && req.method === 'GET') {
      const username = url.searchParams.get('username');
      const password = url.searchParams.get('password');

      if (!db.isValidAdmin(username, password)) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: 'Unauthorized Admin Credentials.' }));
        return;
      }
      try {
        const tickets = await db.getAllTickets();
        const stats = await db.getStats();
        res.writeHead(200);
        res.end(JSON.stringify({ tickets, stats }));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'API Endpoint not found.' }));
    return;
  }

  // --- STATIC FILE SERVER ---
  let requestedFile = pathname === '/' ? 'index.html' : pathname;
  if (requestedFile === '/admin') requestedFile = 'admin.html';
  if (requestedFile === '/ticket') requestedFile = 'ticket.html';

  let filePath = path.join(PUBLIC_DIR, requestedFile);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (indexErr, indexContent) => {
          if (indexErr) {
            res.writeHead(404);
            res.end('File not found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
            res.end(indexContent);
          }
        });
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': mimeType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`🌺 THAKRUTHA (താക്കൃഥ) Onam Ticketing App running at http://localhost:${PORT}`);
});
