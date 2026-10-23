import { caInterviewsRepository } from "./caInterviews.repository.js";
import { caCandidatesRepository } from "../CACandidates/caCandidates.repository.js";
import { sendInterviewFeedbackEmail, sendInterviewShortlistedEmail } from "./caInterviews.email.js";
import { sendHiringManagerDocumentCollectionRequest } from "../CACandidates/caWorkflow.email.js";

export const caInterviewsService = {
  async list(companyId) {
    return caInterviewsRepository.list(companyId);
  },

  async create(companyId, payload) {
    const outcomeStatuses = ["On Hold", "Selected", "Rejected", "No Show", "Interview Cancelled"];
    const isOutcome = outcomeStatuses.includes(payload?.type) || outcomeStatuses.includes(payload?.status);

    if (isOutcome) {
      const outcomeStatus = outcomeStatuses.includes(payload?.type) ? payload.type : payload.status;
      if (payload?.candidateId) {
        await caCandidatesRepository.updateOutcomeStatus(payload.candidateId, companyId, outcomeStatus).catch(() => {});
        if (outcomeStatus === "Selected") {
          void sendHiringManagerDocumentCollectionRequest({
            candidateId: payload.candidateId,
            companyId,
          }).catch((e) => console.error("Failed to trigger HM doc collection email on interview create:", e));
        }
      }
      void sendInterviewFeedbackEmail({
        candidateId: payload?.candidateId,
        companyId,
        outcomeStatus,
        candidateEmail: payload?.candidateEmail || payload?.email,
        candidateName: payload?.candidateName || payload?.name,
        role: payload?.role,
      }).catch((e) => console.error("Failed to trigger outcome status email on create:", e));

      return {
        id: Date.now(),
        candidateId: payload?.candidateId,
        candidate: payload?.candidateName,
        status: outcomeStatus,
        type: outcomeStatus,
        isOutcome: true,
      };
    }

    // Block scheduling interviews for candidates who are in Rejected stage
    if (payload?.candidateId && !isOutcome) {
      try {
        const candidate = await caCandidatesRepository.findById(payload.candidateId, companyId);
        if (candidate && ((candidate.stage || "").toLowerCase() === "rejected")) {
          const error = new Error("Cannot schedule an interview for a rejected candidate.");
          error.statusCode = 400;
          throw error;
        }
      } catch (err) {
        if (err.statusCode === 400) throw err;
      }
    }

    const interview = await caInterviewsRepository.create(companyId, payload);

    // Automatically update candidate stage to the scheduled interview round
    if (payload?.candidateId && !isOutcome) {
      const roundStage = payload.roundName || payload.type || "Round 1: Technical interview";
      try {
        await caCandidatesRepository.updateStage(payload.candidateId, companyId, roundStage);
      } catch (err) {
        console.warn("Could not sync candidate stage to interview round:", err.message);
      }
    }

    // Automatically trigger Shortlisted & Interview Scheduled email
    if (payload?.inviteSent !== false) {
      void sendInterviewShortlistedEmail({
        candidateId: payload?.candidateId,
        interviewId: interview?.id,
        companyId,
        role: payload?.role,
        interviewer: payload?.interviewer,
        type: payload?.type,
        roundName: payload?.roundName || payload?.type,
        datetime: payload?.datetime,
        mode: payload?.mode,
        meetingLink: payload?.meetingLink || payload?.meeting_link,
        venue: payload?.venue,
        candidateEmail: payload?.candidateEmail || payload?.email,
        candidateName: payload?.candidateName || payload?.name,
      }).catch((e) => console.error("Failed to trigger shortlisted interview email on create:", e));
    }

    return interview;
  },

  async update(id, companyId, payload) {
    const interview = await caInterviewsRepository.update(id, companyId, payload);
    const isOutcome = ["On Hold", "Selected", "Rejected", "No Show", "Interview Cancelled"].includes(payload?.status || payload?.type);
    if (interview) {
      if (isOutcome) {
        void sendInterviewFeedbackEmail({
          candidateId: interview.candidateId || payload?.candidateId,
          interviewId: id,
          companyId,
          outcomeStatus: payload?.status || payload?.type,
          role: interview.role || payload?.role,
          candidateName: interview.candidate || payload?.candidateName,
          candidateEmail: payload?.candidateEmail || payload?.email,
        }).catch((e) => console.error("Failed to trigger email on interview outcome update:", e));
      } else if (payload?.inviteSent !== false) {
        void sendInterviewShortlistedEmail({
          interviewId: id,
          companyId,
          candidateId: interview.candidateId || payload?.candidateId,
          role: interview.role || payload?.role,
          interviewer: interview.interviewer || payload?.interviewer,
          type: interview.roundName || interview.type || payload?.type,
          roundName: interview.roundName || payload?.roundName || payload?.type,
          datetime: interview.datetime || payload?.datetime,
          mode: interview.mode || payload?.mode,
          candidateEmail: payload?.candidateEmail || payload?.email,
          candidateName: interview.candidate || payload?.candidateName,
        }).catch((e) => console.error("Failed to trigger email on interview update:", e));
      }
    }
    return interview;
  },

  async updateStatus(id, companyId, status) {
    const interview = await caInterviewsRepository.updateStatus(id, companyId, status);
    if (interview) {
      if (status === "Selected" && interview.candidateId) {
        void sendHiringManagerDocumentCollectionRequest({
          candidateId: interview.candidateId,
          companyId,
        }).catch((e) => console.error("Failed to trigger HM doc collection email on interview status update:", e));
      }
      void sendInterviewFeedbackEmail({
        candidateId: interview.candidateId,
        interviewId: id,
        companyId,
        outcomeStatus: status,
        role: interview.role,
        candidateName: interview.candidate,
      }).catch((e) => console.error("Failed to trigger email on status update:", e));
    }
    return interview;
  },

  async submitFeedback(id, companyId, payload) {
    const interview = await caInterviewsRepository.submitFeedback(id, companyId, payload);

    // If feedback specifies an outcome status (Selected, Rejected, On Hold), update candidate stage
    if (payload?.outcomeStatus && interview?.candidateId) {
      await caCandidatesRepository.updateOutcomeStatus(
        interview.candidateId,
        companyId,
        payload.outcomeStatus,
        payload.statusReason
      ).catch(() => {});

      if (payload.outcomeStatus === "Selected") {
        void sendHiringManagerDocumentCollectionRequest({
          candidateId: interview.candidateId,
          companyId,
        }).catch((e) => console.error("Failed to trigger HM doc collection email on submit feedback:", e));
      }
    }

    // Automatically trigger email notification to candidate in background
    if (payload?.outcomeStatus) {
      void sendInterviewFeedbackEmail({
        candidateId: interview?.candidateId,
        interviewId: id,
        companyId,
        outcomeStatus: payload.outcomeStatus,
        statusReason: payload.statusReason,
      }).catch((e) => console.error("Failed to trigger interview feedback email:", e));
    }

    return interview;
  },

  async sendInvite(id, companyId, payload = {}) {
    let interview = await caInterviewsRepository.sendInvite(id, companyId);

    const candidateId = payload.candidateId || interview?.candidateId;
    let candidateEmail = payload.candidateEmail || payload.email || interview?.email;
    let candidateName = payload.candidateName || payload.name;
    let role = payload.role || interview?.role;
    let interviewer = payload.interviewer || interview?.interviewer;
    let roundName = payload.roundName || payload.type || interview?.roundName || interview?.type;
    let datetime = payload.datetime || interview?.datetime;
    let mode = payload.mode || interview?.mode;
    let meetingLink = payload.meetingLink || payload.meeting_link || interview?.meetingLink;
    let venue = payload.venue || interview?.venue;

    // Lookup candidate from DB to ensure email is accurate
    if (candidateId) {
      try {
        const cand = await caCandidatesRepository.findById(candidateId, companyId);
        if (cand?.email) {
          candidateEmail = cand.email;
          candidateName = cand.name || candidateName;
          role = cand.role || role;
        }
      } catch (e) {
        console.warn("Could not lookup candidate:", e.message);
      }
    }

    // If interview was dummy ID or not in DB, create it
    if ((Number(id) === 101 || !interview?.candidateId) && candidateId) {
      try {
        const created = await caInterviewsRepository.create(companyId, {
          candidateId,
          role: role || "Software Engineer",
          interviewer: interviewer || "Suresh Reddy",
          type: roundName || "Round 1: Technical interview",
          roundName: roundName || "Round 1: Technical interview",
          datetime: datetime || "17 Sep 2026 · 11:00 AM",
          mode: mode || "Online",
          status: "Scheduled",
          inviteSent: true,
          meetingLink,
          venue,
        });
        if (created?.id) interview = created;
      } catch (e) {
        console.warn("Could not create interview on sendInvite:", e.message);
      }
    }

    // Trigger Shortlisted & Interview Scheduled email
    let emailSent = false;
    try {
      emailSent = await sendInterviewShortlistedEmail({
        interviewId: interview?.id || id,
        companyId,
        candidateId,
        candidateEmail,
        candidateName,
        role,
        interviewer,
        type: roundName,
        roundName,
        datetime,
        mode,
        meetingLink,
        venue,
      });
    } catch (err) {
      console.error("Failed to send shortlisted email on sendInvite:", err);
    }

    return { ...interview, emailSent, candidateEmail, candidateName };
  },

  async delete(id, companyId) {
    return caInterviewsRepository.delete(id, companyId);
  }
};
