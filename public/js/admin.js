// Organizer Admin & Multi-Admin Credential Login Controller
(function() {
  let currentAdmin = null; // { username, name, password }

  document.addEventListener('DOMContentLoaded', () => {
    const adminModal = document.getElementById('adminModal');
    const adminNavBtn = document.getElementById('adminNavBtn');
    const authAdminBtn = document.getElementById('authAdminBtn');

    const adminUsernameInput = document.getElementById('adminUsernameInput');
    const adminPasswordInput = document.getElementById('adminPasswordInput');
    const adminLogoutBtn = document.getElementById('adminLogoutBtn');

    const tabPendingBtn = document.getElementById('tabPendingBtn');
    const tabCheckInBtn = document.getElementById('tabCheckInBtn');
    const panelPendingApprovals = document.getElementById('panelPendingApprovals');
    const panelGateCheckIn = document.getElementById('panelGateCheckIn');

    const verifyScanBtn = document.getElementById('verifyScanBtn');
    const scanCodeInput = document.getElementById('scanCodeInput');

    // Open Admin Modal
    ['adminNavBtn', 'dockAdminBtn'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', () => {
        checkExistingSession();
        adminModal.classList.add('active');
      });
    });

    document.getElementById('closeAdminModal')?.addEventListener('click', () => {
      adminModal.classList.remove('active');
    });

    // Login Triggers
    authAdminBtn?.addEventListener('click', () => authenticateAdmin());
    adminUsernameInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') adminPasswordInput.focus();
    });
    adminPasswordInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') authenticateAdmin();
    });

    // Logout
    adminLogoutBtn?.addEventListener('click', () => {
      sessionStorage.removeItem('thakrutha_admin_session');
      currentAdmin = null;
      document.getElementById('adminDashboardArea').style.display = 'none';
      document.getElementById('adminPinArea').style.display = 'block';
    });

    // Tab Switching
    tabPendingBtn?.addEventListener('click', () => {
      tabPendingBtn.classList.add('btn-primary');
      tabPendingBtn.classList.remove('btn-outline');
      tabCheckInBtn.classList.remove('btn-primary');
      tabCheckInBtn.classList.add('btn-outline');

      panelPendingApprovals.style.display = 'block';
      panelGateCheckIn.style.display = 'none';
    });

    tabCheckInBtn?.addEventListener('click', () => {
      tabCheckInBtn.classList.add('btn-primary');
      tabCheckInBtn.classList.remove('btn-outline');
      tabPendingBtn.classList.remove('btn-primary');
      tabPendingBtn.classList.add('btn-outline');

      panelGateCheckIn.style.display = 'block';
      panelPendingApprovals.style.display = 'none';
    });

    verifyScanBtn?.addEventListener('click', () => verifyScanCode());
    scanCodeInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') verifyScanCode();
    });

    function checkExistingSession() {
      const saved = sessionStorage.getItem('thakrutha_admin_session');
      if (saved) {
        try {
          currentAdmin = JSON.parse(saved);
          showDashboardView();
          reloadAdminPendingData();
        } catch (e) {
          sessionStorage.removeItem('thakrutha_admin_session');
        }
      }
    }

    async function authenticateAdmin() {
      const username = adminUsernameInput.value.trim();
      const password = adminPasswordInput.value.trim();

      if (!username || !password) {
        alert('Please enter both Username and Password.');
        return;
      }

      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          alert('Login Failed: ' + (data.message || 'Invalid Username or Password!'));
          return;
        }

        currentAdmin = {
          username: data.admin.username,
          name: data.admin.name,
          password: password
        };

        sessionStorage.setItem('thakrutha_admin_session', JSON.stringify(currentAdmin));
        window.location.href = '/admin.html';

      } catch (err) {
        alert('Authentication server error: ' + err.message);
      }
    }

    function showDashboardView() {
      if (!currentAdmin) return;
      document.getElementById('adminSessionLabel').textContent = `${currentAdmin.name} (${currentAdmin.username})`;
      document.getElementById('adminPinArea').style.display = 'none';
      document.getElementById('adminDashboardArea').style.display = 'block';
    }

    async function reloadAdminPendingData() {
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
          renderDashboard(pendingData.pending, allData.tickets, allData.stats);
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

      // 1. Pending Approvals Table
      const pendingTbody = document.getElementById('adminPendingTableBody');
      if (pendingTbody) {
        if (!pendingList || pendingList.length === 0) {
          pendingTbody.innerHTML = `
            <tr>
              <td colspan="5" style="padding: 24px; text-align: center; color: var(--text-muted);">
                🎉 No pending payment approvals! All submissions are reviewed.
              </td>
            </tr>
          `;
        } else {
          pendingTbody.innerHTML = pendingList.map(item => `
            <tr style="border-bottom: 1px solid var(--border-gold);">
              <td style="padding: 12px; font-weight: 800; font-family: monospace; color: var(--marigold-bright);">${item.request_code}</td>
              <td style="padding: 12px; font-weight: 600;">${item.name}</td>
              <td style="padding: 12px; font-size: 0.85rem; color: var(--text-secondary);">${item.phone}<br>${item.email}</td>
              <td style="padding: 12px; font-family: monospace; font-size: 1rem; color: var(--gold-primary); font-weight: 700;">${item.utr_number}</td>
              <td style="padding: 12px; text-align: center;">
                <button class="btn btn-primary btn-sm btn-approve-utr" data-code="${item.request_code}" style="padding: 6px 14px; font-size: 0.8rem; margin-right: 6px;">
                  ✅ Approve
                </button>
                <button class="btn btn-outline btn-sm btn-reject-utr" data-code="${item.request_code}" style="padding: 6px 12px; font-size: 0.8rem; color: #EF4444; border-color: #EF4444;">
                  ❌ Reject
                </button>
              </td>
            </tr>
          `).join('');

          // Attach Approve / Reject triggers
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
          guestTbody.innerHTML = '<tr><td colspan="4" style="padding: 16px; text-align: center; color: var(--text-muted);">No approved tickets yet.</td></tr>';
        } else {
          guestTbody.innerHTML = approvedTickets.map(t => `
            <tr style="border-bottom: 1px solid var(--border-gold);">
              <td style="padding: 10px; font-weight: 800; font-family: monospace; color: var(--gold-primary);">${t.ticket_code}</td>
              <td style="padding: 10px; font-weight: 600;">${t.name}</td>
              <td style="padding: 10px;">${t.phone}</td>
              <td style="padding: 10px;">
                ${t.checked_in === 1 
                  ? '<span style="color: #4ADE80; font-weight: 800;">✅ Checked-In</span>' 
                  : '<span style="color: var(--marigold-bright); font-weight: 700;">⏳ Active</span>'}
                ${t.approved_by ? `<div style="font-size: 0.72rem; color: var(--text-muted);">Approved by ${t.approved_by}</div>` : ''}
              </td>
            </tr>
          `).join('');
        }
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
          reloadAdminPendingData();
          window.fetchStats?.();
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
          reloadAdminPendingData();
          window.fetchStats?.();
        } else {
          alert(`Rejection Error: ${data.message}`);
        }
      } catch (err) {
        alert(`Network Error rejecting: ${err.message}`);
      }
    }

    async function verifyScanCode() {
      if (!currentAdmin) return;
      const code = scanCodeInput.value.trim();
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
            <div style="background: #166534; color: #DCFCE7; padding: 12px; border-radius: var(--radius-sm);">
              ✅ ${data.message}
            </div>
          `;
          scanCodeInput.value = '';
          reloadAdminPendingData();
        } else {
          notice.innerHTML = `
            <div style="background: #991B1B; color: #FEE2E2; padding: 12px; border-radius: var(--radius-sm);">
              🛑 ${data.message}
            </div>
          `;
        }
      } catch (err) {
        notice.innerHTML = `<span style="color: red;">Scan error: ${err.message}</span>`;
      }
    }

    window.reloadAdminPending = reloadAdminPendingData;
  });
})();
