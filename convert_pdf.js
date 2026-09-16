import markdownpdf from "markdown-pdf";
import path from "path";
import fs from "fs";

const inputPath = "c:/Users/manik/.gemini/antigravity-ide/brain/225b2f53-03f9-45c4-8881-e55a80b39118/icomply_payroll_architecture.md";
const outputPath = "c:/Users/manik/.gemini/antigravity-ide/brain/225b2f53-03f9-45c4-8881-e55a80b39118/icomply_payroll_architecture.pdf";

markdownpdf().from(inputPath).to(outputPath, function () {
  console.log("Done generating PDF: " + outputPath);
});
