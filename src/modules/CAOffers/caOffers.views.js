const escapeHtml = (text) =>
  String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const renderOfferApprovalSuccessPage = (candidate, offer) => {
  const candidateName = escapeHtml(candidate?.name || offer?.candidate || offer?.candidateName || "Candidate");
  const position = escapeHtml(offer?.role || candidate?.role || "Position");
  const ctc = escapeHtml(offer?.ctc || "As discussed");
  const joiningDate = escapeHtml(offer?.joiningDate || offer?.joining_date || "To be confirmed");
  const location = escapeHtml(offer?.location || candidate?.location || "Chennai");
  const hiringManager = escapeHtml(offer?.hiringManager || "Hiring Team");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offer Approved - iComply</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04);
      border: 1px solid #e2e8f0;
      max-width: 520px;
      width: 100%;
      overflow: hidden;
      animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .header {
      background: #0c2340;
      padding: 32px 24px;
      text-align: center;
      color: #ffffff;
      border-bottom: 3px solid #16a34a;
    }
    .brand-logo {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #ffffff;
      line-height: 1;
      margin-bottom: 18px;
    }
    .icon-wrap {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: #10b981;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 14px;
      box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);
    }
    .icon-wrap svg {
      width: 32px;
      height: 32px;
      stroke: #ffffff;
      stroke-width: 3;
      fill: none;
    }
    .title {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.4px;
      margin-bottom: 6px;
    }
    .subtitle {
      font-size: 13px;
      color: #94a3b8;
    }
    .content {
      padding: 28px;
    }
    .badge {
      display: inline-block;
      background: #ecfdf5;
      color: #059669;
      font-size: 12px;
      font-weight: 700;
      padding: 4px 14px;
      border-radius: 9999px;
      border: 1px solid #a7f3d0;
      margin-bottom: 20px;
      letter-spacing: 0.3px;
    }
    .info-grid {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 20px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #f1f5f9;
      font-size: 13px;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-label {
      color: #64748b;
    }
    .info-value {
      color: #0f172a;
      font-weight: 600;
      text-align: right;
    }
    .message {
      font-size: 13px;
      color: #475569;
      text-align: center;
      line-height: 1.6;
      margin-bottom: 16px;
    }
    .footer {
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 16px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="brand-logo"><span style="color:#22c55e;">i</span>Comply</div>
      <div class="icon-wrap">
        <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
      </div>
      <h1 class="title">Offer Approved!</h1>
      <p class="subtitle">Action recorded successfully</p>
    </div>
    <div class="content">
      <div style="text-align:center;">
        <span class="badge">✓ STATUS: OFFER APPROVED</span>
      </div>
      <div class="info-grid">
        <div class="info-row">
          <span class="info-label">Candidate</span>
          <span class="info-value">${candidateName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Position / Role</span>
          <span class="info-value">${position}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Compensation (CTC)</span>
          <span class="info-value">${ctc}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Target Joining Date</span>
          <span class="info-value">${joiningDate}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Location</span>
          <span class="info-value">${location}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Hiring Manager</span>
          <span class="info-value">${hiringManager}</span>
        </div>
      </div>
      <p class="message">
        The employment offer has been approved. The Hiring Manager has been notified to proceed with releasing the formal offer letter to the candidate.
      </p>
    </div>
    <div class="footer">
      You can now safely close this browser tab.
    </div>
  </div>
</body>
</html>`;
};

export const renderOfferRejectionSuccessPage = (candidate, offer) => {
  const candidateName = escapeHtml(candidate?.name || offer?.candidate || offer?.candidateName || "Candidate");
  const position = escapeHtml(offer?.role || candidate?.role || "Position");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offer Rejected - iComply</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08);
      border: 1px solid #e2e8f0;
      max-width: 480px;
      width: 100%;
      overflow: hidden;
      text-align: center;
      padding: 40px 32px;
    }
    .brand-logo {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.5px;
      line-height: 1;
      margin-bottom: 20px;
    }
    .icon {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: #fee2e2;
      color: #dc2626;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
    }
    .icon svg {
      width: 32px;
      height: 32px;
      stroke: currentColor;
      stroke-width: 2.5;
      fill: none;
    }
    .title {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 8px;
    }
    .desc {
      font-size: 14px;
      color: #64748b;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .badge {
      display: inline-block;
      background: #fef2f2;
      color: #dc2626;
      font-size: 12px;
      font-weight: 700;
      padding: 4px 14px;
      border-radius: 9999px;
      border: 1px solid #fecaca;
      margin-bottom: 20px;
    }
    .footer {
      font-size: 12px;
      color: #94a3b8;
      border-top: 1px solid #f1f5f9;
      padding-top: 16px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand-logo"><span style="color:#22c55e;">i</span>Comply</div>
    <div class="icon">
      <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
    </div>
    <h1 class="title">Offer Rejected</h1>
    <span class="badge">STATUS: REJECTED</span>
    <p class="desc">
      The offer proposal for <strong>${candidateName}</strong> (${position}) has been rejected. The talent acquisition team has been notified to review and adjust terms.
    </p>
    <div class="footer">
      You can now safely close this browser tab.
    </div>
  </div>
</body>
</html>`;
};

export const renderOfferAlreadyProcessedPage = (candidate, offer, currentStatus = "Approved") => {
  const candidateName = escapeHtml(candidate?.name || offer?.candidate || offer?.candidateName || "Candidate");
  const position = escapeHtml(offer?.role || candidate?.role || "Position");
  const isApproved = currentStatus === "Approved";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Already Processed - iComply</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08);
      border: 1px solid #e2e8f0;
      max-width: 480px;
      width: 100%;
      overflow: hidden;
      text-align: center;
      padding: 40px 32px;
    }
    .brand-logo {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.5px;
      line-height: 1;
      margin-bottom: 20px;
    }
    .icon {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #e0f2fe;
      color: #0284c7;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
    }
    .icon svg {
      width: 28px;
      height: 28px;
      stroke: currentColor;
      stroke-width: 2.5;
      fill: none;
    }
    .title {
      font-size: 21px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 8px;
    }
    .desc {
      font-size: 14px;
      color: #64748b;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .badge {
      display: inline-block;
      background: ${isApproved ? "#ecfdf5" : "#fef2f2"};
      color: ${isApproved ? "#059669" : "#dc2626"};
      font-size: 12px;
      font-weight: 700;
      padding: 4px 14px;
      border-radius: 9999px;
      border: 1px solid ${isApproved ? "#a7f3d0" : "#fecaca"};
      margin-bottom: 20px;
    }
    .footer {
      font-size: 12px;
      color: #94a3b8;
      border-top: 1px solid #f1f5f9;
      padding-top: 16px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand-logo"><span style="color:#22c55e;">i</span>Comply</div>
    <div class="icon">
      <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
    </div>
    <h1 class="title">Offer Already Processed</h1>
    <span class="badge">CURRENT STATUS: ${escapeHtml(currentStatus.toUpperCase())}</span>
    <p class="desc">
      The offer for <strong>${candidateName}</strong> (${position}) has already been marked as <strong>${escapeHtml(currentStatus)}</strong> in iComply. No further action is required.
    </p>
    <div class="footer">
      You can now safely close this browser tab.
    </div>
  </div>
</body>
</html>`;
};

export const renderOfferErrorPage = (errorMessage = "Invalid or expired link") => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error - iComply</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08);
      border: 1px solid #e2e8f0;
      max-width: 480px;
      width: 100%;
      overflow: hidden;
      text-align: center;
      padding: 40px 32px;
    }
    .brand-logo {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.5px;
      line-height: 1;
      margin-bottom: 20px;
    }
    .icon {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #fee2e2;
      color: #dc2626;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
    }
    .icon svg {
      width: 28px;
      height: 28px;
      stroke: currentColor;
      stroke-width: 2.5;
      fill: none;
    }
    .title {
      font-size: 21px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 8px;
    }
    .desc {
      font-size: 14px;
      color: #dc2626;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .footer {
      font-size: 12px;
      color: #94a3b8;
      border-top: 1px solid #f1f5f9;
      padding-top: 16px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand-logo"><span style="color:#22c55e;">i</span>Comply</div>
    <div class="icon">
      <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
    </div>
    <h1 class="title">Unable to Process Request</h1>
    <p class="desc">${escapeHtml(errorMessage)}</p>
    <div class="footer">
      Please contact your HR administrator if you believe this is an error.
    </div>
  </div>
</body>
</html>`;
};

const toIsoDate = (dateVal) => {
  if (!dateVal) return "";
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const renderCandidateOfferAcceptancePage = ({
  candidate,
  offer,
  company,
  token,
  acceptSubmitUrl,
  rejectUrl,
  pdfUrl,
}) => {
  const candidateName = escapeHtml(candidate?.name || offer?.candidate || offer?.candidateName || "Candidate");
  const position = escapeHtml(offer?.role || candidate?.role || "Position");
  const ctc = escapeHtml(offer?.ctc || "As specified in offer letter");
  const rawJoiningDate = offer?.joiningDate || offer?.joining_date;
  const prefilledIso = toIsoDate(rawJoiningDate) || toIsoDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
  const todayIso = toIsoDate(new Date());
  const location = escapeHtml(offer?.establishmentName || offer?.location || candidate?.location || "Corporate Office");
  const companyName = escapeHtml(company?.trade_name || company?.legal_name || "iComply");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Accept Offer & Confirm Joining Date - ${companyName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      min-height: 100vh;
      padding: 32px 16px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      background: #ffffff;
      max-width: 580px;
      width: 100%;
      border-radius: 16px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04);
      border: 1px solid #e2e8f0;
      overflow: hidden;
      animation: fadeIn 0.3s ease-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .header {
      background: #0c2340;
      padding: 28px 24px;
      color: #ffffff;
      text-align: center;
      border-bottom: 3px solid #16a34a;
    }
    .brand-logo {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin-bottom: 8px;
    }
    .header-title {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .header-sub {
      font-size: 13px;
      color: #94a3b8;
    }
    .body-content {
      padding: 28px 24px;
    }
    .welcome-text {
      font-size: 15px;
      color: #334155;
      line-height: 1.5;
      margin-bottom: 20px;
    }
    .summary-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 20px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #f1f5f9;
      font-size: 13px;
    }
    .summary-row:last-child {
      border-bottom: none;
    }
    .summary-label {
      color: #64748b;
    }
    .summary-val {
      color: #0f172a;
      font-weight: 600;
      text-align: right;
    }
    .pdf-banner {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 10px;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      gap: 12px;
    }
    .pdf-info {
      font-size: 13px;
      color: #1e40af;
      font-weight: 500;
    }
    .pdf-btn {
      display: inline-block;
      background: #2563eb;
      color: #ffffff;
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      text-decoration: none;
      white-space: nowrap;
      transition: background 0.15s ease;
    }
    .pdf-btn:hover {
      background: #1d4ed8;
    }
    .form-group {
      margin-bottom: 18px;
    }
    .form-label {
      display: block;
      font-size: 13px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 6px;
    }
    .form-label .req {
      color: #dc2626;
    }
    .form-hint {
      display: block;
      font-size: 12px;
      color: #64748b;
      margin-bottom: 8px;
    }
    .input-control {
      width: 100%;
      padding: 10px 14px;
      font-size: 14px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #ffffff;
      color: #0f172a;
      outline: none;
      transition: border-color 0.15s ease;
    }
    .input-control:focus {
      border-color: #16a34a;
      box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.15);
    }
    textarea.input-control {
      resize: vertical;
      min-height: 60px;
    }
    .consent-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 14px;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 24px;
      font-size: 13px;
      color: #334155;
      line-height: 1.4;
    }
    .consent-card input[type="checkbox"] {
      margin-top: 3px;
      cursor: pointer;
      width: 16px;
      height: 16px;
      accent-color: #16a34a;
    }
    .consent-card label {
      cursor: pointer;
    }
    .btn-submit {
      width: 100%;
      background: #16a34a;
      color: #ffffff;
      border: none;
      padding: 14px 20px;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.15s ease, transform 0.1s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .btn-submit:hover {
      background: #15803d;
    }
    .btn-submit:active {
      transform: scale(0.99);
    }
    .alt-action {
      text-align: center;
      margin-top: 18px;
      font-size: 13px;
      color: #64748b;
    }
    .decline-link {
      color: #dc2626;
      text-decoration: none;
      font-weight: 600;
    }
    .decline-link:hover {
      text-decoration: underline;
    }
    .footer {
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 14px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand-logo"><span style="color:#22c55e;">i</span>Comply</div>
      <h1 class="header-title">Offer Acceptance</h1>
      <p class="header-sub">${companyName}</p>
    </div>

    <div class="body-content">
      <p class="welcome-text">
        Dear <strong>${candidateName}</strong>,<br />
        We are thrilled to present you with this employment offer. Please review your offer details, confirm your Date of Joining (DOJ), and submit your formal acceptance below.
      </p>

      <div class="summary-card">
        <div class="summary-row">
          <span class="summary-label">Position / Role</span>
          <span class="summary-val">${position}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Annual CTC</span>
          <span class="summary-val">${ctc}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Location / Establishment</span>
          <span class="summary-val">${location}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Target Joining Date</span>
          <span class="summary-val">${rawJoiningDate || "To be confirmed"}</span>
        </div>
      </div>

      <div class="pdf-banner">
        <div class="pdf-info">
          📄 Formal Offer Cum Appointment Letter (PDF)
        </div>
        <a href="${pdfUrl}" target="_blank" class="pdf-btn">View / Download PDF</a>
      </div>

      <form method="POST" action="${acceptSubmitUrl}">
        <input type="hidden" name="token" value="${escapeHtml(token)}" />

        <div class="form-group">
          <label for="joiningDate" class="form-label">
            Confirm Your Date of Joining (DOJ) <span class="req">*</span>
          </label>
          <span class="form-hint">
            The proposed date is <strong>${rawJoiningDate || "indicated above"}</strong>. Please confirm or select your final joining date:
          </span>
          <input
            type="date"
            name="joiningDate"
            id="joiningDate"
            class="input-control"
            value="${prefilledIso}"
            min="${todayIso}"
            required
          />
        </div>

        <div class="form-group">
          <label for="remarks" class="form-label">
            Remarks / Comments <span style="font-weight:400;color:#94a3b8;">(Optional)</span>
          </label>
          <textarea
            name="remarks"
            id="remarks"
            class="input-control"
            placeholder="e.g., Thrilled to join! Or any specific onboarding preferences..."
          ></textarea>
        </div>

        <div class="consent-card">
          <input type="checkbox" id="consent" name="consent" required />
          <label for="consent">
            I accept the terms and conditions outlined in the official Offer Letter and confirm my Date of Joining as specified above.
          </label>
        </div>

        <button type="submit" class="btn-submit">
          ✓ Confirm Joining Date & Accept Offer
        </button>
      </form>

      <div class="alt-action">
        Unable to accept this offer?
        <a href="${rejectUrl}" class="decline-link">Decline Offer</a>
      </div>
    </div>

    <div class="footer">
      iComply Automated Recruitment Platform · Confidential
    </div>
  </div>
</body>
</html>`;
};

export const renderCandidateOfferAcceptedSuccessPage = ({
  candidate,
  offer,
  joiningDate,
  pdfUrl,
}) => {
  const candidateName = escapeHtml(candidate?.name || offer?.candidate || offer?.candidateName || "Candidate");
  const position = escapeHtml(offer?.role || candidate?.role || "Position");
  const confirmedDoj = escapeHtml(joiningDate || offer?.joiningDate || offer?.joining_date || "Confirmed");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offer Accepted! - iComply</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04);
      border: 1px solid #e2e8f0;
      max-width: 520px;
      width: 100%;
      overflow: hidden;
      animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .header {
      background: #0c2340;
      padding: 32px 24px;
      text-align: center;
      color: #ffffff;
      border-bottom: 3px solid #16a34a;
    }
    .brand-logo {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin-bottom: 16px;
    }
    .icon-wrap {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: #10b981;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 14px;
      box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);
    }
    .icon-wrap svg {
      width: 32px;
      height: 32px;
      stroke: #ffffff;
      stroke-width: 3;
      fill: none;
    }
    .title {
      font-size: 22px;
      font-weight: 800;
      margin-bottom: 6px;
    }
    .subtitle {
      font-size: 13px;
      color: #94a3b8;
    }
    .content {
      padding: 28px;
      text-align: center;
    }
    .badge {
      display: inline-block;
      background: #ecfdf5;
      color: #059669;
      font-size: 12px;
      font-weight: 700;
      padding: 5px 16px;
      border-radius: 9999px;
      border: 1px solid #a7f3d0;
      margin-bottom: 20px;
      letter-spacing: 0.3px;
    }
    .highlight-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #16a34a;
      border-radius: 10px;
      padding: 16px 20px;
      margin-bottom: 22px;
      text-align: left;
    }
    .highlight-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 13px;
    }
    .highlight-label {
      color: #64748b;
    }
    .highlight-value {
      color: #0f172a;
      font-weight: 700;
    }
    .message {
      font-size: 14px;
      color: #475569;
      line-height: 1.6;
      margin-bottom: 22px;
    }
    .pdf-action {
      margin-bottom: 12px;
    }
    .pdf-link {
      display: inline-block;
      background: #f1f5f9;
      color: #0c2340;
      border: 1px solid #cbd5e1;
      padding: 10px 18px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      text-decoration: none;
      transition: background 0.15s ease;
    }
    .pdf-link:hover {
      background: #e2e8f0;
    }
    .footer {
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 16px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="brand-logo"><span style="color:#22c55e;">i</span>Comply</div>
      <div class="icon-wrap">
        <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
      </div>
      <h1 class="title">Congratulations, ${candidateName}!</h1>
      <p class="subtitle">Offer Acceptance Recorded</p>
    </div>

    <div class="content">
      <span class="badge">✓ STATUS: OFFER ACCEPTED</span>

      <div class="highlight-card">
        <div class="highlight-row">
          <span class="highlight-label">Candidate</span>
          <span class="highlight-value">${candidateName}</span>
        </div>
        <div class="highlight-row">
          <span class="highlight-label">Position</span>
          <span class="highlight-value">${position}</span>
        </div>
        <div class="highlight-row">
          <span class="highlight-label">Confirmed Date of Joining (DOJ)</span>
          <span class="highlight-value" style="color:#16a34a; font-size:15px;">${confirmedDoj}</span>
        </div>
      </div>

      <p class="message">
        Thank you for accepting our offer! Your confirmation has been submitted to the Hiring Manager and HR team. We are excited to welcome you aboard.
      </p>

      ${pdfUrl ? `
      <div class="pdf-action">
        <a href="${pdfUrl}" target="_blank" class="pdf-link">
          📄 Download Copy of Offer Letter (PDF)
        </a>
      </div>
      ` : ""}
    </div>

    <div class="footer">
      You may now safely close this window. Welcome to the team!
    </div>
  </div>
</body>
</html>`;
};

export const renderCandidateOfferDeclinePage = ({
  candidate,
  offer,
  company,
  token,
  declineSubmitUrl,
  acceptUrl,
}) => {
  const candidateName = escapeHtml(candidate?.name || offer?.candidate || offer?.candidateName || "Candidate");
  const position = escapeHtml(offer?.role || candidate?.role || "Position");
  const companyName = escapeHtml(company?.trade_name || company?.legal_name || "iComply");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Decline Offer - ${companyName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08);
      border: 1px solid #e2e8f0;
      max-width: 480px;
      width: 100%;
      overflow: hidden;
      padding: 36px 30px;
    }
    .brand-logo {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.5px;
      text-align: center;
      margin-bottom: 16px;
    }
    .icon {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #fee2e2;
      color: #dc2626;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px auto;
    }
    .icon svg {
      width: 28px;
      height: 28px;
      stroke: currentColor;
      stroke-width: 2.5;
      fill: none;
    }
    .title {
      font-size: 20px;
      font-weight: 800;
      text-align: center;
      color: #0f172a;
      margin-bottom: 6px;
    }
    .subtitle {
      font-size: 13px;
      color: #64748b;
      text-align: center;
      margin-bottom: 22px;
    }
    .info-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 13px;
      margin-bottom: 20px;
    }
    .form-group {
      margin-bottom: 16px;
    }
    .form-label {
      display: block;
      font-size: 13px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 6px;
    }
    .input-control {
      width: 100%;
      padding: 10px 12px;
      font-size: 13px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      outline: none;
    }
    .input-control:focus {
      border-color: #dc2626;
    }
    textarea.input-control {
      resize: vertical;
      min-height: 60px;
    }
    .btn-decline {
      width: 100%;
      background: #dc2626;
      color: #ffffff;
      border: none;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      margin-top: 8px;
      transition: background 0.15s ease;
    }
    .btn-decline:hover {
      background: #b91c1c;
    }
    .back-action {
      text-align: center;
      margin-top: 16px;
      font-size: 13px;
    }
    .back-link {
      color: #16a34a;
      text-decoration: none;
      font-weight: 600;
    }
    .back-link:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand-logo"><span style="color:#22c55e;">i</span>Comply</div>
    <div class="icon">
      <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
    </div>
    <h1 class="title">Decline Employment Offer</h1>
    <p class="subtitle">${position} · ${companyName}</p>

    <div class="info-box">
      <strong>Candidate:</strong> ${candidateName}<br />
      <strong>Role:</strong> ${position}
    </div>

    <form method="POST" action="${declineSubmitUrl}">
      <input type="hidden" name="token" value="${escapeHtml(token)}" />

      <div class="form-group">
        <label for="reason" class="form-label">Reason for Declining (Optional)</label>
        <select name="reason" id="reason" class="input-control">
          <option value="">Select a reason...</option>
          <option value="Accepted another offer">Accepted another offer</option>
          <option value="Compensation / CTC">Compensation / CTC expectations</option>
          <option value="Location / Commute">Location / Commute constraints</option>
          <option value="Role mismatch">Role responsibilities mismatch</option>
          <option value="Personal reasons">Personal / Family reasons</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div class="form-group">
        <label for="remarks" class="form-label">Additional Feedback (Optional)</label>
        <textarea name="remarks" id="remarks" class="input-control" placeholder="Any feedback for the hiring team..."></textarea>
      </div>

      <button type="submit" class="btn-decline">
        Confirm Decline Offer
      </button>
    </form>

    ${acceptUrl ? `
    <div class="back-action">
      Changed your mind?
      <a href="${acceptUrl}" class="back-link">Return to Offer Acceptance</a>
    </div>
    ` : ""}
  </div>
</body>
</html>`;
};

export const renderCandidateOfferDeclinedSuccessPage = ({ candidate, offer }) => {
  const candidateName = escapeHtml(candidate?.name || offer?.candidate || offer?.candidateName || "Candidate");
  const position = escapeHtml(offer?.role || candidate?.role || "Position");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offer Response Recorded - iComply</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08);
      border: 1px solid #e2e8f0;
      max-width: 480px;
      width: 100%;
      overflow: hidden;
      text-align: center;
      padding: 40px 32px;
    }
    .brand-logo {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin-bottom: 20px;
    }
    .icon {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #f1f5f9;
      color: #64748b;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
    }
    .icon svg {
      width: 28px;
      height: 28px;
      stroke: currentColor;
      stroke-width: 2.5;
      fill: none;
    }
    .title {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 8px;
    }
    .desc {
      font-size: 14px;
      color: #64748b;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .badge {
      display: inline-block;
      background: #f1f5f9;
      color: #475569;
      font-size: 12px;
      font-weight: 700;
      padding: 4px 14px;
      border-radius: 9999px;
      border: 1px solid #e2e8f0;
      margin-bottom: 20px;
    }
    .footer {
      font-size: 12px;
      color: #94a3b8;
      border-top: 1px solid #f1f5f9;
      padding-top: 16px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand-logo"><span style="color:#22c55e;">i</span>Comply</div>
    <div class="icon">
      <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
    </div>
    <h1 class="title">Response Recorded</h1>
    <span class="badge">STATUS: OFFER DECLINED</span>
    <p class="desc">
      Thank you for letting us know, <strong>${candidateName}</strong>. Your decision regarding the <strong>${position}</strong> position has been communicated to the hiring team. We wish you the very best in your professional journey.
    </p>
    <div class="footer">
      You can now safely close this browser window.
    </div>
  </div>
</body>
</html>`;
};

