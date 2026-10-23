import { db } from "../src/core/db/pool.js";
import { caCandidatesRepository } from "../src/modules/CACandidates/caCandidates.repository.js";
import { caJobRequisitionsRepository } from "../src/modules/CAJobRequisitions/caJobRequisitions.repository.js";

async function test() {
  try {
    console.log("--- TEST 1: Auto-inherit establishment from position 'Full Stack Developer' ---");
    const cand1 = await caCandidatesRepository.create(2, {
      name: "Automated Test Candidate",
      role: "Full Stack Developer",
      email: "autotest1@example.com",
      phone: "9998887771",
      experience: "2 Yrs",
      location: "Madurai",
      source: "Website",
      stage: "Applied"
    });
    console.log("Created Cand 1:", {
      id: cand1.id,
      name: cand1.name,
      role: cand1.role,
      companyId: cand1.companyId,
      establishmentId: cand1.establishmentId,
      establishmentName: cand1.establishmentName
    });

    if (cand1.establishmentId === "6" && cand1.establishmentName === "Innodha India Office") {
      console.log("✅ TEST 1 PASSED: Candidate inherited Innodha India Office from Full Stack Developer position!");
    } else {
      console.error("❌ TEST 1 FAILED:", cand1);
    }

    console.log("\n--- TEST 2: Auto-inherit establishment from position 'Senior HR Manager' ---");
    const cand2 = await caCandidatesRepository.create(3, {
      name: "Automated HR Candidate",
      role: "Senior HR Manager",
      email: "autotest2@example.com",
      phone: "9998887772",
      experience: "5 Yrs",
      location: "Bangalore",
      source: "Referral",
      stage: "Applied"
    });
    console.log("Created Cand 2:", {
      id: cand2.id,
      name: cand2.name,
      role: cand2.role,
      companyId: cand2.companyId,
      establishmentId: cand2.establishmentId,
      establishmentName: cand2.establishmentName
    });

    if (cand2.establishmentId === "10" && cand2.establishmentName === "MDS Tech") {
      console.log("✅ TEST 2 PASSED: Candidate inherited MDS Tech from Senior HR Manager position!");
    } else {
      console.error("❌ TEST 2 FAILED:", cand2);
    }

    // Clean up test candidates
    await db.query("DELETE FROM public.ca_candidates WHERE id IN ($1, $2)", [cand1.id, cand2.id]);
    console.log("\nCleaned up test candidates.");

    process.exit(0);
  } catch (err) {
    console.error("Test failed with error:", err);
    process.exit(1);
  }
}

test();
