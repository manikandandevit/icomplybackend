import PDFDocument from "pdfkit";
import { db } from "../../core/db/pool.js";

export async function generateCandidatePdfBuffer(candidate) {
  let candidateEmail = candidate.email;
  let candidatePhone = candidate.phone;

  // Resolve true email and phone from DB if missing or fallback
  try {
    if ((!candidateEmail || candidateEmail.includes("@email.com")) && (candidate.id || candidate.name)) {
      const dbRow = await db.query(
        `SELECT email, phone FROM public.ca_candidates 
         WHERE (id = $1 OR LOWER(TRIM(name)) = LOWER(TRIM($2))) 
           AND email IS NOT NULL AND email != '' 
         ORDER BY id DESC LIMIT 1`,
        [Number(candidate.id) || 0, candidate.name || '']
      );
      if (dbRow.rows[0]?.email) {
        candidateEmail = dbRow.rows[0].email;
        if (!candidatePhone && dbRow.rows[0].phone) {
          candidatePhone = dbRow.rows[0].phone;
        }
      }
    }
  } catch (err) {
    console.warn("Could not query candidate email for PDF:", err.message);
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 40,
        info: {
          Title: `${candidate.name || "Candidate"} - Resume Profile`,
          Author: "iComply Talent Acquisition",
        },
      });

      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));

      // Header Banner
      doc.rect(0, 0, doc.page.width, 100).fill("#0c2340");

      doc.fillColor("#ffffff").fontSize(22).font("Helvetica-Bold")
        .text(candidate.name || "Candidate Profile", 40, 30);

      doc.fillColor("#f97316").fontSize(13).font("Helvetica-Bold")
        .text(`${candidate.role || "Job Applicant"} · ${candidate.stage || "Applied"}`, 40, 60);

      doc.fillColor("#94a3b8").fontSize(10).font("Helvetica")
        .text(`AI Match Score: ${candidate.match || 85}% · Applied: ${candidate.applied || new Date().toLocaleDateString("en-GB")}`, 40, 78);

      let y = 125;

      // Overview Section
      doc.fillColor("#0c2340").fontSize(14).font("Helvetica-Bold")
        .text("Candidate Information", 40, y);
      
      doc.rect(40, y + 20, doc.page.width - 80, 1).fill("#e2e8f0");
      y += 32;

      const fields = [
        ["Full Name", candidate.name || "N/A"],
        ["Target Role", candidate.role || "N/A"],
        ["Email", candidateEmail || "N/A"],
        ["Phone", candidatePhone || candidate.phone || "N/A"],
        ["Location", candidate.location || (candidate.details ? candidate.details.split("·")[1]?.trim() : "") || "N/A"],
        ["Experience", candidate.experience || (candidate.details ? candidate.details.split("·")[0]?.trim() : "") || "N/A"],
        ["Highest Qualification", candidate.highestQualification || "N/A"],
        ["Expected CTC", candidate.expectedCtc ? `INR ${candidate.expectedCtc}` : "N/A"],
        ["Notice Period", candidate.noticePeriod || "N/A"],
        ["Establishment", candidate.establishmentName || "N/A"],
        ["Recruitment Source", candidate.source || "Direct / Website"],
        ["Current Stage", candidate.stage || "Applied"],
      ];

      doc.fontSize(10).font("Helvetica");

      for (let i = 0; i < fields.length; i += 2) {
        const item1 = fields[i];
        const item2 = fields[i + 1];

        doc.fillColor("#64748b").font("Helvetica-Bold").text(item1[0], 40, y, { width: 110 });
        doc.fillColor("#0c2340").font("Helvetica").text(item1[1], 155, y, { width: 140 });

        if (item2) {
          doc.fillColor("#64748b").font("Helvetica-Bold").text(item2[0], 310, y, { width: 110 });
          doc.fillColor("#0c2340").font("Helvetica").text(item2[1], 425, y, { width: 140 });
        }

        y += 24;
      }

      y += 15;

      // Key Skills Section
      doc.fillColor("#0c2340").fontSize(14).font("Helvetica-Bold")
        .text("Skills & Proficiencies", 40, y);
      
      doc.rect(40, y + 20, doc.page.width - 80, 1).fill("#e2e8f0");
      y += 32;

      const skillsList = Array.isArray(candidate.skills) && candidate.skills.length > 0
        ? candidate.skills
        : ["Problem Solving", "Team Leadership", "Domain Expertise"];

      let skillX = 40;
      doc.fontSize(10);
      skillsList.forEach((skill) => {
        const skillText = String(skill).trim();
        const textWidth = doc.widthOfString(skillText);
        const boxWidth = textWidth + 18;

        if (skillX + boxWidth > doc.page.width - 40) {
          skillX = 40;
          y += 28;
        }

        doc.roundedRect(skillX, y, boxWidth, 22, 5).fill("#eff6ff");
        doc.fillColor("#2563eb").font("Helvetica-Bold").text(skillText, skillX + 9, y + 6);
        skillX += boxWidth + 8;
      });

      y += 45;

      // Notes Section
      if (Array.isArray(candidate.notes) && candidate.notes.length > 0) {
        doc.fillColor("#0c2340").fontSize(14).font("Helvetica-Bold")
          .text("Evaluation Notes", 40, y);
        
        doc.rect(40, y + 20, doc.page.width - 80, 1).fill("#e2e8f0");
        y += 32;

        candidate.notes.forEach((note) => {
          const noteText = typeof note === "string" ? note : note.text;
          const noteDate = note.createdAt ? new Date(note.createdAt).toLocaleDateString("en-GB") : "";
          doc.fillColor("#0c2340").font("Helvetica").fontSize(10)
            .text(`• ${noteText} ${noteDate ? `(${noteDate})` : ""}`, 40, y, { width: doc.page.width - 80 });
          y += 20;
        });
        y += 20;
      }

      // Footer
      const footerY = doc.page.height - 45;
      doc.rect(40, footerY - 10, doc.page.width - 80, 1).fill("#e2e8f0");
      doc.fillColor("#94a3b8").fontSize(9).font("Helvetica")
        .text(
          `Generated automatically by iComply Recruitment Platform • ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`,
          40,
          footerY,
          { align: "center", width: doc.page.width - 80 }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
