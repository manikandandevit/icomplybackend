import { db } from "./src/core/db/pool.js";

const companyId = 2;

const establishments = [
  { id: 1, name: 'Standard Global - India Operations', country_id: 1, country_name: 'India' },
  { id: 6, name: 'Innodha India Office', country_id: 1, country_name: 'India' },
  { id: 2, name: 'Standard Global - Singapore HQ', country_id: 2, country_name: 'Singapore' },
  { id: 3, name: 'Standard Global - Malaysia Operations', country_id: 3, country_name: 'Malaysia' },
  { id: 4, name: 'Standard Global - Thailand Operations', country_id: 4, country_name: 'Thailand' },
  { id: 5, name: 'Standard Global - Vietnam Operations', country_id: 5, country_name: 'Vietnam' }
];

const countryComponentsMap = {
  1: [ // India
    { name: "Basic Pay", type: "Earning", ctcImpact: "Add", percentage: 40, calculationType: "Percentage", fixedAmount: 0, maxCapAmount: 0 },
    { name: "HRA", type: "Earning", ctcImpact: "Add", percentage: 20, calculationType: "Percentage", fixedAmount: 0, maxCapAmount: 0 },
    { name: "Special Allowance", type: "Earning", ctcImpact: "Add", percentage: 40, calculationType: "Percentage", fixedAmount: 0, maxCapAmount: 0 },
    { name: "Provident Fund (PF)", type: "Deduction", ctcImpact: "Deduct", percentage: 12, calculationType: "Percentage", fixedAmount: 0, maxCapAmount: 1800 },
    { name: "Professional Tax", type: "Deduction", ctcImpact: "Deduct", percentage: 0, calculationType: "Fixed Amount", fixedAmount: 200, maxCapAmount: 0 }
  ],
  2: [ // Singapore
    { name: "Basic Salary", type: "Earning", ctcImpact: "Add", percentage: 100, calculationType: "Percentage", fixedAmount: 0, maxCapAmount: 0 },
    { name: "CPF Contribution", type: "Deduction", ctcImpact: "Deduct", percentage: 20, calculationType: "Percentage", fixedAmount: 0, maxCapAmount: 1200 }
  ],
  3: [ // Malaysia
    { name: "Basic Salary", type: "Earning", ctcImpact: "Add", percentage: 100, calculationType: "Percentage", fixedAmount: 0, maxCapAmount: 0 },
    { name: "EPF", type: "Deduction", ctcImpact: "Deduct", percentage: 11, calculationType: "Percentage", fixedAmount: 0, maxCapAmount: 4000 },
    { name: "SOCSO", type: "Deduction", ctcImpact: "Deduct", percentage: 0, calculationType: "Fixed Amount", fixedAmount: 20, maxCapAmount: 0 }
  ],
  4: [ // Thailand
    { name: "Basic Salary", type: "Earning", ctcImpact: "Add", percentage: 100, calculationType: "Percentage", fixedAmount: 0, maxCapAmount: 0 },
    { name: "Social Security", type: "Deduction", ctcImpact: "Deduct", percentage: 5, calculationType: "Percentage", fixedAmount: 0, maxCapAmount: 750 }
  ],
  5: [ // Vietnam
    { name: "Basic Salary", type: "Earning", ctcImpact: "Add", percentage: 100, calculationType: "Percentage", fixedAmount: 0, maxCapAmount: 0 },
    { name: "Social Insurance", type: "Deduction", ctcImpact: "Deduct", percentage: 8, calculationType: "Percentage", fixedAmount: 0, maxCapAmount: 0 },
    { name: "Health Insurance", type: "Deduction", ctcImpact: "Deduct", percentage: 1.5, calculationType: "Percentage", fixedAmount: 0, maxCapAmount: 0 }
  ]
};

async function seed() {
  try {
    // Clear all existing components
    await db.query("DELETE FROM public.ca_payroll_components WHERE created_by_company_id = $1", [companyId]);
    console.log("Deleted old components.");

    for (const est of establishments) {
      const countryComps = countryComponentsMap[est.country_id];
      if (!countryComps) continue;

      for (const comp of countryComps) {
        await db.query(
          `INSERT INTO public.ca_payroll_components
           (name, type, ctc_impact, percentage, country_id, country_name, establishment_id, establishment_name, calculation_type, fixed_amount, max_cap_amount, created_by_company_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
           [
             comp.name, comp.type, comp.ctcImpact, comp.percentage, 
             est.country_id, est.country_name, 
             est.id, est.name,
             comp.calculationType, comp.fixedAmount, comp.maxCapAmount, companyId
           ]
        );
      }
      console.log("Seeded components for establishment: " + est.name);
    }

    console.log("Successfully seeded establishment-wise components!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding:", error);
    process.exit(1);
  }
}

seed();
