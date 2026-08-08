// Ticket Booking Controller with Payment Screenshot Upload
(function() {
  let currentRecord = null;
  let currentScreenshotBase64 = '';

  document.addEventListener('DOMContentLoaded', () => {
    const bookingModal = document.getElementById('bookingModal');
    const ticketPassModal = document.getElementById('ticketPassModal');
    const bookingForm = document.getElementById('bookingForm');
    const downloadPassBtn = document.getElementById('downloadPassBtn');

    const screenshotFileInput = document.getElementById('screenshotFileInput');
    const screenshotPreviewWrapper = document.getElementById('screenshotPreviewWrapper');
    const screenshotPreviewImg = document.getElementById('screenshotPreviewImg');

    // Open booking modal & fetch dynamic QR from admin settings
    ['bookNavBtn', 'heroBookBtn', 'mainBookPassBtn', 'dockBookBtn'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', async () => {
        resetForm();
        bookingModal.classList.add('active');

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

    // Handle Payment Screenshot File Selection with Canvas Compression
    screenshotFileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) {
        currentScreenshotBase64 = '';
        if (screenshotPreviewWrapper) screenshotPreviewWrapper.style.display = 'none';
        return;
      }

      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file (PNG, JPG, JPEG).');
        e.target.value = '';
        currentScreenshotBase64 = '';
        if (screenshotPreviewWrapper) screenshotPreviewWrapper.style.display = 'none';
        return;
      }

      const reader = new FileReader();
      reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
          const canvas = document.createElement('canvas');
          const maxDim = 500;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDim) {
              height = Math.round(height * (maxDim / width));
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round(width * (maxDim / height));
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          currentScreenshotBase64 = canvas.toDataURL('image/jpeg', 0.6);
          if (screenshotPreviewImg) screenshotPreviewImg.src = currentScreenshotBase64;
          if (screenshotPreviewWrapper) screenshotPreviewWrapper.style.display = 'block';
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });

    function resetForm() {
      bookingForm?.reset();
      currentScreenshotBase64 = '';
      if (screenshotPreviewWrapper) screenshotPreviewWrapper.style.display = 'none';
    }

    // Submit Booking Form
    bookingForm?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('attendeeName').value.trim();
      const email = document.getElementById('attendeeEmail').value.trim();
      const phone = document.getElementById('attendeePhone').value.trim();
      const emergencyContact = document.getElementById('emergencyContact').value.trim();
      const utrNumber = document.getElementById('utrNumber').value.trim();
      const chkStag = document.getElementById('chkStag').checked;
      const chkSubstance = document.getElementById('chkSubstance').checked;

      if (!name || !email || !phone || !emergencyContact) {
        alert('Please fill out all attendee information fields.');
        return;
      }

      if (!currentScreenshotBase64) {
        alert('Payment screenshot proof is mandatory! Please select and upload your payment receipt screenshot before submitting.');
        return;
      }

      if (!utrNumber || utrNumber.length < 6) {
        alert('Please enter a valid 12-digit UPI UTR Transaction Reference Number.');
        return;
      }

      if (!chkStag || !chkSubstance) {
        alert('You must accept the event policies (Stag Entry & Zero Drugs/Alcohol Policy) to submit your pass request.');
        return;
      }

      const submitBtn = document.getElementById('btnSubmitForm');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Submitting Request & Screenshot... <span class="spinner-border spinner-border-sm"></span>';
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
            paymentScreenshot: currentScreenshotBase64,
            agreedToRules: true
          })
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          alert('Submission Error: ' + (data.error || data.message));
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Submit Pass Request & Payment Proof <i data-lucide="check-circle"></i>';
          }
          return;
        }

        currentRecord = data.submission;
        bookingModal.classList.remove('active');
        resetForm();

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'Submit Pass Request & Payment Proof <i data-lucide="check-circle"></i>';
        }

        // Confetti burst
        if (typeof confetti === 'function') {
          confetti({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.6 },
            colors: ['#FFD700', '#FF6B00', '#0E261E']
          });
        }

        // Show Submission Status / Pass Receipt Modal
        renderTicketPass(currentRecord);
        ticketPassModal.classList.add('active');

        // Refresh stats & admin pending list if open
        window.fetchStats?.();
        window.reloadAdminPending?.();

      } catch (err) {
        alert('Network Error submitting payment: ' + err.message);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'Submit Pass Request & Payment Proof <i data-lucide="check-circle"></i>';
        }
      }
    });

    downloadPassBtn?.addEventListener('click', () => {
      if (!currentRecord) return;
      downloadTicketAsImage(currentRecord);
    });

    document.getElementById('downloadPassPdfBtn')?.addEventListener('click', () => {
      if (!currentRecord) return;
      downloadTicketAsPdf(currentRecord);
    });
  });

  // Render Pass Card (Handles both PENDING and APPROVED states!)
  function renderTicketPass(ticket) {
    currentRecord = ticket;
    const isApproved = ticket.status === 'APPROVED';

    document.getElementById('passModalHeading').textContent = isApproved 
      ? 'Official Digital E-Ticket Pass' 
      : 'Pass Request Receipt (Pending Admin Approval)';

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
      document.getElementById('qrSubText').textContent = 'Awaiting Verification';
    }

    const qrData = isApproved ? ticket.ticket_code : ticket.request_code;
    const qrContainer = document.getElementById('qrContainer');

    if (typeof qrcode !== 'undefined' && qrContainer) {
      try {
        const qr = qrcode(0, 'M');
        qr.addData(qrData);
        qr.make();
        const qrDataUrl = qr.createDataURL(6, 2);
        qrContainer.innerHTML = `<img src="${qrDataUrl}" style="width: 140px; height: 140px; display: block; margin: 0 auto; border-radius: 6px; background: white; padding: 6px; box-shadow: 0 0 15px rgba(255,215,0,0.3);" alt="Ticket QR Code">`;
      } catch (e) {
        console.error('Modal QR Error:', e);
      }
    }
  }

  function downloadTicketAsImage(ticket) {
    const isApproved = ticket.status === 'APPROVED';
    const code = isApproved ? ticket.ticket_code : ticket.request_code;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 620;
    canvas.height = 370;

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
    ctx.fillText(ticket.utr_number || 'N/A', 30, 195);

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

    if (typeof qrcode !== 'undefined') {
      try {
        const qr = qrcode(0, 'M');
        qr.addData(code);
        qr.make();

        const count = qr.getModuleCount();
        const qrSize = 130;
        const cellSize = qrSize / count;
        const startX = 440;
        const startY = 100;

        // Draw white background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(startX - 5, startY - 5, qrSize + 10, qrSize + 10);

        // Draw black modules
        ctx.fillStyle = '#000000';
        for (let r = 0; r < count; r++) {
          for (let c = 0; c < count; c++) {
            if (qr.isDark(r, c)) {
              ctx.fillRect(startX + (c * cellSize), startY + (r * cellSize), cellSize + 0.5, cellSize + 0.5);
            }
          }
        }
      } catch (e) {
        console.error('PNG QR error:', e);
      }
    }

    const link = document.createElement('a');
    link.download = `THAKRUTHA_Pass_${code}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  function downloadTicketAsPdf(ticket) {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
      alert('jsPDF library initializing... Please try again.');
      return;
    }

    const isApproved = ticket.status === 'APPROVED';
    const code = isApproved ? ticket.ticket_code : ticket.request_code;

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [148, 105] // A6 Landscape Pass format
    });

    // 1. Dark Emerald Background (#06120E)
    doc.setFillColor(6, 18, 14);
    doc.rect(0, 0, 148, 105, 'F');

    // 2. Gold Border (#FFD700)
    doc.setDrawColor(255, 215, 0);
    doc.setLineWidth(1.5);
    doc.roundedRect(4, 4, 140, 97, 3, 3, 'D');

    doc.setLineWidth(0.5);
    doc.roundedRect(6, 6, 136, 93, 2, 2, 'D');

    // 3. Header Text
    doc.setTextColor(255, 215, 0); // Kasavu Gold
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('THAKRUTHA 2026', 10, 16);

    doc.setTextColor(255, 226, 89);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text('Grand Onam Celebration | August 23, 2026 (09:00 AM - 07:00 PM)', 10, 21);

    // Divider Line
    doc.setDrawColor(255, 215, 0);
    doc.setLineWidth(0.4);
    doc.line(10, 24, 138, 24);

    // 4. Left Column: Attendee Details
    doc.setTextColor(200, 200, 200);
    doc.setFontSize(7);
    doc.text('ATTENDEE NAME', 10, 31);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(ticket.name, 10, 37);

    doc.setTextColor(200, 200, 200);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('PASS TYPE & MEAL', 10, 44);

    doc.setTextColor(255, 215, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('THAKRUTHA Stag Pass (100% Veg Sadhya)', 10, 49);

    doc.setTextColor(200, 200, 200);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('UPI UTR TRANSACTION REF', 10, 56);

    doc.setTextColor(255, 226, 89);
    doc.setFontSize(9);
    doc.setFont('courier', 'bold');
    doc.text(ticket.utr_number || 'N/A', 10, 61);

    doc.setTextColor(200, 200, 200);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('PASS STATUS', 10, 68);

    if (isApproved) {
      doc.setTextColor(74, 222, 128); // Green
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.text('APPROVED (VALID FOR GATE ENTRY)', 10, 74);
    } else {
      doc.setTextColor(255, 158, 0); // Orange
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.text('PENDING ADMIN VERIFICATION', 10, 74);
    }

    // 5. Right Column: QR Code Box
    doc.setFillColor(14, 38, 30);
    doc.roundedRect(94, 28, 44, 49, 2, 2, 'F');
    doc.setDrawColor(255, 215, 0);
    doc.roundedRect(94, 28, 44, 49, 2, 2, 'D');

    doc.setTextColor(255, 215, 0);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('PASS CODE', 116, 34, { align: 'center' });

    doc.setFontSize(7.5);
    doc.setFont('courier', 'bold');
    doc.text(code, 116, 39, { align: 'center' });

    // Synchronous Vector QR Code rendering directly onto PDF document stream!
    if (typeof qrcode !== 'undefined') {
      try {
        const qr = qrcode(0, 'M');
        qr.addData(code);
        qr.make();

        const count = qr.getModuleCount();
        const startX = 99;
        const startY = 41;
        const qrSize = 34;
        const cellSize = qrSize / count;

        // White background card
        doc.setFillColor(255, 255, 255);
        doc.rect(startX - 0.5, startY - 0.5, qrSize + 1, qrSize + 1, 'F');

        // Black vector modules
        doc.setFillColor(0, 0, 0);
        for (let row = 0; row < count; row++) {
          for (let col = 0; col < count; col++) {
            if (qr.isDark(row, col)) {
              doc.rect(startX + (col * cellSize), startY + (row * cellSize), cellSize + 0.05, cellSize + 0.05, 'F');
            }
          }
        }
      } catch (qrErr) {
        console.error('Vector QR error:', qrErr);
      }
    }

    // 6. Footer Rules & Terms
    doc.setDrawColor(255, 215, 0);
    doc.setLineWidth(0.3);
    doc.line(10, 80, 138, 80);

    doc.setTextColor(220, 220, 220);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('VENUE & ENTRY POLICIES:', 10, 85);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 180, 180);
    doc.text('• Strictly Stag Entry Only. Valid Govt Photo ID required at gate screening.', 10, 89);
    doc.text('• Strict Zero Tolerance Policy: No Drugs & No Alcohol allowed inside venue.', 10, 93);

    doc.save(`THAKRUTHA_Pass_${code}.pdf`);
  }

  window.renderTicketPass = renderTicketPass;
  window.downloadTicketAsPdf = downloadTicketAsPdf;
})();
