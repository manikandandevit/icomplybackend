const escapeHtml = (text) =>
  String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const renderApprovalSuccessPage = (requisition) => {
  const reqId = escapeHtml(requisition.reqId || `REQ-${requisition.id}`);
  const position = escapeHtml(requisition.position || "Position");
  const dept = escapeHtml(requisition.department || "General");
  const location = escapeHtml(requisition.location || "Office");
  const approver = escapeHtml(requisition.approverName || "Approver");
  const approverEmail = escapeHtml(requisition.approverEmail || "");
  const hiringManager = escapeHtml(requisition.hiringManager || "Hiring Manager");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Requisition Approved - iComply</title>
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
      font-size: 21px;
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
      padding: 4px 12px;
      border-radius: 9999px;
      border: 1px solid #a7f3d0;
      margin-bottom: 20px;
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
      <h1 class="title">Requisition Approved!</h1>
      <p class="subtitle">Action recorded successfully</p>
    </div>
    <div class="content">
      <div style="text-align:center;">
        <span class="badge">✓ STATUS: APPROVED &amp; OPEN</span>
      </div>
      <div class="info-grid">
        <div class="info-row">
          <span class="info-label">Requisition ID</span>
          <span class="info-value">${reqId}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Position</span>
          <span class="info-value">${position}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Department</span>
          <span class="info-value">${dept}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Location</span>
          <span class="info-value">${location}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Hiring Manager</span>
          <span class="info-value">${hiringManager}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Approved By</span>
          <span class="info-value">${approver} ${approverEmail ? `(${approverEmail})` : ''}</span>
        </div>
      </div>
      <p class="message">
        The job requisition has been marked as <strong>Approved</strong> in iComply. The hiring team has been notified.
      </p>
    </div>
    <div class="footer">
      You can now close this browser tab safely.
    </div>
  </div>
</body>
</html>`;
};

export const renderAlreadyApprovedPage = (requisition) => {
  const reqId = escapeHtml(requisition.reqId || `REQ-${requisition.id}`);
  const position = escapeHtml(requisition.position || "Position");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Already Approved - iComply</title>
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
      font-size: 24px;
      font-weight: 800;
    }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 8px; color: #0f172a; }
    p { font-size: 14px; color: #64748b; line-height: 1.6; margin-bottom: 24px; }
    .badge {
      display: inline-block;
      background: #f1f5f9;
      color: #334155;
      font-size: 13px;
      font-weight: 600;
      padding: 8px 16px;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand-logo"><span style="color:#22c55e;">i</span><span style="color:#0c2340;">Comply</span></div>
    <div class="icon">ℹ</div>
    <h1>Already Approved</h1>
    <p>Requisition <strong>${reqId}</strong> (${position}) has already been approved.</p>
    <div class="badge">No further action is required</div>
  </div>
</body>
</html>`;
};

export const renderApprovalRejectPage = (requisition) => {
  const reqId = escapeHtml(requisition.reqId || `REQ-${requisition.id}`);
  const position = escapeHtml(requisition.position || "Position");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Requisition Rejected - iComply</title>
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
      font-size: 26px;
      font-weight: 800;
    }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 8px; color: #991b1b; }
    p { font-size: 14px; color: #64748b; line-height: 1.6; margin-bottom: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand-logo"><span style="color:#22c55e;">i</span><span style="color:#0c2340;">Comply</span></div>
    <div class="icon">✕</div>
    <h1>Requisition Rejected</h1>
    <p>Requisition <strong>${reqId}</strong> (${position}) has been rejected and closed in the system.</p>
  </div>
</body>
</html>`;
};

export const renderApprovalErrorPage = (message) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Approval Error - iComply</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
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
      border: 1px solid #fee2e2;
      max-width: 480px;
      width: 100%;
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
      background: #fef2f2;
      color: #ef4444;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
      font-size: 26px;
    }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 8px; color: #1e293b; }
    p { font-size: 14px; color: #64748b; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand-logo"><span style="color:#22c55e;">i</span><span style="color:#0c2340;">Comply</span></div>
    <div class="icon">!</div>
    <h1>Unable to Process Approval</h1>
    <p>${escapeHtml(message || "Invalid or expired link. Please ask your administrator to send a new request.")}</p>
  </div>
</body>
</html>`;
};
