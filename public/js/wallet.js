// Ticket Wallet & Pass Lookup Controller
(function() {
  document.addEventListener('DOMContentLoaded', () => {
    const walletModal = document.getElementById('walletModal');
    const walletNavBtn = document.getElementById('walletNavBtn');
    const searchWalletBtn = document.getElementById('searchWalletBtn');
    const walletQueryInput = document.getElementById('walletQueryInput');
    const walletResultsArea = document.getElementById('walletResultsArea');

    ['walletNavBtn', 'dockWalletBtn'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', () => {
        walletModal.classList.add('active');
      });
    });

    document.getElementById('closeWalletModal')?.addEventListener('click', () => {
      walletModal.classList.remove('active');
    });

    searchWalletBtn?.addEventListener('click', () => performWalletSearch());
    walletQueryInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') performWalletSearch();
    });

    async function performWalletSearch() {
      const q = walletQueryInput.value.trim();
      if (!q) {
        alert('Please enter a Phone Number, Request Code, Ticket Code, or UTR Number.');
        return;
      }

      walletResultsArea.innerHTML = '<div style="text-align: center; color: var(--text-muted);">Searching wallet records...</div>';

      try {
        const res = await fetch(`/api/tickets/lookup?q=${encodeURIComponent(q)}`);
        const data = await res.json();

        if (!res.ok || !data.success || !data.tickets || data.tickets.length === 0) {
          walletResultsArea.innerHTML = `
            <div style="background: rgba(220,38,38,0.1); border: 1px solid #EF4444; padding: 16px; border-radius: var(--radius-md); text-align: center; color: #FCA5A5;">
              No matching submission or ticket found for "${q}". Please check your details.
            </div>
          `;
          return;
        }

        walletResultsArea.innerHTML = data.tickets.map(t => {
          const isApproved = t.status === 'APPROVED';
          return `
            <div style="background: var(--bg-card); border: 1.5px solid var(--border-gold); padding: 18px; border-radius: var(--radius-md); margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between;">
              <div>
                <div style="font-weight: 800; color: #FFF; font-size: 1.1rem;">${t.name}</div>
                <div style="font-size: 0.85rem; color: var(--marigold-bright); font-weight: 700; font-family: monospace;">
                  ${isApproved ? 'Ticket: ' + t.ticket_code : 'Request: ' + t.request_code}
                </div>
                <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">
                  UTR: <span style="font-family: monospace; color: var(--gold-primary);">${t.utr_number}</span> • Status: 
                  ${isApproved ? '✅ Approved' : '⏳ Pending Admin Verification'}
                </div>
              </div>

              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button class="btn btn-primary btn-sm view-pass-btn" data-req="${t.request_code}">
                  ${isApproved ? 'View Ticket Pass' : 'View Request Pass'}
                </button>
                <button class="btn btn-outline btn-sm download-pdf-wallet-btn" data-req="${t.request_code}">
                  📄 PDF
                </button>
              </div>
            </div>
          `;
        }).join('');

        document.querySelectorAll('.view-pass-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const reqCode = e.currentTarget.getAttribute('data-req');
            const found = data.tickets.find(tk => tk.request_code === reqCode);
            if (found) {
              walletModal.classList.remove('active');
              window.renderTicketPass(found);
              document.getElementById('ticketPassModal').classList.add('active');
            }
          });
        });

        document.querySelectorAll('.download-pdf-wallet-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const reqCode = e.currentTarget.getAttribute('data-req');
            const found = data.tickets.find(tk => tk.request_code === reqCode);
            if (found && window.downloadTicketAsPdf) {
              window.downloadTicketAsPdf(found);
            }
          });
        });

      } catch (err) {
        walletResultsArea.innerHTML = `<div style="color: red;">Error searching wallet: ${err.message}</div>`;
      }
    }
  });
})();
