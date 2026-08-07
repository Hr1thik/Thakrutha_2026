# 🌺 THAKRUTHA 2026 (താക്കൃഥ) - Grand Onam Celebration Ticketing Web App

A full-stack, responsive, and visually stunning web application built for the **THAKRUTHA 2026** Onam celebration event (August 23, 2026 | 09:00 AM - 07:00 PM).

---

## 🌟 Key Features

1. **Ultra-Premium Visual Aesthetic**:
   - Theme: Kerala Night Emerald (`#06120E`), Metallic Kasavu Gold (`#FFD700`), and Neon Marigold (`#FF6B00`).
   - Interactive Canvas Pookkalam Painter, smooth floating animations, glassmorphic backdrop filters, and dark luxury styling.

2. **Event & Schedule Highlights**:
   - **Date**: August 23, 2026 | **Time**: 09:00 AM - 07:00 PM
   - **Venue Notice**: *"📍 Venue Will Be Revealed Soon"*
   - **Registration Deadline**: **August 20th, 2026**
   - **Event Pass Rate**: **₹1100 / person**
   - **Program Schedule**:
     - `09:00 AM - 10:00 AM`: Pookkalam Inauguration & Welcome
     - `10:00 AM - 11:00 AM`: Grand Chendamelam Performance
     - `11:00 AM - 12:30 PM`: 💃 Onam Dance Showcase (Cinematic group dance)
     - `12:30 PM - 02:30 PM`: 🍲 100% Pure Veg Onam Sadhya Feast (Served on banana leaf)
     - `02:30 PM - 04:30 PM`: 🤼 Uri Adi & Vadam Vali Tournament
     - `04:30 PM - 07:00 PM`: 🎧 Sunset DJ Evening & Grand Finale

3. **Strict Event Rules & Enforcement**:
   - **Strictly Stag Entry Only**
   - **Strict Zero Tolerance Policy** (No Drugs and No Alcohol Allowed)
   - Mandatory checkbox verification before checkout.

4. **Manual UPI QR Payment & Approval System**:
   - Attendees scan the live **UPI QR Code** (₹1100 to active UPI ID) and input their **12-digit UPI UTR Transaction Reference Number**.
   - Receives reference receipt card (`REQ-2026-XXXX`).

5. **Multi-Admin Credentials & Audit Logging**:
   - **Admin Logins**:
     * `admin1` / `Thakrutha2023`
     * `admin2` / `Thakrutha2023`
     * `admin3` / `Thakrutha2023`
   - Standalone **Admin Portal Page** at `/admin.html` (or `/admin`).
   - Audit logs every approval & rejection (`Approved by admin1` / `admin2` / `admin3`).

6. **Dynamic UPI QR Code Manager (Admin Portal)**:
   - Admins can **upload a new QR Code image** (`.png`/`.jpg`) and update the live **UPI ID** in real time!

7. **Direct Ticket Issuance (Cash / Offline Attendees)**:
   - Admins can issue instant tickets (`TK-2026-XXXX`) for attendees who cannot pay via GPay/PhonePe (Cash, Bank Transfer, or VIP Pass).

8. **Dual Ticket Dispatch (Email & SMS)**:
   - Automatically dispatches simulated **Email & SMS notifications** to registered attendee phone numbers upon approval or direct issuance.

9. **Ticket Wallet & Gate Scanner**:
   - Search tickets by phone number, Ticket Code (`TK-2026-XXXX`), or UTR number.
   - Built-in Gate QR Code check-in scanner.
   - One-click **Export to CSV spreadsheet**.

---

## 🚀 Deployment Instructions (Pushing to Domain)

### Method 1: Deploying on any VPS / Linux Server (Ubuntu, AWS EC2, DigitalOcean, Hetzner)

1. **Clone or Copy Project**:
   ```bash
   git clone <your-repository-url>
   cd THAKRUTHA2026
   ```

2. **Install Node.js (v22 or higher recommended)**:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **Start Server with PM2 (Process Manager)**:
   ```bash
   sudo npm install -g pm2
   pm2 start server.js --name "thakrutha-app"
   pm2 save
   pm2 startup
   ```

4. **Configure Nginx Reverse Proxy with SSL (HTTPS)**:
   ```nginx
   server {
       server_name yourdomain.com www.yourdomain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

5. **Enable SSL Certbot**:
   ```bash
   sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
   ```

---

### Method 2: Deploying on Render / Railway / Heroku

1. Connect your GitHub repository to **Render** or **Railway**.
2. Set Build Command: `npm install`
3. Set Start Command: `npm start`
4. Set Environment Variable (Optional): `PORT=3000`

---

## 🔑 Default Admin Access

- **Admin Login Page**: `http://yourdomain.com/admin.html`
- **Usernames**: `admin1`, `admin2`, `admin3`
- **Password**: `Thakrutha2023`

---

## 📁 Project Structure

```
THAKRUTHA2026/
├── server.js            # Node.js HTTP Server & REST API endpoints
├── db.js                # Built-in SQLite datastore (Tickets, Settings, Audit)
├── package.json         # Production manifest & scripts
├── README.md            # Documentation & Deployment guide
└── public/
    ├── index.html       # Main Landing Page, Booking Wizard & Modals
    ├── admin.html       # Standalone Admin Portal Dashboard
    ├── css/
    │   ├── styles.css   # Dark & Kasavu Gold luxury design system
    │   └── animations.css # Floating marigold & hero animations
    ├── js/
    │   ├── app.js       # Main SPA controller
    │   ├── admin.html   # Standalone Admin Portal Page
    │   ├── admin_page.js # Standalone Admin Portal JavaScript controller
    │   ├── admin.js     # Admin login auth controller
    │   ├── booking.js   # 2-Step UPI UTR checkout & E-Ticket generator
    │   ├── wallet.js    # Ticket search & pass lookup
    │   ├── pookkalam.js # Interactive Pookkalam canvas painter
    │   └── countdown.js # Event countdown timer
    └── images/
        ├── upi_qr.png   # Default UPI Payment QR code
        ├── hero_banner.png
        └── sadhya_banner.png
```

---

## 📄 License
Designed for **THAKRUTHA 2026** Onam Celebration. MIT License.
