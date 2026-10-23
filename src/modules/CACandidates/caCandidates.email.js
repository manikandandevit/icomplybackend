import { db } from "../../core/db/pool.js";
import { sendMail } from "../../core/mail/mailer.js";

export const sendCandidateWelcomeEmail = async ({ candidate, companyId }) => {
  try {
    let candidateEmail = candidate?.email;
    let candidateName = candidate?.name || "Candidate";
    let role = candidate?.role || "Job Applicant";

    if (!candidateEmail && candidate?.id) {
      const { rows } = await db.query(
        `SELECT email, name, role FROM public.ca_candidates WHERE id = $1`,
        [candidate.id]
      );
      if (rows[0]?.email) {
        candidateEmail = rows[0].email;
        candidateName = rows[0].name || candidateName;
        role = rows[0].role || role;
      }
    }

    if (!candidateEmail) {
      console.log("[Candidate Welcome Email] No email provided, skipping welcome email.");
      return false;
    }

    let companyName = "iComply Technologies";
    if (companyId) {
      const { rows } = await db.query(
        `SELECT trade_name, legal_name FROM public.companies WHERE id = $1 LIMIT 1`,
        [companyId]
      );
      if (rows[0]) {
        companyName = rows[0].trade_name || rows[0].legal_name || companyName;
      }
    }

    const brandColor = "#0c2340";
    const accentColor = "#f97316";

    const subject = `Application Received: ${role} at ${companyName}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <div style="border-bottom: 2px solid #f1f5f9; padding-bottom: 16px; margin-bottom: 20px;">
          <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; color: ${accentColor};">Talent Acquisition</span>
          <h2 style="color: ${brandColor}; margin: 6px 0 0 0; font-size: 20px; font-weight: 700;">Application Received</h2>
        </div>

        <div style="margin-bottom: 16px;">
          <span style="display: inline-block; background-color: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700;">
            ✓ Profile Registered in Talent Pipeline
          </span>
        </div>

        <p style="font-size: 15px; margin-top: 0;">Dear <strong>${candidateName}</strong>,</p>

        <p style="font-size: 14px; color: #334155;">
          Thank you for applying for the position of <strong>${role}</strong> at <strong>${companyName}</strong>. We are pleased to confirm that your profile and contact details have been successfully registered in our recruitment system.
        </p>

        <div style="margin-top: 20px; padding: 16px 20px; background-color: #f8fafc; border-radius: 8px; border-left: 4px solid ${brandColor}; font-size: 13px;">
          <p style="margin: 0 0 6px 0;"><strong>Candidate Name:</strong> ${candidateName}</p>
          <p style="margin: 0 0 6px 0;"><strong>Target Role:</strong> ${role}</p>
          <p style="margin: 0 0 6px 0;"><strong>Registered Email:</strong> ${candidateEmail}</p>
          ${candidate.phone ? `<p style="margin: 0 0 6px 0;"><strong>Phone:</strong> ${candidate.phone}</p>` : ''}
          ${candidate.location ? `<p style="margin: 0 0 6px 0;"><strong>Location:</strong> ${candidate.location}</p>` : ''}
          <p style="margin: 0;"><strong>Application Status:</strong> Under Review</p>
        </div>

        <p style="font-size: 14px; color: #334155; margin-top: 20px;">
          Our Talent Acquisition team is currently reviewing your profile. Once your application is reviewed and shortlisted, you will receive an interview invitation with date and time details directly at this email address.
        </p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0 20px 0;" />

        <p style="font-size: 12px; color: #64748b; margin: 0;">
          Warm regards,<br />
          <strong style="color: #334155;">Talent Acquisition & Hiring Team</strong><br />
          ${companyName}
        </p>
      </div>
    `;

    const sent = await sendMail({
      to: candidateEmail,
      subject,
      html,
      fromName: `${companyName} Careers`
    });

    if (sent) {
      console.log(`[Candidate Welcome Email] Successfully sent application acknowledgement to ${candidateEmail}`);
    }
    return sent;
  } catch (err) {
    console.error("[Candidate Welcome Email] Error:", err.message);
    return false;
  }
};

/**
 * Resolves the company name, logo URL, and initials strictly associated with
 * the candidate's position / job requisition.
 */
export const resolvePositionCompany = async ({ role, establishmentName, companyId }) => {
  try {
    let req = null;
    if (role && establishmentName) {
      const { rows } = await db.query(
        `SELECT * FROM public.ca_job_requisitions 
         WHERE LOWER(TRIM(position)) = LOWER(TRIM($1)) 
           AND LOWER(TRIM(establishment_name)) = LOWER(TRIM($2)) 
         ORDER BY id DESC LIMIT 1`,
        [role, establishmentName]
      );
      if (rows[0]) req = rows[0];
    }

    if (!req && role) {
      const { rows } = await db.query(
        `SELECT * FROM public.ca_job_requisitions 
         WHERE LOWER(TRIM(position)) = LOWER(TRIM($1)) 
         ORDER BY id DESC LIMIT 1`,
        [role]
      );
      if (rows[0]) req = rows[0];
    }

    const estName = (req && req.establishment_name) || establishmentName || "";
    const reqCompanyName = (req && req.company_name) || "";

    const { rows: caCompanies } = await db.query(`SELECT * FROM public.ca_companies`);
    const { rows: parentCompanies } = await db.query(`SELECT * FROM public.companies`);
    const { rows: establishments } = await db.query(`SELECT * FROM public.ca_establishments`);

    let matchedCompany = null;

    // 1. Requisition explicitly specifies company_name
    if (reqCompanyName) {
      matchedCompany = caCompanies.find(c => 
        (c.trade_name && c.trade_name.toLowerCase() === reqCompanyName.toLowerCase()) ||
        (c.legal_name && c.legal_name.toLowerCase() === reqCompanyName.toLowerCase())
      ) || parentCompanies.find(c => 
        (c.trade_name && c.trade_name.toLowerCase() === reqCompanyName.toLowerCase()) ||
        (c.legal_name && c.legal_name.toLowerCase() === reqCompanyName.toLowerCase())
      );
    }

    // 2. Lookup via establishment name in ca_establishments
    if (!matchedCompany && estName) {
      const est = establishments.find(e => e.name && e.name.toLowerCase() === estName.toLowerCase());
      if (est) {
        if (est.company_source === "ca" && est.company_id) {
          matchedCompany = caCompanies.find(c => c.id === Number(est.company_id));
        } else if (est.company_id) {
          matchedCompany = parentCompanies.find(c => c.id === Number(est.company_id));
        }
        if (!matchedCompany && est.company_name) {
          matchedCompany = caCompanies.find(c => 
            (c.trade_name && c.trade_name.toLowerCase() === est.company_name.toLowerCase()) ||
            (c.legal_name && c.legal_name.toLowerCase() === est.company_name.toLowerCase())
          ) || parentCompanies.find(c => 
            (c.trade_name && c.trade_name.toLowerCase() === est.company_name.toLowerCase()) ||
            (c.legal_name && c.legal_name.toLowerCase() === est.company_name.toLowerCase())
          );
        }
      }
    }

    // 3. Lookup if establishment name contains company trade/legal name
    if (!matchedCompany && estName) {
      matchedCompany = caCompanies.find(c => 
        (c.trade_name && estName.toLowerCase().includes(c.trade_name.toLowerCase())) ||
        (c.legal_name && estName.toLowerCase().includes(c.legal_name.toLowerCase()))
      ) || parentCompanies.find(c => 
        (c.trade_name && estName.toLowerCase().includes(c.trade_name.toLowerCase())) ||
        (c.legal_name && estName.toLowerCase().includes(c.legal_name.toLowerCase()))
      );
    }

    // 4. Fallback to requisition created_by_company_id or session companyId
    const targetCompId = (req && req.created_by_company_id) || companyId;
    if (!matchedCompany && targetCompId) {
      matchedCompany = caCompanies.find(c => c.id === Number(targetCompId)) ||
        parentCompanies.find(c => c.id === Number(targetCompId));
    }

    let finalName = matchedCompany ? (matchedCompany.trade_name || matchedCompany.legal_name) : (reqCompanyName || "iComply Technologies");
    let rawLogo = matchedCompany ? matchedCompany.logo_url : null;
    let fullLogoUrl = null;
    if (rawLogo) {
      if (rawLogo.startsWith("http://") || rawLogo.startsWith("https://")) {
        fullLogoUrl = rawLogo;
      } else {
        fullLogoUrl = "https://ykxeqpnaggawupoiikyn.storage.supabase.co/storage/v1/object/public/Icomply_Bucket/" + rawLogo;
      }
    }

    let initials = matchedCompany ? matchedCompany.initials : null;
    if (!initials && finalName) {
      const parts = finalName.trim().split(/\s+/);
      initials = parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0].slice(0, 2).toUpperCase();
    }

    return {
      companyName: finalName,
      logoUrl: fullLogoUrl,
      initials: initials || "TA",
    };
  } catch (err) {
    console.error("[resolvePositionCompany] Error:", err.message);
    return {
      companyName: "iComply Technologies",
      logoUrl: null,
      initials: "IC",
    };
  }
};

/**
 * Builds the responsive, MNC-grade HTML email template for candidates shortlisted in interview process.
 */
export const buildCandidateShortlistedEmailHtml = ({
  candidateName,
  jobRole,
  companyName,
  logoUrl,
  initials,
}) => {
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${companyName}" width="44" height="44" style="display: block; width: 44px; height: 44px; border-radius: 8px; border: 1px solid #e2e8f0; object-fit: contain; background: #ffffff;" />`
    : `<table cellpadding="0" cellspacing="0" border="0" style="width: 44px; height: 44px; border-radius: 8px; background: #0f172a; text-align: center;"><tr><td align="center" valign="middle" style="color: #ffffff; font-size: 16px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">${initials || "TA"}</td></tr></table>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Congratulations! You've Been Shortlisted – ${jobRole}</title>
  <style type="text/css">
    @media only screen and (max-width: 600px) {
      .email-card {
        border-radius: 8px !important;
      }
      .email-header {
        padding: 20px 20px !important;
      }
      .email-body {
        padding: 24px 20px !important;
      }
      .email-title {
        font-size: 18px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f1f5f9; padding: 40px 16px; margin: 0;">
    <tr>
      <td align="center">
        <!-- Main Email Container -->
        <table role="presentation" class="email-card" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);">
          <!-- Top Header with Actual Company Logo & Name -->
          <tr>
            <td class="email-header" style="padding: 24px 32px; border-bottom: 1px solid #f1f5f9; background-color: #ffffff;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle" style="padding-right: 14px;">
                    ${logoHtml}
                  </td>
                  <td valign="middle">
                    <h1 style="margin: 0; font-size: 19px; font-weight: 700; color: #0f172a; line-height: 1.25; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">${companyName}</h1>
                    <div style="margin-top: 3px; font-size: 11px; font-weight: 600; color: #64748b; letter-spacing: 0.08em; text-transform: uppercase; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">TALENT ACQUISITION TEAM</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Email Content Body -->
          <tr>
            <td class="email-body" style="padding: 32px 32px 28px 32px;">
              <h2 class="email-title" style="margin: 0 0 20px 0; font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1.35; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Congratulations, ${candidateName}!</h2>

              <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.65; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                Dear ${candidateName},
              </p>

              <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.65; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                We are pleased to inform you that you have been <strong>shortlisted for the next stage of our recruitment process</strong> for the position of <strong>${jobRole}</strong> at <strong>${companyName}</strong>.
              </p>

              <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.65; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                Thank you for your interest in joining our team. Our Talent Acquisition team will contact you with the interview schedule and further details.
              </p>

              <p style="margin: 0 0 24px 0; font-size: 15px; color: #334155; line-height: 1.65; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                We look forward to connecting with you and wish you all the best for the upcoming stages.
              </p>

              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />

              <p style="margin: 0 0 4px 0; font-size: 15px; color: #334155; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                Best regards,
              </p>
              <p style="margin: 0; font-size: 15px; font-weight: 700; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                Talent Acquisition Team
              </p>
              <p style="margin: 2px 0 0 0; font-size: 14px; color: #64748b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                ${companyName}
              </p>
            </td>
          </tr>
        </table>

        <!-- Automated Footer Communication -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px;">
          <tr>
            <td align="center" style="padding-top: 20px; font-size: 12px; color: #94a3b8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
              This is an automated recruitment communication from ${companyName}.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

/**
 * Triggers the Shortlisted email notification to a candidate using the exact
 * company name, company logo, and position title from the database.
 */
export const sendCandidateShortlistedEmail = async ({
  candidateId,
  companyId,
  candidate: directCandidate,
  role: directRole,
  establishmentName: directEstName,
  candidateEmail: directEmail,
  candidateName: directName,
}) => {
  try {
    let candidate = directCandidate || null;

    if (!candidate && candidateId) {
      const { rows } = await db.query(
        `SELECT id, name, email, role, establishment_name, created_by_company_id 
         FROM public.ca_candidates WHERE id = $1`,
        [Number(candidateId)]
      );
      if (rows[0]) candidate = rows[0];
    }

    const candidateEmail = directEmail || candidate?.email;
    const candidateName = directName || candidate?.name || "Candidate";
    const jobRole = directRole || candidate?.role || "Position";
    const establishmentName = directEstName || candidate?.establishment_name || "";
    const activeCompanyId = candidate?.created_by_company_id || companyId;

    if (!candidateEmail) {
      console.log(`[Candidate Shortlist Email] Candidate ${candidateId || candidateName} has no email address configured, skipping email.`);
      return false;
    }

    // Strictly resolve the company and logo associated with this position
    const { companyName, logoUrl, initials } = await resolvePositionCompany({
      role: jobRole,
      establishmentName,
      companyId: activeCompanyId,
    });

    const subject = `Congratulations! You've Been Shortlisted – ${jobRole}`;
    const html = buildCandidateShortlistedEmailHtml({
      candidateName,
      jobRole,
      companyName,
      logoUrl,
      initials,
    });

    const sent = await sendMail({
      to: candidateEmail,
      subject,
      html,
      fromName: `${companyName} Talent Acquisition`,
    });

    if (sent) {
      console.log(`[Candidate Shortlist Email] Successfully sent shortlisted email to ${candidateEmail} for ${jobRole} at ${companyName}`);
    }
    return sent;
  } catch (err) {
    console.error("[Candidate Shortlist Email] Error sending shortlisted email:", err.message);
    return false;
  }
};

/**
 * Builds the respectful, MNC-standard HTML email template for candidates when their application is rejected.
 */
export const buildCandidateRejectionEmailHtml = ({
  candidateName,
  jobRole,
  companyName,
  logoUrl,
  initials,
}) => {
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${companyName}" width="44" height="44" style="display: block; width: 44px; height: 44px; border-radius: 8px; border: 1px solid #e2e8f0; object-fit: contain; background: #ffffff;" />`
    : `<table cellpadding="0" cellspacing="0" border="0" style="width: 44px; height: 44px; border-radius: 8px; background: #0f172a; text-align: center;"><tr><td align="center" valign="middle" style="color: #ffffff; font-size: 16px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">${initials || "TA"}</td></tr></table>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Update on Your Application – ${jobRole} | ${companyName}</title>
  <style type="text/css">
    @media only screen and (max-width: 600px) {
      .email-card {
        border-radius: 8px !important;
      }
      .email-header {
        padding: 20px 20px !important;
      }
      .email-body {
        padding: 24px 20px !important;
      }
      .email-title {
        font-size: 18px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f1f5f9; padding: 40px 16px; margin: 0;">
    <tr>
      <td align="center">
        <!-- Main Email Container -->
        <table role="presentation" class="email-card" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);">
          <!-- Top Header with Actual Company Logo & Name -->
          <tr>
            <td class="email-header" style="padding: 24px 32px; border-bottom: 1px solid #f1f5f9; background-color: #ffffff;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle" style="padding-right: 14px;">
                    ${logoHtml}
                  </td>
                  <td valign="middle">
                    <h1 style="margin: 0; font-size: 19px; font-weight: 700; color: #0f172a; line-height: 1.25; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">${companyName}</h1>
                    <div style="margin-top: 3px; font-size: 11px; font-weight: 600; color: #64748b; letter-spacing: 0.08em; text-transform: uppercase; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">TALENT ACQUISITION TEAM</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Email Content Body -->
          <tr>
            <td class="email-body" style="padding: 32px 32px 28px 32px;">
              <h2 class="email-title" style="margin: 0 0 20px 0; font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1.35; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Update on Your Application</h2>

              <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.65; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                Dear ${candidateName},
              </p>

              <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.65; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                Thank you for your interest in the <strong>${jobRole}</strong> position at <strong>${companyName}</strong> and for the time and effort you invested in our recruitment process.
              </p>

              <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.65; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                After careful consideration, we regret to inform you that we will not be progressing with your application for this position at this time.
              </p>

              <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.65; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                We appreciate the opportunity to learn about your skills and experience. We encourage you to explore future opportunities with us that align with your qualifications and career goals.
              </p>

              <p style="margin: 0 0 24px 0; font-size: 15px; color: #334155; line-height: 1.65; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                Thank you once again for considering ${companyName}. We wish you every success in your future endeavours.
              </p>

              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />

              <p style="margin: 0 0 4px 0; font-size: 15px; color: #334155; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                Kind regards,
              </p>
              <p style="margin: 0; font-size: 15px; font-weight: 700; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                Talent Acquisition Team
              </p>
              <p style="margin: 2px 0 0 0; font-size: 14px; color: #64748b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                ${companyName}
              </p>
            </td>
          </tr>
        </table>

        <!-- Automated Footer Communication -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px;">
          <tr>
            <td align="center" style="padding-top: 20px; font-size: 12px; color: #94a3b8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
              This is an automated recruitment communication from ${companyName}.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

/**
 * Triggers the Rejection email notification to a candidate using the exact
 * company name, company logo, and position title from the database.
 * Prevents duplicate emails if candidate has already been sent a rejection email.
 */
export const sendCandidateRejectionEmail = async ({
  candidateId,
  companyId,
  candidate: directCandidate,
  role: directRole,
  establishmentName: directEstName,
  candidateEmail: directEmail,
  candidateName: directName,
}) => {
  try {
    let candidate = directCandidate || null;

    if (!candidate && candidateId) {
      const { rows } = await db.query(
        `SELECT id, name, email, role, establishment_name, created_by_company_id, stage, rejection_email_sent_at 
         FROM public.ca_candidates WHERE id = $1`,
        [Number(candidateId)]
      );
      if (rows[0]) candidate = rows[0];
    }

    if (!candidate) {
      console.warn(`[Candidate Rejection Email] Candidate ${candidateId} not found.`);
      return false;
    }

    // Requirement 6: Duplicate prevention
    // If rejection email was already sent to this candidate, skip sending!
    if (candidate.rejection_email_sent_at) {
      console.log(`[Candidate Rejection Email] Rejection email already sent to candidate ${candidate.id} on ${candidate.rejection_email_sent_at}. Skipping duplicate.`);
      return false;
    }

    const candidateEmail = directEmail || candidate?.email;
    const candidateName = directName || candidate?.name || "Candidate";
    const jobRole = directRole || candidate?.role || "Position";
    const establishmentName = directEstName || candidate?.establishment_name || "";
    const activeCompanyId = candidate?.created_by_company_id || companyId;

    if (!candidateEmail) {
      console.log(`[Candidate Rejection Email] Candidate ${candidate.id || candidateName} has no email configured, skipping email.`);
      return false;
    }

    // Strictly resolve the company and logo associated with this position
    const { companyName, logoUrl, initials } = await resolvePositionCompany({
      role: jobRole,
      establishmentName,
      companyId: activeCompanyId,
    });

    const subject = `Update on Your Application – ${jobRole} | ${companyName}`;
    const html = buildCandidateRejectionEmailHtml({
      candidateName,
      jobRole,
      companyName,
      logoUrl,
      initials,
    });

    const sent = await sendMail({
      to: candidateEmail,
      subject,
      html,
      fromName: `${companyName} Talent Acquisition`,
    });

    if (sent) {
      // Record rejection_email_sent_at timestamp in database to prevent future duplicate sends
      await db.query(
        `UPDATE public.ca_candidates SET rejection_email_sent_at = NOW() WHERE id = $1`,
        [candidate.id]
      ).catch((err) => console.warn("[Candidate Rejection Email] Failed to record rejection_email_sent_at:", err.message));

      console.log(`[Candidate Rejection Email] Successfully sent rejection email to ${candidateEmail} for ${jobRole} at ${companyName}`);
    }
    return sent;
  } catch (err) {
    console.error("[Candidate Rejection Email] Error sending rejection email:", err.message);
    return false;
  }
};

/**
 * Builds the elegant, responsive MNC-standard HTML email template for candidates
 * when they are selected in the interview process.
 */
export const buildCandidateSelectionEmailHtml = ({
  candidateName,
  jobRole,
  companyName,
  logoUrl,
  initials,
  offer,
  candidateLocation,
}) => {
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${companyName}" width="44" height="44" style="display: block; width: 44px; height: 44px; border-radius: 8px; border: 1px solid #e2e8f0; object-fit: contain; background: #ffffff;" />`
    : `<table cellpadding="0" cellspacing="0" border="0" style="width: 44px; height: 44px; border-radius: 8px; background: #0f172a; text-align: center;"><tr><td align="center" valign="middle" style="color: #ffffff; font-size: 16px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">${initials || "TA"}</td></tr></table>`;

  const isOfferApproved = Boolean(
    offer &&
    (offer.approval_status === "Approved" || offer.status === "Approved")
  );

  let detailsBlockHtml = "";
  if (isOfferApproved) {
    detailsBlockHtml = `
      <div style="margin: 24px 0; padding: 20px 22px; background-color: #f8fafc; border-radius: 8px; border-left: 4px solid #059669; border-top: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #059669; letter-spacing: 0.06em; margin-bottom: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          Offer Highlights
        </div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-size: 13.5px; line-height: 1.6; color: #334155; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <tr>
            <td style="padding: 4px 0; width: 140px; color: #64748b; font-weight: 500;">Position:</td>
            <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">${offer.role || jobRole}</td>
          </tr>
          ${offer.ctc ? `
          <tr>
            <td style="padding: 4px 0; color: #64748b; font-weight: 500;">Compensation (CTC):</td>
            <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">${offer.ctc}</td>
          </tr>` : ""}
          ${offer.joining_bonus ? `
          <tr>
            <td style="padding: 4px 0; color: #64748b; font-weight: 500;">Joining Bonus:</td>
            <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">${offer.joining_bonus}</td>
          </tr>` : ""}
          ${offer.joining_date ? `
          <tr>
            <td style="padding: 4px 0; color: #64748b; font-weight: 500;">Target Joining Date:</td>
            <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">${offer.joining_date}</td>
          </tr>` : ""}
          ${(offer.location || candidateLocation) ? `
          <tr>
            <td style="padding: 4px 0; color: #64748b; font-weight: 500;">Work Location:</td>
            <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">${offer.location || candidateLocation}</td>
          </tr>` : ""}
          <tr>
            <td style="padding: 4px 0; color: #64748b; font-weight: 500;">Offer Status:</td>
            <td style="padding: 4px 0; font-weight: 700; color: #059669;">Approved</td>
          </tr>
        </table>
      </div>

      <p style="margin: 0 0 20px 0; font-size: 15px; color: #334155; line-height: 1.65; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        Your formal offer letter has been approved by our hiring leadership. Our Talent Acquisition team will be following up with you shortly regarding the official offer letter release, pre-onboarding formalities, and background verification.
      </p>
    `;
  } else {
    detailsBlockHtml = `
      <div style="margin: 24px 0; padding: 20px 22px; background-color: #f8fafc; border-radius: 8px; border-left: 4px solid #059669; border-top: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #059669; letter-spacing: 0.06em; margin-bottom: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          Selection Summary &amp; Next Steps
        </div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-size: 13.5px; line-height: 1.6; color: #334155; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <tr>
            <td style="padding: 4px 0; width: 140px; color: #64748b; font-weight: 500;">Position:</td>
            <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">${jobRole}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b; font-weight: 500;">Organization:</td>
            <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">${companyName}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b; font-weight: 500;">Status:</td>
            <td style="padding: 4px 0; font-weight: 700; color: #059669;">Selected (Final Interview Cleared)</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b; font-weight: 500;">Next Formalities:</td>
            <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">Offer Preparation, Documentation &amp; Onboarding</td>
          </tr>
        </table>
      </div>

      <p style="margin: 0 0 20px 0; font-size: 15px; color: #334155; line-height: 1.65; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        Our Talent Acquisition team is currently preparing your formal offer letter. A member of our team will be following up with you shortly regarding the document verification checklist, pre-onboarding guidelines, and next steps for your formal offer release.
      </p>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Congratulations! You've Been Selected – ${jobRole} | ${companyName}</title>
  <style type="text/css">
    @media only screen and (max-width: 600px) {
      .email-card {
        border-radius: 8px !important;
      }
      .email-header {
        padding: 20px 20px !important;
      }
      .email-body {
        padding: 24px 20px !important;
      }
      .email-title {
        font-size: 18px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f1f5f9; padding: 40px 16px; margin: 0;">
    <tr>
      <td align="center">
        <!-- Main Email Container -->
        <table role="presentation" class="email-card" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);">
          <!-- Top Header with Actual Company Logo & Name -->
          <tr>
            <td class="email-header" style="padding: 24px 32px; border-bottom: 1px solid #f1f5f9; background-color: #ffffff;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle" style="padding-right: 14px;">
                    ${logoHtml}
                  </td>
                  <td valign="middle">
                    <h1 style="margin: 0; font-size: 19px; font-weight: 700; color: #0f172a; line-height: 1.25; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">${companyName}</h1>
                    <div style="margin-top: 3px; font-size: 11px; font-weight: 600; color: #64748b; letter-spacing: 0.08em; text-transform: uppercase; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">TALENT ACQUISITION TEAM</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Email Content Body -->
          <tr>
            <td class="email-body" style="padding: 32px 32px 28px 32px;">
              <div style="margin-bottom: 20px;">
                <span style="display: inline-block; background-color: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; letter-spacing: 0.02em; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                  ✓ Final Selection Confirmed
                </span>
              </div>

              <h2 class="email-title" style="margin: 0 0 20px 0; font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1.35; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Congratulations, ${candidateName}!</h2>

              <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.65; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                Dear ${candidateName},
              </p>

              <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.65; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                We are delighted to share the wonderful news that you have been <strong>Selected</strong> for the position of <strong>${jobRole}</strong> at <strong>${companyName}</strong>!
              </p>

              <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.65; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                Following your interview rounds, our evaluation panel was thoroughly impressed by your domain knowledge, qualifications, and problem-solving abilities. We believe you will be a valuable addition to our team and organization.
              </p>

              ${detailsBlockHtml}

              <p style="margin: 0 0 24px 0; font-size: 15px; color: #334155; line-height: 1.65; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                Once again, congratulations on your selection. We look forward to working with you and welcoming you to <strong>${companyName}</strong>!
              </p>

              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0 20px 0;" />

              <p style="margin: 0 0 4px 0; font-size: 15px; color: #334155; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                Best regards,
              </p>
              <p style="margin: 0; font-size: 15px; font-weight: 700; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                Talent Acquisition Team
              </p>
              <p style="margin: 2px 0 0 0; font-size: 14px; color: #64748b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                ${companyName}
              </p>
            </td>
          </tr>
        </table>

        <!-- Automated Footer Communication -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px;">
          <tr>
            <td align="center" style="padding-top: 20px; font-size: 12px; color: #94a3b8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
              This is an official recruitment communication from ${companyName}.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

/**
 * Triggers the Selection email notification to a candidate using the exact
 * company name, company logo, and position title from the database.
 * If an approved offer exists, it includes the approved offer details;
 * otherwise it informs the candidate that the offer and onboarding process is in progress.
 * Prevents duplicate emails if candidate has already been sent a selection email.
 */
export const sendCandidateSelectionEmail = async ({
  candidateId,
  companyId,
  candidate: directCandidate,
  role: directRole,
  establishmentName: directEstName,
  candidateEmail: directEmail,
  candidateName: directName,
}) => {
  try {
    let candidate = directCandidate || null;

    if (!candidate && candidateId) {
      const { rows } = await db.query(
        `SELECT id, name, email, role, location, establishment_name, created_by_company_id, stage, selection_email_sent_at 
         FROM public.ca_candidates WHERE id = $1`,
        [Number(candidateId)]
      );
      if (rows[0]) candidate = rows[0];
    }

    if (!candidate) {
      console.warn(`[Candidate Selection Email] Candidate ${candidateId} not found.`);
      return false;
    }

    // Duplicate prevention: If selection email was already sent to this candidate, skip sending!
    if (candidate.selection_email_sent_at) {
      console.log(`[Candidate Selection Email] Selection email already sent to candidate ${candidate.id} on ${candidate.selection_email_sent_at}. Skipping duplicate.`);
      return false;
    }

    const candidateEmail = directEmail || candidate?.email;
    const candidateName = directName || candidate?.name || "Candidate";
    const jobRole = directRole || candidate?.role || "Position";
    const establishmentName = directEstName || candidate?.establishment_name || "";
    const activeCompanyId = candidate?.created_by_company_id || companyId;
    const candidateLocation = candidate?.location || "";

    if (!candidateEmail) {
      console.log(`[Candidate Selection Email] Candidate ${candidate.id || candidateName} has no email configured, skipping email.`);
      return false;
    }

    // Check for existing offer in ca_offers
    let approvedOffer = null;
    try {
      const { rows: offerRows } = await db.query(
        `SELECT * FROM public.ca_offers WHERE candidate_id = $1 ORDER BY id DESC LIMIT 1`,
        [candidate.id]
      );
      if (offerRows[0]) {
        const off = offerRows[0];
        // Offer is considered approved only if approval_status is 'Approved' OR status is 'Approved'
        const isApproved = off.approval_status === "Approved" || off.status === "Approved";
        if (isApproved) {
          approvedOffer = off;
        }
      }
    } catch (err) {
      console.warn("[Candidate Selection Email] Error checking ca_offers:", err.message);
    }

    // Strictly resolve the company and logo associated with this position
    const { companyName, logoUrl, initials } = await resolvePositionCompany({
      role: jobRole,
      establishmentName,
      companyId: activeCompanyId,
    });

    const subject = `Congratulations! You've Been Selected – ${jobRole} | ${companyName}`;
    const html = buildCandidateSelectionEmailHtml({
      candidateName,
      jobRole,
      companyName,
      logoUrl,
      initials,
      offer: approvedOffer,
      candidateLocation,
    });

    const sent = await sendMail({
      to: candidateEmail,
      subject,
      html,
      fromName: `${companyName} Talent Acquisition`,
    });

    if (sent) {
      // Record selection_email_sent_at timestamp in database to prevent future duplicate sends
      await db.query(
        `UPDATE public.ca_candidates SET selection_email_sent_at = NOW() WHERE id = $1`,
        [candidate.id]
      ).catch((err) => console.warn("[Candidate Selection Email] Failed to record selection_email_sent_at:", err.message));

      console.log(`[Candidate Selection Email] Successfully sent selection email to ${candidateEmail} for ${jobRole} at ${companyName}`);
    }
    return sent;
  } catch (err) {
    console.error("[Candidate Selection Email] Error sending selection email:", err.message);
    return false;
  }
};
