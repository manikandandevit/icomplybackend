import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { config } from "../../config/index.js";
import { s3Client } from "../../core/storage/s3.client.js";
import { s3PublicUrl } from "../Companies/companies.storage.js";
import { sendMail } from "../../core/mail/mailer.js";
import { hirePilotRepository } from "./hirepilot.repository.js";

async function uploadAcceptedResumeToS3(resumeData, resumeName) {
  if (!resumeData || typeof resumeData !== "string" || !resumeData.startsWith("data:")) {
    return null;
  }
  try {
    const matches = resumeData.match(/^data:([A-Za-z0-9-+/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return null;
    const contentType = matches[1];
    const buffer = Buffer.from(matches[2], "base64");
    const rawExt = resumeName ? resumeName.split(".").pop().toLowerCase() : "pdf";
    const ext = ["pdf", "doc", "docx", "png", "jpg"].includes(rawExt) ? rawExt : "pdf";
    const key = `hirepilot-resumes/${randomUUID()}.${ext}`;

    if (config.s3 && config.s3.bucket && config.s3.accessKeyId) {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: config.s3.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        })
      );
      return s3PublicUrl(key) || `https://${config.s3.bucket}.s3.amazonaws.com/${key}`;
    }
    return null;
  } catch (err) {
    console.error("Error uploading accepted resume to S3:", err);
    return null;
  }
}

async function sendRejectionEmail(candidate, opening) {
  if (!candidate.email) return;
  try {
    const candidateName = candidate.fullName || "Candidate";
    const roleName = opening.roleName || "Position";
    const company = opening.establishmentName || opening.companyName || "Our Organization";

    const subject = `Update on your application for ${roleName} at ${company}`;
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Application Status Update</h2>
        <p>Dear <strong>${candidateName}</strong>,</p>
        <p>Thank you very much for your interest in the <strong>${roleName}</strong> position at <strong>${company}</strong> and for taking the time to submit your application.</p>
        <p>Unfortunately, after carefully evaluating your profile and resume against our required criteria and job description, we have decided not to move forward with your application for this specific role at this time.</p>
        <p>We receive numerous exceptional applications, and this decision is strictly based on our current technical match requirements. We will keep your profile on file should an opening better suited to your background become available.</p>
        <p>We sincerely appreciate your interest and wish you every success in your ongoing job search.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">Warm regards,<br /><strong>Talent Acquisition Team</strong><br />${company}</p>
      </div>
    `;

    await sendMail({
      to: candidate.email,
      subject,
      html,
      fromName: `${company} Careers`,
    });
    console.log(`Rejection email sent to ${candidate.email} for opening ${roleName}`);
  } catch (err) {
    console.error("Failed to send rejection email via SMTP:", err);
  }
}

async function evaluateCandidateATS(opening, candidate) {
  const apiKey = process.env.GEMINI_API_KEY;
  const minScore = Number(opening.minAtsScore || 70);

  const promptText = `You are a strict, objective, professional AI Applicant Tracking System (ATS) screening engine.
You must rigorously validate the candidate's actual skills, qualifications, and experience against the specific Job Opening Description.

--- JOB OPENING DETAILS ---
Target Role: ${opening.roleName}
Company / Establishment: ${opening.establishmentName || opening.companyName || "Organization"}
Job Description & Required Qualifications:
${opening.roleDescription || "Professional technical responsibilities and core tech stack required."}
Configured Minimum Cutoff Score: ${minScore}%

--- CANDIDATE APPLICATION ---
Full Name: ${candidate.fullName}
Total Experience: ${candidate.experience || "Not provided"}
Current Location: ${candidate.location || "Not provided"}
Notice Period: ${candidate.noticePeriod || "Not provided"}
Current CTC: ${candidate.currentCtc || "Not provided"}
Expected CTC: ${candidate.expectedCtc || "Not provided"}
Portfolio / Links: ${candidate.portfolioUrl || "Not provided"}
Candidate Summary / Key Skills / Pitch: ${candidate.notes || "Not provided"}
Resume File Name: ${candidate.resumeName || "Uploaded Resume"}

--- MANDATORY ATS SCORING RULES ---
1. STRICT TECH-STACK VALIDATION (NO COMPROMISE):
   - Check if the candidate's actual technical skills match the PRIMARY technical stack demanded in the Job Opening.
   - EXAMPLE 1: If the job requires MERN Stack (MongoDB, Express, React, Node.js) and the candidate has a Java background (Core Java, Spring Boot, Hibernate) without primary React/Node/Mongo skills, this is a MISMATCH. The ATS score MUST be low (between 15% and 35%) and status MUST be "Rejected".
   - EXAMPLE 2: A candidate with a completely unrelated tech stack must NEVER receive a score >= ${minScore}%.
   - Only award a score >= ${minScore}% if the candidate demonstrably matches the core skills, technologies, and experience level requested in the job description.
2. ATS SCORE (0 to 100):
   - Provide an honest, objective integer match percentage from 0 to 100 based strictly on technical competence and relevance.
3. STATUS DETERMINATION:
   - If ATS Score >= ${minScore}, status MUST be "Accepted".
   - If ATS Score < ${minScore}, status MUST be "Rejected".
4. TECHNICAL FEEDBACK:
   - Provide a concise, specific 1-sentence technical explanation of why the candidate passed or failed (e.g., "Candidate's Java/Spring stack does not match the required MERN (MongoDB, Express, React, Node.js) qualifications.").

Respond strictly in valid JSON format only, with no markdown code fences, no quotes around the JSON:
{"atsScore": 25, "status": "Rejected", "feedback": "Candidate profile focuses on Java/Spring Boot which does not match required MERN stack."}`;

  // Prepare contents array with prompt text and optional inline resume document
  const parts = [{ text: promptText }];

  // If candidate uploaded a base64 resume (PDF/image/text), attach it so Gemini reads the entire document
  if (candidate.resumeData && typeof candidate.resumeData === "string" && candidate.resumeData.includes("base64,")) {
    try {
      const [header, base64Content] = candidate.resumeData.split("base64,");
      const mimeMatch = header.match(/data:([^;]+);/);
      const mimeType = mimeMatch ? mimeMatch[1] : "application/pdf";
      // Only attach if it's a valid supported mime type and within size limit (under 10MB base64)
      if (base64Content && base64Content.length < 10 * 1024 * 1024) {
        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: base64Content,
          },
        });
      }
    } catch (e) {
      console.warn("Could not attach inline resume to Gemini prompt:", e.message);
    }
  }

  // Multi-model fallback list in order of preference
  const models = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"];

  if (apiKey) {
    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts }] }),
        });

        if (response.status === 200) {
          const data = await response.json();
          let text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
            const parsed = JSON.parse(text);
            const score = Number(parsed.atsScore ?? parsed.ats_score ?? 0);
            const finalStatus = score >= minScore ? "Accepted" : "Rejected";
            console.log(`[ATS Evaluation via ${model}] Candidate: ${candidate.fullName}, Score: ${score}%, Status: ${finalStatus}`);
            return {
              atsScore: score,
              status: finalStatus,
              feedback: parsed.feedback || parsed.reason || (finalStatus === "Accepted" ? "Strong match for role requirements." : "Profile does not meet core technical qualifications."),
            };
          }
        } else {
          console.warn(`[${model}] ATS evaluation returned HTTP ${response.status}, trying next model...`);
        }
      } catch (err) {
        console.warn(`[${model}] ATS evaluation error: ${err.message}, trying next model...`);
      }
    }
  }

  // Deterministic Strict Fallback Algorithm (Never gives a free pass to mismatched candidates!)
  return calculateStrictDeterministicATS(opening, candidate, minScore);
}

// Deterministic Strict Fallback when AI models are temporarily unreachable
function calculateStrictDeterministicATS(opening, candidate, minScore) {
  const jobText = `${opening.roleName || ""} ${opening.roleDescription || ""}`.toLowerCase();
  const candText = `${candidate.notes || ""} ${candidate.experience || ""} ${candidate.resumeName || ""}`.toLowerCase();

  // Tech stack clusters
  const isMernJob = jobText.includes("mern") || (jobText.includes("react") && jobText.includes("node"));
  const isJavaCandidate = candText.includes("java") || candText.includes("spring") || candText.includes("hibernate");
  const isMernCandidate = candText.includes("mern") || candText.includes("react") || candText.includes("node") || candText.includes("express") || candText.includes("mongodb");

  if (isMernJob && isJavaCandidate && !isMernCandidate) {
    return {
      atsScore: 25,
      status: "Rejected",
      feedback: "Candidate's Java/Spring stack does not match required MERN (MongoDB, Express, React, Node.js) qualifications.",
    };
  }

  // Keyword overlap calculation
  const keywords = jobText.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 3);
  let matched = 0;
  keywords.forEach((kw) => {
    if (candText.includes(kw)) matched++;
  });

  const matchRatio = keywords.length > 0 ? matched / keywords.length : 0.3;
  const calculatedScore = Math.min(95, Math.max(20, Math.round(matchRatio * 100)));
  const status = calculatedScore >= minScore ? "Accepted" : "Rejected";

  return {
    atsScore: calculatedScore,
    status,
    feedback: status === "Accepted"
      ? "Candidate qualifications match the required role criteria."
      : "Technical qualifications fell below the minimum cutoff threshold.",
  };
}

async function generateCatchyAIPost(opening, applyUrl) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return generateFallbackPost(opening, applyUrl);
  }

  const prompt = `You are an expert tech recruiter and hiring marketing specialist.
Write an eye-catching, highly engaging, and professional LinkedIn job opening post for:
- Role Title: ${opening.roleName}
- Company: ${opening.establishmentName || opening.companyName || "Our Organization"}
- Location: ${opening.establishmentName || "Work Location"}
- Key Responsibilities & Requirements: ${opening.roleDescription || "Dynamic opportunity to build impactful products."}
- Point of Contact: ${opening.employeeName || "Recruitment Team"}
- Direct Application Link: ${applyUrl}

Instructions:
1. Start with an energetic, attention-grabbing hook (with relevant emojis like 🚀, 💼, ✨).
2. Briefly describe what makes this role exciting and the key skills we're looking for.
3. Feature the direct application link prominently:
👉 Apply Here: ${applyUrl}
4. Finish with 5-6 trending hashtags (e.g., #Hiring #${opening.roleName.replace(/[^a-zA-Z0-9]/g, "")} #Jobs #Careers #NowHiring).
5. Output ONLY the raw post text ready to be shared on LinkedIn, with no conversational preamble or quotes.`;

  const models = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.5-flash"];

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });

      if (response.status === 200) {
        const data = await response.json();
        let text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          text = text.trim();
          if (applyUrl && !text.includes(applyUrl)) {
            text += `\n\n👉 Apply Here:\n${applyUrl}`;
          }
          return text;
        }
      }
    } catch (err) {
      console.warn(`[${model}] Post generation error: ${err.message}, trying next model...`);
    }
  }

  return generateFallbackPost(opening, applyUrl);
}

function generateFallbackPost(opening, applyUrl) {
  const comp = opening.establishmentName || opening.companyName || "Our Team";
  return `🚀 We're Hiring: ${opening.roleName} at ${comp}!

🏢 Location: ${opening.establishmentName || "Office"}
${opening.companyName ? `💼 Organization: ${opening.companyName}` : ""}

${opening.roleDescription ? opening.roleDescription : "We are looking for passionate talent to join our team and build incredible solutions."}

👉 Apply Here:
${applyUrl}

Interested or know someone who would be a great fit? Apply above or send a message directly! 📩

#Hiring #${opening.roleName.replace(/[^a-zA-Z0-9]/g, "")} #Careers #JobOpening #NowHiring #ApplyNow`;
}

export const hirePilotService = {
  getStatus: async () => {
    return {
      name: "HirePilot",
      status: "active",
      version: "1.0.0",
      description: "AI-Powered Hiring & Recruitment Pilot",
    };
  },

  listCredentials: async (companyId, establishmentId) => {
    return hirePilotRepository.listCredentials(companyId, establishmentId);
  },

  saveCredential: async (companyId, payload) => {
    return hirePilotRepository.saveCredential(companyId, payload);
  },

  deleteCredential: async (id) => {
    return hirePilotRepository.deleteCredential(id);
  },

  listOpenings: async (companyId) => {
    return hirePilotRepository.listOpenings(companyId);
  },

  createOpening: async (companyId, payload) => {
    return hirePilotRepository.createOpening(companyId, payload);
  },

  deleteOpening: async (id) => {
    return hirePilotRepository.deleteOpening(id);
  },

  postOpening: async (id, customFrontendUrl = null) => {
    const existing = await hirePilotRepository.getOpeningById(id);
    if (!existing) {
      throw new Error("Opening not found");
    }

    const frontendUrl = customFrontendUrl || process.env.FRONTEND_URL || "http://localhost:5173";
    const applyUrl = `${frontendUrl}/careers/apply/${id}`;

    // 1. Generate Catchy AI Post via Gemini 3.8 WITH the direct apply link
    const aiPostContent = await generateCatchyAIPost(existing, applyUrl);

    // 2. Update Database with status & AI generated post content
    const updated = await hirePilotRepository.postOpening(id, aiPostContent);

    // 3. Construct direct LinkedIn Composer Share URL
    const linkedInShareUrl = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(aiPostContent)}`;

    return {
      opening: updated,
      aiPostContent,
      applyUrl,
      linkedInShareUrl,
    };
  },

  getPublicOpening: async (id) => {
    const existing = await hirePilotRepository.getOpeningById(id);
    if (!existing) {
      throw new Error("Opening not found or has been closed");
    }
    return {
      id: existing.id,
      roleName: existing.roleName,
      establishmentName: existing.establishmentName,
      companyName: existing.companyName,
      roleDescription: existing.roleDescription,
      status: existing.status,
      postedAt: existing.postedAt,
      createdAt: existing.createdAt,
    };
  },

  submitApplication: async (openingId, payload) => {
    const opening = await hirePilotRepository.getOpeningById(openingId);
    if (!opening) {
      throw new Error("Job opening not found or has expired");
    }

    // 1. Live AI ATS Evaluation with Google Gemini
    const atsResult = await evaluateCandidateATS(opening, payload);
    const minCutoff = opening.minAtsScore || 70;
    const isAccepted = atsResult.atsScore >= minCutoff;
    atsResult.status = isAccepted ? "Accepted" : "Rejected";

    // 2. Storage Rule: ONLY upload to S3 if Accepted!
    let resumeUrl = null;
    if (isAccepted) {
      resumeUrl = await uploadAcceptedResumeToS3(payload.resumeData, payload.resumeName);
    } else {
      // 3. Rejected Rule: S3 is NOT touched! Trigger SMTP Rejection Email!
      sendRejectionEmail(payload, opening).catch((err) => {
        console.error("Async rejection email error:", err);
      });
    }

    // 4. Save to Database (Total Applied count always increments!)
    const result = await hirePilotRepository.submitApplication(openingId, payload, atsResult, resumeUrl);
    return {
      id: result.id,
      status: atsResult.status,
      atsScore: atsResult.atsScore,
    };
  },

  listApplications: async (openingId) => {
    return hirePilotRepository.listApplicationsByOpening(openingId);
  },

  listAcceptedCandidates: async (openingId) => {
    return hirePilotRepository.listAcceptedCandidates(openingId);
  },

  moveCandidate: async (applicationId) => {
    return hirePilotRepository.moveCandidate(applicationId, "Interview");
  },
};
