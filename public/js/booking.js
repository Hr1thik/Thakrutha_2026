// Ticket Booking Controller with Manual UPI UTR Submission
(function() {
  let currentRecord = null;

  document.addEventListener('DOMContentLoaded', () => {
    const bookingModal = document.getElementById('bookingModal');
    const ticketPassModal = document.getElementById('ticketPassModal');
    const bookingForm = document.getElementById('bookingForm');

    const step1 = document.getElementById('bookingStep1');
    const step2 = document.getElementById('bookingStep2');
    const btnNextToPayment = document.getElementById('btnNextToPayment');
    const btnBackToStep1 = document.getElementById('btnBackToStep1');
    const downloadPassBtn = document.getElementById('downloadPassBtn');

    // Open booking modal
    ['bookNavBtn', 'heroBookBtn', 'mainBookPassBtn'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', () => {
        resetWizard();
        bookingModal.classList.add('active');
      });
    });

    // Close modals
    document.getElementById('closeBookingModal')?.addEventListener('click', () => {
      bookingModal.classList.remove('active');
    });

    document.getElementById('closePassModal')?.addEventListener('click', () => {
      ticketPassModal.classList.remove('active');
    });
    document.getElementById('closePassBtn')?.addEventListener('click', () => {
      ticketPassModal.classList.remove('active');
    });

    // Step 1 -> Step 2 Navigation (Loads dynamic QR settings from Admin!)
    btnNextToPayment?.addEventListener('click', async () => {
      const name = document.getElementById('attendeeName').value.trim();
      const email = document.getElementById('attendeeEmail').value.trim();
      const phone = document.getElementById('attendeePhone').value.trim();
      const emergencyContact = document.getElementById('emergencyContact').value.trim();
      const chkStag = document.getElementById('chkStag').checked;
      const chkSubstance = document.getElementById('chkSubstance').checked;

      if (!name || !email || !phone || !emergencyContact) {
        alert('Please fill out all contact details in Step 1.');
        return;
      }

      if (!chkStag || !chkSubstance) {
        alert('You must accept both event policies (Stag Entry & Zero Drugs/Alcohol) to proceed.');
        return;
      }

      // Fetch active QR code uploaded by Admin
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if (res.ok) {
          const upiImg = document.getElementById('bookingUpiQrImg');
          const upiId = document.getElementById('bookingUpiIdText');
          if (upiImg && data.upiQrUrl) upiImg.src = data.upiQrUrl;
          if (upiId && data.upiId) upiId.textContent = 'UPI ID: ' + data.upiId;
        }
      } catch (e) {
        console.warn('Could not fetch dynamic QR settings:', e);
      }

      step1.style.display = 'none';
      step2.style.display = 'block';
    });

    btnBackToStep1?.addEventListener('click', () => {
      step2.style.display = 'none';
      step1.style.display = 'block';
    });

    function resetWizard() {
      bookingForm?.reset();
      step2.style.display = 'none';
      step1.style.display = 'block';
    }

    // Submit Booking Form with UPI UTR
    bookingForm?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('attendeeName').value.trim();
      const email = document.getElementById('attendeeEmail').value.trim();
      const phone = document.getElementById('attendeePhone').value.trim();
      const emergencyContact = document.getElementById('emergencyContact').value.trim();
      const utrNumber = document.getElementById('utrNumber').value.trim();

      if (!utrNumber || utrNumber.length < 6) {
        alert('Please enter a valid 12-digit UPI UTR Transaction Reference Number.');
        return;
      }

      try {
        const response = await fetch('/api/tickets/submit-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            email,
            phone,
            emergencyContact,
            utrNumber,
            agreedToRules: true
          })
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          alert('Submission Error: ' + (data.error || data.message));
          return;
        }

        currentRecord = data.record;
        bookingModal.classList.remove('active');
        resetWizard();

        // Confetti burst
        if (typeof confetti === 'function') {
          confetti({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.6 },
            colors: ['#FFD700', '#FF6B00', '#0E261E']
          });
        }

        // Show Submission Status / Pass Modal
        renderTicketPass(currentRecord);
        ticketPassModal.classList.add('active');

        // Refresh stats & admin pending list if open
        window.fetchStats?.();
        window.reloadAdminPending?.();

      } catch (err) {
        alert('Network Error submitting payment: ' + err.message);
      }
    });

    downloadPassBtn?.addEventListener('click', () => {
      if (!currentRecord) return;
      downloadTicketAsImage(currentRecord);
    });
  });

  // Render Pass Card (Handles both PENDING and APPROVED states!)
  function renderTicketPass(ticket) {
    const isApproved = ticket.status === 'APPROVED';

    document.getElementById('passModalHeading').textContent = isApproved 
      ? 'Official Digital E-Ticket Pass' 
      : 'Payment Request Submitted (Pending Approval)';

    document.getElementById('passStatusLabel').textContent = isApproved 
      ? 'Official Festival Pass' 
      : 'Pending Admin Verification';

    document.getElementById('passCodeBadge').textContent = isApproved 
      ? ticket.ticket_code 
      : ticket.request_code;

    document.getElementById('passName').textContent = ticket.name;
    document.getElementById('passUtr').textContent = ticket.utr_number;

    const statusBadgeEl = document.getElementById('passStatusBadge');
    if (isApproved) {
      statusBadgeEl.innerHTML = '<span style="color: #4ADE80; font-weight: 800;">✅ APPROVED (Ticket Active)</span>';
      document.getElementById('qrSubText').textContent = 'Scan at Entry';
    } else {
      statusBadgeEl.innerHTML = '<span style="color: var(--marigold-bright); font-weight: 800;">⏳ PENDING ADMIN APPROVAL</span>';
      document.getElementById('qrSubText').textContent = 'Awaiting Approval';
    }

    const qrCanvas = document.getElementById('ticketQrCanvas');
    const qrData = isApproved ? ticket.ticket_code : ticket.request_code;

    if (typeof QRCode !== 'undefined' && qrCanvas) {
      QRCode.toCanvas(qrCanvas, qrData, {
        width: 120,
        margin: 1,
        color: {
          dark: isApproved ? '#06120E' : '#E65100',
          light: '#FFFFFF'
        }
      }, function(error) {
        if (error) console.error(error);
      });
    }
  }

  function downloadTicketAsImage(ticket) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 620;
    canvas.height = 370;

    const isApproved = ticket.status === 'APPROVED';

    // Dark Background
    ctx.fillStyle = '#06120E';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Border
    ctx.strokeStyle = isApproved ? '#FFD700' : '#FF6B00';
    ctx.lineWidth = 5;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    // Header
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 24px serif';
    ctx.fillText('THAKRUTHA 2026', 30, 48);

    ctx.fillStyle = isApproved ? '#4ADE80' : '#FF9E00';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(isApproved ? `TICKET: ${ticket.ticket_code}` : `REQ: ${ticket.request_code}`, 380, 48);

    // Line
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(30, 68);
    ctx.lineTo(590, 68);
    ctx.stroke();

    // Attendee Info
    ctx.fillStyle = '#F7F5EE';
    ctx.font = '13px sans-serif';
    ctx.fillText('ATTENDEE NAME:', 30, 105);
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(ticket.name, 30, 130);

    ctx.font = '13px sans-serif';
    ctx.fillText('UPI UTR TRANSACTION REF:', 30, 170);
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#FFD700';
    ctx.fillText(ticket.utr_number, 30, 195);

    ctx.fillStyle = '#F7F5EE';
    ctx.font = '13px sans-serif';
    ctx.fillText('STATUS:', 30, 235);
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = isApproved ? '#4ADE80' : '#FF9E00';
    ctx.fillText(isApproved ? 'APPROVED & VALIDATED' : 'PENDING ADMIN APPROVAL', 30, 260);

    ctx.fillStyle = '#C2BBB0';
    ctx.font = '13px sans-serif';
    ctx.fillText('August 23, 2026 (09:00 AM - 07:00 PM) | Venue Will Be Revealed Soon', 30, 295);
    ctx.fillText('Strictly Stag Only • No Drugs & Alcohol', 30, 320);

    // Draw QR Code canvas
    const qrCanvas = document.getElementById('ticketQrCanvas');
    if (qrCanvas) {
      ctx.drawImage(qrCanvas, 440, 100, 130, 130);
    }

    const link = document.createElement('a');
    link.download = `THAKRUTHA_Pass_${isApproved ? ticket.ticket_code : ticket.request_code}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  window.renderTicketPass = renderTicketPass;
})();
