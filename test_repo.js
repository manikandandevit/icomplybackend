import { caStatutoryConfigRepository } from './src/modules/CAStatutoryConfig/caStatutoryConfig.repository.js';

async function test() {
  try {
    const payload = {
      countryId: "2", // Singapore
      establishmentId: "2",
      statutoryName: "CPF",
      baseComponentId: "ctc",
      rules: [
        { id: "cpf-rule-1", minAge: 0, maxAge: 55, employeePercentage: 20, employerPercentage: 17 }
      ],
      epsPercentage: 0,
      epfPercentage: 0
    };
    // use companyId = 2 for testing
    const res = await caStatutoryConfigRepository.save(2, payload);
    console.log("Save successful:", res);
  } catch (err) {
    console.error("Save failed:", err);
  } finally {
    process.exit();
  }
}
test();
