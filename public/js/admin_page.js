// Standalone Admin Dashboard Controller (admin.html)
(function() {
  let currentAdmin = null;
  let newQrBase64 = null;

  document.addEventListener('DOMContentLoaded', () => {
    // 1. Session Guard
    const saved = sessionStorage.getItem('thakrutha_admin_session');
    if (!saved) {
      alert('Please log in through the main portal to access the Admin Dashboard.');
      window.location.href = '/';
      return;
    }

    try {
      currentAdmin = JSON.parse(saved);
      document.getElementById('adminSessionName').textContent = `${currentAdmin.name} (${currentAdmin.username})`;
    } catch (e) {
      window.location.href = '/';
      return;
    }

    // 2. Logout Handler
    document.getElementById('adminLogoutPageBtn')?.addEventListener('click', () => {
      sessionStorage.removeItem('thakrutha_admin_session');
      window.location.href = '/';
    });

    // Close Proof Modal
    document.getElementById('closeProofModal')?.addEventListener('click', () => {
      document.getElementById('screenshotProofModal')?.classList.remove('active');
    });
    document.getElementById('closeProofBtn')?.addEventListener('click', () => {
      document.getElementById('screenshotProofModal')?.classList.remove('active');
    });

    // 3. Tab Switching
    const tabPendingBtn = document.getElementById('tabPendingBtn');
    const tabQrManagerBtn = document.getElementById('tabQrManagerBtn');
    const tabAttendeesBtn = document.getElementById('tabAttendeesBtn');
    const tabCreateTicketBtn = document.getElementById('tabCreateTicketBtn');

    const panelPendingApprovals = document.getElementById('panelPendingApprovals');
    const panelQrManager = document.getElementById('panelQrManager');
    const panelAttendees = document.getElementById('panelAttendees');
    const panelCreateTicket = document.getElementById('panelCreateTicket');

    tabPendingBtn?.addEventListener('click', () => {
      setActiveTab(tabPendingBtn, panelPendingApprovals);
      reloadDashboardData();
    });

    tabQrManagerBtn?.addEventListener('click', () => {
      setActiveTab(tabQrManagerBtn, panelQrManager);
      loadSettingsData();
    });

    tabAttendeesBtn?.addEventListener('click', () => {
      setActiveTab(tabAttendeesBtn, panelAttendees);
      reloadDashboardData();
    });

    tabCreateTicketBtn?.addEventListener('click', () => {
      setActiveTab(tabCreateTicketBtn, panelCreateTicket);
    });

    function setActiveTab(activeBtn, activePanel) {
      [tabPendingBtn, tabQrManagerBtn, tabAttendeesBtn, tabCreateTicketBtn].forEach(btn => {
        btn?.classList.remove('btn-primary', 'active');
        btn?.classList.add('btn-outline');
      });
      activeBtn?.classList.add('btn-primary', 'active');
      activeBtn?.classList.remove('btn-outline');

      [panelPendingApprovals, panelQrManager, panelAttendees, panelCreateTicket].forEach(panel => {
        if (panel) panel.style.display = 'none';
      });
      if (activePanel) activePanel.style.display = 'block';
    }

    // Refresh pending list
    document.getElementById('refreshPendingBtn')?.addEventListener('click', () => reloadDashboardData());

    // Gate Scanner Simulator
    document.getElementById('verifyScanBtn')?.addEventListener('click', () => verifyScanCode());
    document.getElementById('scanCodeInput')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') verifyScanCode();
    });

    // Export CSV
    document.getElementById('exportCsvBtn')?.addEventListener('click', () => exportAttendeesCsv());

    // Direct Ticket Creation Form Submit (For Cash / Offline / Non-GPay Attendees)
    document.getElementById('createDirectTicketForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('directName').value.trim();
      const email = document.getElementById('directEmail').value.trim();
      const phone = document.getElementById('directPhone').value.trim();
      const emergencyContact = document.getElementById('directEmergency').value.trim();
      const paymentNotes = document.getElementById('directNote').value.trim();

      try {
        const res = await fetch('/api/admin/create-ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            email,
            phone,
            emergencyContact,
            paymentNotes,
            username: currentAdmin.username,
            password: currentAdmin.password
          })
        });
        const data = await res.json();

        if (data.success) {
          const area = document.getElementById('directTicketResultArea');
          area.style.display = 'block';
          area.innerHTML = `
            <div style="background: rgba(74, 222, 128, 0.12); border: 1.5px solid #4ADE80; border-radius: var(--radius-md); padding: 20px; text-align: center;">
              <h4 style="color: #4ADE80; font-size: 1.2rem; margin-bottom: 8px;">✅ Ticket Issued & Ready!</h4>
              <p style="font-size: 0.95rem; color: var(--text-primary); margin-bottom: 8px;">Attendee: <strong>${data.ticket.name}</strong></p>
              <p style="font-size: 0.95rem; color: var(--text-primary); margin-bottom: 14px;">Official Ticket Code: <strong style="color: var(--gold-primary); font-family: monospace; font-size: 1.25rem;">${data.ticket.ticket_code}</strong></p>
              <div style="display: flex; gap: 10px; justify-content: center; margin-top: 14px; flex-wrap: wrap;">
                <a href="/ticket.html?code=${data.ticket.ticket_code}" target="_blank" class="btn btn-primary btn-sm">🔗 Open & Download PDF Pass</a>
              </div>
            </div>
          `;

          document.getElementById('createDirectTicketForm').reset();
          reloadDashboardData();
        } else {
          alert('Error creating ticket: ' + (data.message || data.error));
        }
      } catch (err) {
        alert('Network error creating direct ticket: ' + err.message);
      }
    });

    // QR Code Image File Upload Preview
    const qrFileInput = document.getElementById('qrFileInput');
    qrFileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(evt) {
        newQrBase64 = evt.target.result;
        document.getElementById('newQrPreviewImg').src = newQrBase64;
        document.getElementById('qrPreviewArea').style.display = 'block';
      };
      reader.readAsDataURL(file);
    });

    // Update QR & UPI ID Form Submit
    document.getElementById('updateQrForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const upiId = document.getElementById('newUpiIdInput').value.trim();

      try {
        const res = await fetch('/api/admin/update-qr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: currentAdmin.username,
            password: currentAdmin.password,
            upiId: upiId,
            qrBase64: newQrBase64
          })
        });
        const data = await res.json();

        if (data.success) {
          alert('✅ ' + data.message);
          loadSettingsData();
        } else {
          alert('Update failed: ' + data.message);
        }
      } catch (err) {
        alert('Network Error updating QR code: ' + err.message);
      }
    });

    // Load initial data and set 10-second automatic real-time dashboard refresh
    reloadDashboardData();
    loadSettingsData();
    setInterval(reloadDashboardData, 10000);
  });

  async function loadSettingsData() {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (res.ok) {
        document.getElementById('activeQrImgDisplay').src = data.upiQrUrl;
        document.getElementById('activeUpiIdDisplay').textContent = data.upiId;
        document.getElementById('newUpiIdInput').value = data.upiId;
      }
    } catch (e) {
      console.error('Error loading settings:', e);
    }
  }

  async function reloadDashboardData() {
    if (!currentAdmin) return;

    try {
      const { username, password } = currentAdmin;
      const [pendingRes, allRes] = await Promise.all([
        fetch(`/api/admin/pending-payments?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`),
        fetch(`/api/admin/tickets?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`)
      ]);

      const pendingData = await pendingRes.json();
      const allData = await allRes.json();

      if (pendingRes.ok && allRes.ok) {
        renderDashboard(pendingData.pending || [], allData.tickets || [], allData.stats || {});
      } else {
        const errMsg = pendingData.error || pendingData.message || allData.error || allData.message || 'API authentication or database error';
        console.error('Admin API error:', errMsg);
        const datastoreEl = document.getElementById('datastoreEngineNotice');
        if (datastoreEl) {
          datastoreEl.innerHTML = `<div style="background: rgba(239, 68, 68, 0.2); border: 1.5px solid #EF4444; color: #FCA5A5; padding: 14px; border-radius: var(--radius-md); font-weight: 700; text-align: center;">🛑 Admin API Error: ${errMsg}. Please log out and log in again with authorized admin credentials.</div>`;
        }
      }
    } catch (err) {
      console.error('Error reloading admin data:', err);
    }
  }

  function renderDashboard(pendingList, allTickets, stats) {
    document.getElementById('admBooked').textContent = stats.ticketsBooked;
    document.getElementById('admPendingCount').textContent = stats.pendingApprovals;
    document.getElementById('tabPendingBadge').textContent = stats.pendingApprovals;
    document.getElementById('admCheckedIn').textContent = stats.checkedInCount;
    document.getElementById('admRevenue').textContent = `₹${stats.totalRevenue}`;

    const datastoreEl = document.getElementById('datastoreEngineNotice');
    if (datastoreEl && stats.datastoreEngine) {
      if (stats.datastoreEngine.includes('Supabase')) {
        datastoreEl.innerHTML = `<div style="background: rgba(74, 222, 128, 0.15); border: 1px solid #4ADE80; color: #4ADE80; padding: 10px; border-radius: var(--radius-md); font-weight: 700;">🟢 Datastore Engine: Connected to Supabase Cloud Database</div>`;
      } else {
        datastoreEl.innerHTML = `<div style="background: rgba(255, 158, 0, 0.15); border: 1.5px solid #FF9E00; color: #FFD700; padding: 12px; border-radius: var(--radius-md); font-weight: 700; line-height: 1.5;">⚠️ Datastore Engine: Running in Local Serverless Fallback (/tmp/thakrutha.db)<br><span style="font-size: 0.82rem; font-weight: 400; color: var(--text-secondary);">Add <code>SUPABASE_URL</code> and <code>SUPABASE_KEY</code> to your Vercel Project Environment Variables so attendee submissions persist across serverless instances!</span></div>`;
      }
    }

    // 1. Pending Approvals Table
    const pendingTbody = document.getElementById('adminPendingTableBody');
    if (pendingTbody) {
      if (!pendingList || pendingList.length === 0) {
        pendingTbody.innerHTML = `
          <tr>
            <td colspan="6" style="padding: 24px; text-align: center; color: var(--text-muted);">
              🎉 No pending payment approvals! All submissions are reviewed.
            </td>
          </tr>
        `;
      } else {
        pendingTbody.innerHTML = pendingList.map(item => `
          <tr style="border-bottom: 1px solid var(--border-gold);">
            <td style="padding: 14px; font-weight: 800; font-family: monospace; color: var(--marigold-bright);">${item.request_code}</td>
            <td style="padding: 14px; font-weight: 600;">${item.name}</td>
            <td style="padding: 14px; font-size: 0.88rem; color: var(--text-secondary);">${item.phone}<br>${item.email}</td>
            <td style="padding: 14px; font-family: monospace; font-size: 1.1rem; color: var(--gold-primary); font-weight: 800;">${item.utr_number}</td>
            <td style="padding: 14px; text-align: center;">
              ${item.payment_screenshot ? `
                <button class="btn btn-secondary btn-sm btn-view-screenshot" data-img="${encodeURIComponent(item.payment_screenshot)}" data-name="${item.name}" data-code="${item.request_code}" style="padding: 6px 12px; font-size: 0.82rem;">
                  🖼️ View Screenshot
                </button>
              ` : '<span style="color: var(--text-muted); font-size: 0.8rem;">No Image</span>'}
            </td>
            <td style="padding: 14px; text-align: center;">
              <button class="btn btn-primary btn-sm btn-approve-utr" data-code="${item.request_code}" style="padding: 8px 16px; font-size: 0.85rem; margin-right: 8px;">
                ✅ Approve
              </button>
              <button class="btn btn-outline btn-sm btn-reject-utr" data-code="${item.request_code}" style="padding: 8px 14px; font-size: 0.85rem; color: #EF4444; border-color: #EF4444;">
                ❌ Reject
              </button>
            </td>
          </tr>
        `).join('');

        document.querySelectorAll('.btn-view-screenshot').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const rawImg = decodeURIComponent(e.currentTarget.getAttribute('data-img'));
            const name = e.currentTarget.getAttribute('data-name');
            const code = e.currentTarget.getAttribute('data-code');

            const modal = document.getElementById('screenshotProofModal');
            const imgEl = document.getElementById('proofModalImg');
            const subText = document.getElementById('proofModalSubText');

            if (imgEl && modal) {
              imgEl.src = rawImg;
              if (subText) subText.textContent = `Payment Receipt Proof for ${name} (${code})`;
              modal.classList.add('active');
            }
          });
        });

        document.querySelectorAll('.btn-approve-utr').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const requestCode = e.currentTarget.getAttribute('data-code');
            approveSubmission(requestCode);
          });
        });

        document.querySelectorAll('.btn-reject-utr').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const requestCode = e.currentTarget.getAttribute('data-code');
            rejectSubmission(requestCode);
          });
        });
      }
    }

    // 2. Approved Guest List Table
    const guestTbody = document.getElementById('adminGuestListBody');
    if (guestTbody && allTickets) {
      const approvedTickets = allTickets.filter(t => t.status === 'APPROVED');
      if (approvedTickets.length === 0) {
        guestTbody.innerHTML = '<tr><td colspan="8" style="padding: 20px; text-align: center; color: var(--text-muted);">No approved tickets yet.</td></tr>';
      } else {
        guestTbody.innerHTML = approvedTickets.map(t => `
          <tr style="border-bottom: 1px solid var(--border-gold);">
            <td style="padding: 12px; font-weight: 800; font-family: monospace; color: var(--gold-primary);">${t.ticket_code}</td>
            <td style="padding: 12px; font-weight: 600;">${t.name}</td>
            <td style="padding: 12px;">${t.phone}</td>
            <td style="padding: 12px;">${t.email}</td>
            <td style="padding: 12px;">${t.emergency_contact}</td>
            <td style="padding: 12px; font-family: monospace; color: var(--gold-light);">${t.approved_by || 'system'}</td>
            <td style="padding: 12px;">
              ${t.checked_in === 1 
                ? '<span style="color: #4ADE80; font-weight: 800;">✅ Checked-In</span>' 
                : '<span style="color: var(--marigold-bright); font-weight: 700;">⏳ Active</span>'}
            </td>
            <td style="padding: 12px; text-align: center;">
              <button class="btn btn-outline btn-sm btn-delete-ticket" data-code="${t.ticket_code || t.request_code}" style="color: #EF4444; border-color: #EF4444; padding: 4px 10px; font-size: 0.8rem;">
                🗑️ Delete
              </button>
            </td>
          </tr>
        `).join('');

        document.querySelectorAll('.btn-delete-ticket').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const code = e.currentTarget.getAttribute('data-code');
            deleteTicket(code);
          });
        });
      }
    }
  }

  async function deleteTicket(code) {
    if (!currentAdmin) return;
    if (!confirm(`Are you sure you want to PERMANENTLY DELETE & REVOKE ticket "${code}"? The attendee will no longer be granted entry.`)) return;

    try {
      const res = await fetch('/api/admin/delete-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          username: currentAdmin.username,
          password: currentAdmin.password
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`🗑️ ${data.message}`);
        reloadDashboardData();
      } else {
        alert(`Delete Error: ${data.message}`);
      }
    } catch (err) {
      alert(`Network Error deleting ticket: ${err.message}`);
    }
  }

  async function approveSubmission(requestCode) {
    if (!currentAdmin) return;
    if (!confirm(`Approve payment for ${requestCode} as ${currentAdmin.username}?`)) return;

    try {
      const res = await fetch('/api/admin/approve-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestCode,
          username: currentAdmin.username,
          password: currentAdmin.password
        })
      });
      const data = await res.json();

      if (data.success) {
        alert(`✅ ${data.message}`);
        reloadDashboardData();
      } else {
        alert(`Approval Error: ${data.message}`);
      }
    } catch (err) {
      alert(`Network Error approving: ${err.message}`);
    }
  }

  async function rejectSubmission(requestCode) {
    if (!currentAdmin) return;
    if (!confirm(`Reject payment request ${requestCode} as ${currentAdmin.username}?`)) return;

    try {
      const res = await fetch('/api/admin/reject-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestCode,
          username: currentAdmin.username,
          password: currentAdmin.password,
          reason: 'Invalid UTR'
        })
      });
      const data = await res.json();

      if (data.success) {
        alert(`❌ ${data.message}`);
        reloadDashboardData();
      } else {
        alert(`Rejection Error: ${data.message}`);
      }
    } catch (err) {
      alert(`Network Error rejecting: ${err.message}`);
    }
  }

  async function verifyScanCode() {
    if (!currentAdmin) return;
    const input = document.getElementById('scanCodeInput');
    const code = input.value.trim();
    const notice = document.getElementById('scanResultNotice');
    if (!code) return;

    notice.innerHTML = '<span style="color: yellow;">Verifying ticket code...</span>';

    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          username: currentAdmin.username,
          password: currentAdmin.password
        })
      });
      const data = await res.json();

      if (data.success) {
        notice.innerHTML = `
          <div style="background: rgba(74, 222, 128, 0.2); border: 2px solid #4ADE80; color: #4ADE80; padding: 16px; border-radius: var(--radius-md); font-size: 1.05rem; text-align: center; font-weight: 800; box-shadow: 0 0 25px rgba(74, 222, 128, 0.4);">
            🟢 ${data.message}
            <div style="margin-top: 10px;">
              <button class="btn btn-secondary btn-sm" onclick="document.getElementById('startCameraBtn').click()">⚡ Scan Next Ticket</button>
            </div>
          </div>
        `;
        input.value = '';
        reloadDashboardData();
      } else {
        notice.innerHTML = `
          <div style="background: rgba(239, 68, 68, 0.2); border: 2px solid #EF4444; color: #FCA5A5; padding: 16px; border-radius: var(--radius-md); font-size: 1.05rem; text-align: center; font-weight: 800; box-shadow: 0 0 25px rgba(239, 68, 68, 0.4);">
            🔴 ${data.message}
            <div style="margin-top: 10px;">
              <button class="btn btn-secondary btn-sm" onclick="document.getElementById('startCameraBtn').click()">⚡ Scan Next Ticket</button>
            </div>
          </div>
        `;
      }
    } catch (err) {
      notice.innerHTML = `<span style="color: red;">Scan error: ${err.message}</span>`;
    }
  }

  // Phone Camera Scanner Setup
  let html5QrScanner = null;

  document.getElementById('startCameraBtn')?.addEventListener('click', startPhoneCameraScanner);
  document.getElementById('stopCameraBtn')?.addEventListener('click', stopPhoneCameraScanner);

  document.getElementById('uploadQrFileInput')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const notice = document.getElementById('scanResultNotice');
    notice.innerHTML = '<span style="color: var(--gold-light);">⌛ Scanning QR Code from image...</span>';

    try {
      if (!window.Html5Qrcode) {
        alert('Scanner engine initializing... Please try again in 2 seconds.');
        return;
      }
      const scanner = new Html5Qrcode('interactiveCameraReader');
      const qrCodeText = await scanner.scanFile(file, true);
      document.getElementById('scanCodeInput').value = qrCodeText;
      verifyScanCode();
    } catch (err) {
      notice.innerHTML = `<div style="background: rgba(239, 68, 68, 0.2); border: 1px solid #EF4444; color: #FCA5A5; padding: 12px; border-radius: var(--radius-md);">❌ Could not detect QR code in uploaded image. Please ensure the QR code is clear or enter the code manually.</div>`;
    }
  });

  async function startPhoneCameraScanner() {
    const wrapper = document.getElementById('cameraScannerWrapper');
    const notice = document.getElementById('scanResultNotice');

    if (!window.Html5Qrcode) {
      alert('Camera library loading... Please try again in 2 seconds.');
      return;
    }

    wrapper.style.display = 'block';
    notice.innerHTML = '<span style="color: var(--gold-light);">📷 Starting camera... Point camera at E-Ticket QR Code.</span>';

    if (html5QrScanner) {
      stopPhoneCameraScanner();
    }

    html5QrScanner = new Html5Qrcode('interactiveCameraReader');
    const config = { fps: 15, qrbox: { width: 240, height: 240 } };

    const onScanSuccess = (qrCodeText) => {
      document.getElementById('scanCodeInput').value = qrCodeText;
      stopPhoneCameraScanner();
      verifyScanCode();
    };

    try {
      await html5QrScanner.start({ facingMode: 'environment' }, config, onScanSuccess, () => {});
    } catch (err1) {
      console.warn('facingMode environment start failed, trying camera list:', err1);
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          const backCam = cameras.find(c => c.label.toLowerCase().includes('back') || c.label.toLowerCase().includes('rear')) || cameras[cameras.length - 1];
          await html5QrScanner.start(backCam.id, config, onScanSuccess, () => {});
        } else {
          throw new Error('No camera found on device');
        }
      } catch (err2) {
        wrapper.style.display = 'none';
        alert('Camera access denied or unavailable: ' + (err2.message || err1.message));
      }
    }
  }

  function stopPhoneCameraScanner() {
    const wrapper = document.getElementById('cameraScannerWrapper');
    if (html5QrScanner) {
      html5QrScanner.stop().then(() => {
        html5QrScanner.clear();
        wrapper.style.display = 'none';
      }).catch(() => {
        wrapper.style.display = 'none';
      });
    } else {
      wrapper.style.display = 'none';
    }
  }

  function exportAttendeesCsv() {
    fetch(`/api/admin/tickets?username=${encodeURIComponent(currentAdmin.username)}&password=${encodeURIComponent(currentAdmin.password)}`)
      .then(res => res.json())
      .then(data => {
        if (!data.tickets) return;
        const rows = [
          ['Ticket Code', 'Request Code', 'Name', 'Email', 'Phone', 'Emergency Contact', 'UTR Number', 'Status', 'Approved By', 'Checked In']
        ];

        data.tickets.forEach(t => {
          rows.push([
            t.ticket_code || '',
            t.request_code || '',
            t.name || '',
            t.email || '',
            t.phone || '',
            t.emergency_contact || '',
            t.utr_number || '',
            t.status || '',
            t.approved_by || '',
            t.checked_in === 1 ? 'YES' : 'NO'
          ]);
        });

        const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', 'THAKRUTHA_2026_Attendees.csv');
        document.body.appendChild(link);
        link.click();
        link.remove();
      });
  }
})();
