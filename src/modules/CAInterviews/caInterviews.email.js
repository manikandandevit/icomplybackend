import { db } from "../../core/db/pool.js";
import { sendMail } from "../../core/mail/mailer.js";
import {
  resolvePositionCompany,
  sendCandidateRejectionEmail,
} from "../CACandidates/caCandidates.email.js";

/**
 * Builds the responsive, MNC-grade HTML email template for interview notifications
 * (Invitations, Next Round Progression, Feedback Outcomes).
 * Reuses the exact same corporate header, company logo, typography, closing and footer.
 */
export const buildInterviewNotificationEmailHtml = ({
  candidateName,
  jobRole,
  companyName,
  logoUrl,
  initials,
  headline,
  messageParagraph1,
  messageParagraph2,
  showScheduleBox = true,
  displayRound,
  displayDatetime,
  displayMode,
  cleanMeetingLink,
  hrefMeetingLink,
  venue,
  closingNote,
}) => {
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${companyName}" width="44" height="44" style="display: block; width: 44px; height: 44px; border-radius: 8px; border: 1px solid #e2e8f0; object-fit: contain; background: #ffffff;" />`
    : `<table cellpadding="0" cellspacing="0" border="0" style="width: 44px; height: 44px; border-radius: 8px; background: #0f172a; text-align: center;"><tr><td align="center" valign="middle" style="color: #ffffff; font-size: 16px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">${initials || "TA"}</td></tr></table>`;

  const scheduleBoxHtml = showScheduleBox ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 22px 0 24px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
      <tr>
        <td style="padding: 18px 20px;">
          <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            Interview Details
          </div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; width: 120px; font-weight: 500;">Position</td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: 600; text-align: right;">${jobRole}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Round</td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: 600; text-align: right;">${displayRound || "Interview Round"}</td>
            </tr>
            ${displayDatetime && displayDatetime !== "To be communicated" ? `
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Date &amp; Time</td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: 600; text-align: right;">${displayDatetime}</td>
            </tr>` : ""}
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Mode</td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: 600; text-align: right;">${displayMode || "Online"}</td>
            </tr>
            ${cleanMeetingLink ? `
            <tr>
              <td colspan="2" style="padding-top: 14px;">
                <div style="font-weight: 600; color: #2563eb; margin-bottom: 4px; font-size: 14px;">Join Interview:</div>
                <a href="${hrefMeetingLink}" target="_blank" style="color: #2563eb; text-decoration: underline; font-size: 14px; word-break: break-all; font-weight: 500;">
                  ${cleanMeetingLink}
                </a>
              </td>
            </tr>` : (venue ? `
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Venue</td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: 600; text-align: right;">${venue}</td>
            </tr>` : "")}
          </table>
        </td>
      </tr>
    </table>
  ` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${headline} – ${jobRole} | ${companyName}</title>
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
              <h2 class="email-title" style="margin: 0 0 20px 0; font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1.35; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">${headline}</h2>

              <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.65; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                Dear ${candidateName},
              </p>

              <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.65; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                ${messageParagraph1}
              </p>

              ${messageParagraph2 ? `
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.65; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                ${messageParagraph2}
              </p>` : ""}

              ${scheduleBoxHtml}

              ${closingNote ? `
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #334155; line-height: 1.65; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                ${closingNote}
              </p>` : ""}

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
 * Triggers the Interview Schedule / Next Round Invitation email.
 * Includes previous round cleared confirmation when advancing to next round.
 * Prevents duplicate emails for the same schedule.
 */
export const sendInterviewShortlistedEmail = async ({
  candidateId,
  interviewId,
  companyId,
  role: directRole,
  interviewer: directInterviewer,
  type: directType,
  roundName: directRoundName,
  datetime: directDatetime,
  mode: directMode,
  meetingLink: directMeetingLink,
  venue: directVenue,
  candidateEmail: directEmail,
  candidateName: directName,
}) => {
  try {
    let candidateName = directName || "Candidate";
    let candidateEmail = directEmail || null;
    let candidateRole = directRole || "Position";
    let establishmentName = "";
    let activeCompanyId = companyId;

    let interviewer = directInterviewer || null;
    let type = directType || null;
    let roundName = directRoundName || null;
    let datetime = directDatetime || null;
    let mode = directMode || null;
    let meetingLink = directMeetingLink || null;
    let venue = directVenue || null;

    // 1. Fetch Candidate from DB
    if (candidateId && Number(candidateId) > 0) {
      const { rows } = await db.query(
        `SELECT name, email, role, establishment_name, created_by_company_id 
         FROM public.ca_candidates WHERE id = $1`,
        [Number(candidateId)]
      );
      if (rows[0]) {
        candidateName = rows[0].name || candidateName;
        candidateEmail = rows[0].email || candidateEmail;
        candidateRole = rows[0].role || candidateRole;
        establishmentName = rows[0].establishment_name || "";
        activeCompanyId = rows[0].created_by_company_id || activeCompanyId;
      }
    }

    // 2. Fetch Interview Details from DB
    let interviewRow = null;
    if (interviewId && Number(interviewId) > 0) {
      const { rows } = await db.query(
        `SELECT * FROM public.ca_interviews WHERE id = $1`,
        [Number(interviewId)]
      );
      if (rows[0]) {
        interviewRow = rows[0];
        if (!interviewer) interviewer = interviewRow.interviewer;
        if (!type) type = interviewRow.type;
        if (!roundName) roundName = interviewRow.round_name;
        if (!datetime) datetime = interviewRow.datetime;
        if (!mode) mode = interviewRow.mode;
        if (!meetingLink) meetingLink = interviewRow.meeting_link;
        if (!venue) venue = interviewRow.venue;
        if (interviewRow.role) candidateRole = interviewRow.role;
      }
    }

    if (!candidateEmail) {
      console.log(`[Interview Shortlisted Email] Candidate ${candidateId || candidateName} has no email, skipping.`);
      return false;
    }

    const displayRound = roundName || type || "Interview Round";
    const displayMode = (mode === "Video" || mode === "Online") ? "Online" : (mode || "Online");
    const displayDatetime = datetime || "To be communicated";

    // Duplicate Prevention Check:
    // If an invitation for this exact round & datetime was already sent, skip duplicate
    const dedupeKey = `Scheduled:${displayRound}:${displayDatetime}`;
    if (interviewRow?.invite_sent && interviewRow?.last_status_email_sent === dedupeKey) {
      console.log(`[Interview Shortlisted Email] Invitation email already sent for interview ${interviewId} (${dedupeKey}). Skipping duplicate.`);
      return false;
    }

    // Strictly resolve the company and logo associated with this position
    const { companyName, logoUrl, initials } = await resolvePositionCompany({
      role: candidateRole,
      establishmentName,
      companyId: activeCompanyId,
    });

    const cleanMeetingLink = meetingLink ? String(meetingLink).trim() : "";
    const hrefMeetingLink = cleanMeetingLink
      ? (/^https?:\/\//i.test(cleanMeetingLink) ? cleanMeetingLink : `https://${cleanMeetingLink}`)
      : "";

    // Determine if candidate is progressing to subsequent round (Round 2, Round 3, Final, Managerial)
    const lowerRound = displayRound.toLowerCase();
    const isNextRound = Boolean(
      lowerRound.includes("second") ||
      lowerRound.includes("round 2") ||
      lowerRound.includes("round 3") ||
      lowerRound.includes("third") ||
      lowerRound.includes("final") ||
      lowerRound.includes("hr") ||
      lowerRound.includes("managerial") ||
      (interviewRow?.rounds_completed && Number(interviewRow.rounds_completed) >= 2)
    );

    let subject = "";
    let headline = "";
    let messageParagraph1 = "";
    let messageParagraph2 = "";

    if (isNextRound) {
      subject = `Congratulations! You're Moving to the Next Round – ${candidateRole} | ${companyName}`;
      headline = "Congratulations! You're Moving to the Next Round";
      messageParagraph1 = `We are pleased to inform you that you have successfully cleared the previous interview round for the <strong>${candidateRole}</strong> position at <strong>${companyName}</strong>.`;
      messageParagraph2 = "We are delighted to invite you to the next stage of our recruitment process.";
    } else {
      subject = `Interview Invitation – ${displayRound} for ${candidateRole} | ${companyName}`;
      headline = `Interview Invitation – ${displayRound}`;
      messageParagraph1 = `We are pleased to inform you that your application for the <strong>${candidateRole}</strong> position at <strong>${companyName}</strong> has been shortlisted for an interview.`;
      messageParagraph2 = `We are delighted to invite you for your <strong>${displayRound}</strong> as part of our recruitment process.`;
    }

    const html = buildInterviewNotificationEmailHtml({
      candidateName,
      jobRole: candidateRole,
      companyName,
      logoUrl,
      initials,
      headline,
      messageParagraph1,
      messageParagraph2,
      showScheduleBox: true,
      displayRound,
      displayDatetime,
      displayMode,
      cleanMeetingLink,
      hrefMeetingLink,
      venue,
      closingNote: "Kindly confirm your availability and join the interview on time. We look forward to speaking with you.",
    });

    const sent = await sendMail({
      to: candidateEmail,
      subject,
      html,
      fromName: `${companyName} Talent Acquisition`,
    });

    if (sent && interviewId) {
      await db.query(
        `UPDATE public.ca_interviews 
         SET invite_sent = TRUE, invite_sent_at = NOW(), last_status_email_sent = $2, updated_at = NOW() 
         WHERE id = $1`,
        [Number(interviewId), dedupeKey]
      ).catch((e) => console.warn("Failed to record invite_sent status in ca_interviews:", e.message));

      console.log(`[Interview Shortlisted Email] Successfully sent invitation to ${candidateEmail} for ${displayRound} at ${companyName}`);
    }

    return sent;
  } catch (err) {
    console.error("[Interview Shortlisted Email] Error sending shortlisted email:", err.message);
    return false;
  }
};

/**
 * Triggers the Interview Outcome / Feedback Email to a candidate.
 * (First Round Shortlisted, Second Round Shortlisted, Final Round Shortlisted, HR Round, On Hold, No Show, Cancelled).
 * Prevents duplicate emails for the same outcomeStatus.
 */
export const sendInterviewFeedbackEmail = async ({
  candidateId,
  interviewId,
  companyId,
  outcomeStatus,
  statusReason,
  candidateEmail: directEmail,
  candidateName: directName,
  role: directRole,
}) => {
  try {
    if (!outcomeStatus) return false;

    // Special case: Rejected outcome is delegated to sendCandidateRejectionEmail
    if (outcomeStatus === "Rejected") {
      return await sendCandidateRejectionEmail({
        candidateId,
        companyId,
        candidateName: directName,
        candidateEmail: directEmail,
        role: directRole,
      });
    }

    // Special case: Selected outcome is handled by candidate selection & offer workflow
    if (outcomeStatus === "Selected") {
      return false;
    }

    // Duplicate Prevention Check:
    // If this interview already sent an email for this exact outcomeStatus, skip duplicate
    if (interviewId) {
      const { rows } = await db.query(
        `SELECT last_status_email_sent FROM public.ca_interviews WHERE id = $1`,
        [Number(interviewId)]
      );
      if (rows[0]?.last_status_email_sent === outcomeStatus) {
        console.log(`[Interview Feedback Email] Feedback email already sent for interview ${interviewId} (${outcomeStatus}). Skipping duplicate.`);
        return false;
      }
    }

    // 1. Fetch Candidate details from DB
    let candidateName = directName || "Candidate";
    let candidateEmail = directEmail || null;
    let candidateRole = directRole || "Position";
    let establishmentName = "";
    let activeCompanyId = companyId;

    if (candidateId && Number(candidateId) > 0) {
      const { rows } = await db.query(
        `SELECT name, email, role, establishment_name, created_by_company_id 
         FROM public.ca_candidates WHERE id = $1`,
        [Number(candidateId)]
      );
      if (rows[0]) {
        candidateName = rows[0].name || candidateName;
        candidateEmail = rows[0].email || candidateEmail;
        candidateRole = rows[0].role || candidateRole;
        establishmentName = rows[0].establishment_name || "";
        activeCompanyId = rows[0].created_by_company_id || activeCompanyId;
      }
    }

    if (!candidateEmail) {
      console.log(`[Interview Feedback Email] Candidate has no email on record, skipping email for status: ${outcomeStatus}`);
      return false;
    }

    // Strictly resolve the company and logo associated with this position
    const { companyName, logoUrl, initials } = await resolvePositionCompany({
      role: candidateRole,
      establishmentName,
      companyId: activeCompanyId,
    });

    let subject = "";
    let headline = "";
    let messageParagraph1 = "";
    let messageParagraph2 = "";
    let closingNote = "";

    if (outcomeStatus === "First Round Shortlisted") {
      subject = `Congratulations! You've Cleared Round 1 – ${candidateRole} | ${companyName}`;
      headline = "Congratulations! You've Cleared Round 1";
      messageParagraph1 = `We are pleased to inform you that you have successfully cleared the <strong>First Round (Technical / Screening)</strong> interview for the position of <strong>${candidateRole}</strong> at <strong>${companyName}</strong>.`;
      messageParagraph2 = "Our recruitment team was impressed with your background. We are in the process of scheduling your <strong>Second Round</strong>, and our team will share the schedule and meeting details shortly.";
      closingNote = "Thank you for your continued interest in joining our team. We look forward to connecting with you soon.";
    } else if (outcomeStatus === "Second Round Shortlisted") {
      subject = `Congratulations! You've Cleared Round 2 – ${candidateRole} | ${companyName}`;
      headline = "Congratulations! You've Cleared Round 2";
      messageParagraph1 = `Great news! You have successfully cleared the <strong>Second Round</strong> interview for the position of <strong>${candidateRole}</strong> at <strong>${companyName}</strong>.`;
      messageParagraph2 = "You have advanced to the next stage of our recruitment process. Our Talent Acquisition team will reach out with the schedule and interview details soon.";
      closingNote = "Thank you for your continued interest in joining our team. We look forward to connecting with you soon.";
    } else if (outcomeStatus === "Final Round Shortlisted") {
      subject = `Congratulations! You've Cleared the Final Round – ${candidateRole} | ${companyName}`;
      headline = "Congratulations! You've Cleared the Final Round";
      messageParagraph1 = `Fantastic job! You have successfully cleared the <strong>Final Technical Round</strong> for the position of <strong>${candidateRole}</strong> at <strong>${companyName}</strong>.`;
      messageParagraph2 = "The next and concluding step is the <strong>HR Discussion & Alignment Round</strong>. Our HR team will reach out to you shortly to coordinate this final discussion.";
      closingNote = "We look forward to connecting with you and wish you all the best for the upcoming stages.";
    } else if (outcomeStatus === "HR Round") {
      subject = `HR Discussion Update – ${candidateRole} | ${companyName}`;
      headline = "HR Discussion Round Update";
      messageParagraph1 = `Thank you for participating in the <strong>HR Discussion</strong> for the position of <strong>${candidateRole}</strong> at <strong>${companyName}</strong>.`;
      messageParagraph2 = "Our hiring committee is completing the final evaluation, and our team will be in touch with you shortly regarding the final decision.";
      closingNote = "We appreciate your patience and time throughout our recruitment process.";
    } else if (outcomeStatus === "On Hold") {
      subject = `Update on Your Application – ${candidateRole} | ${companyName}`;
      headline = "Application Status Update - On Hold";
      messageParagraph1 = `Thank you for taking the time to participate in our recruitment process for the position of <strong>${candidateRole}</strong> at <strong>${companyName}</strong>.`;
      messageParagraph2 = "We would like to inform you that your application has been placed <strong>On Hold</strong>. While our team was impressed with your background and discussions, we are currently reviewing our project timelines and resource allocations for this position.";
      closingNote = "Your profile remains active in our talent pipeline, and we will get back in touch with you as soon as there are further developments regarding this role.";
    } else if (outcomeStatus === "No Show") {
      subject = `Interview Status - Missed Session – ${candidateRole} | ${companyName}`;
      headline = "Interview Status - Missed Session";
      messageParagraph1 = `Our interview panel was scheduled to connect with you for your interview for the position of <strong>${candidateRole}</strong> at <strong>${companyName}</strong>, but we noted that you were unable to join the session.`;
      messageParagraph2 = "We understand that unexpected schedule conflicts or connectivity issues can arise. If you remain interested in this position and would like an opportunity to reschedule, please reply directly to this email at your earliest convenience with your availability.";
      closingNote = "We look forward to hearing from you.";
    } else if (outcomeStatus === "Interview Cancelled" || outcomeStatus === "Cancelled") {
      subject = `Interview Schedule Cancelled – ${candidateRole} | ${companyName}`;
      headline = "Interview Schedule - Cancelled";
      messageParagraph1 = `We are writing to inform you that your scheduled interview for the position of <strong>${candidateRole}</strong> at <strong>${companyName}</strong> has been <strong>Cancelled</strong>.`;
      messageParagraph2 = "Our Talent Acquisition team will review your application and keep you informed if this round will be rescheduled or if there are any further updates regarding your candidacy.";
      closingNote = "We appreciate your patience and understanding.";
    } else {
      console.log(`[Interview Feedback Email] Unsupported feedback status: ${outcomeStatus}`);
      return false;
    }

    const html = buildInterviewNotificationEmailHtml({
      candidateName,
      jobRole: candidateRole,
      companyName,
      logoUrl,
      initials,
      headline,
      messageParagraph1,
      messageParagraph2,
      showScheduleBox: false,
      closingNote,
    });

    const sent = await sendMail({
      to: candidateEmail,
      subject,
      html,
      fromName: `${companyName} Talent Acquisition`,
    });

    if (sent && interviewId) {
      await db.query(
        `UPDATE public.ca_interviews 
         SET last_status_email_sent = $2, updated_at = NOW() 
         WHERE id = $1`,
        [Number(interviewId), outcomeStatus]
      ).catch((e) => console.warn("Failed to record last_status_email_sent in ca_interviews:", e.message));

      console.log(`[Interview Feedback Email] Successfully sent "${outcomeStatus}" email to ${candidateEmail}`);
    }

    return sent;
  } catch (err) {
    console.error("[Interview Feedback Email] Error sending feedback email:", err.message);
    return false;
  }
};
