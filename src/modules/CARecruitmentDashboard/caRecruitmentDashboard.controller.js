import { asyncHandler } from "../../core/middleware/asyncHandler.js";
import { success } from "../../core/utils/response.js";

export const caRecruitmentDashboardController = {
  getStats: asyncHandler(async (req, res) => {
    // In a real application, these would be aggregated from DB tables
    const dashboardData = {
      openPositions: 4,
      candidates: 8,
      interviewsToday: 5,
      videoInterviews: 3,
      inPersonInterviews: 2,
      offersPending: 1,
      timeToHireDays: 28,
      targetTimeToHireDays: 25,
      hiringFunnel: [
        { stage: "Applied", count: 120 },
        { stage: "Screening", count: 45 },
        { stage: "Shortlisted", count: 20 },
        { stage: "Interview", count: 8 },
        { stage: "Assessment", count: 5 },
        { stage: "Offer", count: 2 },
        { stage: "Hired", count: 1 },
      ],
      byDepartment: [
        { department: "Engineering", open: 8, hired: 3 },
        { department: "Product", open: 2, hired: 1 },
        { department: "Sales", open: 4, hired: 2 },
        { department: "Analytics", open: 3, hired: 1 },
        { department: "HR", open: 1, hired: 0 },
      ],
      pendingActions: [
        { id: 1, text: "Review 12 new applications for SWE", urgent: true },
        { id: 2, text: "Schedule: Arjun Mehta, Priya Sharma", urgent: true },
        { id: 3, text: "Send offer letter to Rahul Singh", urgent: true },
        { id: 4, text: "Update Vikram Reddy assessment score", urgent: false },
        { id: 5, text: "Close REQ-005 - positions filled", urgent: false },
      ],
      performanceMetrics: {
        avgTimeToHire: { value: "28 Days", trend: "+3d vs last month", color: "text-[#0c2340]" },
        costPerHire: { value: "₹45,200", trend: "-₹2.3K vs last month", color: "text-green-600" },
        offerAcceptance: { value: "84%", trend: "+6% vs last month", color: "text-[#3b82f6]" },
        qualityOfHire: { value: "8.2/10", trend: "+0.4 vs last month", color: "text-orange-500" }
      },
      sourceEffectiveness: [
        { source: "LinkedIn", hired: 8, percentage: 13 },
        { source: "Referral", hired: 6, percentage: 27 },
        { source: "Naukri", hired: 5, percentage: 10 },
        { source: "Campus", hired: 4, percentage: 7 },
        { source: "Website", hired: 3, percentage: 10 },
      ],
      timeToHireByDept: [
        { department: "Engineering", days: 35, color: "bg-red-500" },
        { department: "Product", days: 28, color: "bg-orange-400" },
        { department: "Sales", days: 22, color: "bg-green-500" },
        { department: "HR", days: 18, color: "bg-green-500" },
        { department: "Analytics", days: 25, color: "bg-green-500" }
      ]
    };

    return success(res, { message: "Dashboard data loaded", data: dashboardData });
  }),
};
