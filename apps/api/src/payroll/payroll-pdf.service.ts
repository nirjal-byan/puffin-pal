import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";

export type PayslipPdfInput = {
  runName: string;
  organizationName: string;
  periodStart: string;
  periodEnd: string;
  paymentDate: string;
  currency: string;
  employeeName: string;
  employeeCode: string;
  departmentName: string | null;
  jobTitle: string;
  baseAmount: string;
  grossPay: string;
  totalDeductions: string;
  netPay: string;
  components: Array<{ name: string; type: string; amount: string }>;
};

@Injectable()
export class PayrollPdfService {
  render(input: PayslipPdfInput): Promise<Buffer> {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 42, left: 48, right: 48, bottom: 42 },
      info: { Title: `Payslip ${input.employeeName}` },
    });
    const result = new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });
    doc.font("Helvetica-Bold").fontSize(22).fillColor("#173b32").text("PAYSLIP");
    doc.font("Helvetica").fontSize(10).fillColor("#354f48").text(input.organizationName);
    doc.fontSize(12).text(input.runName, { align: "right" });
    doc.moveDown().font("Helvetica").fontSize(10).fillColor("#354f48");
    doc.text(`Pay period: ${input.periodStart} to ${input.periodEnd}`);
    doc.text(`Payment date: ${input.paymentDate}`);
    doc.moveDown().font("Helvetica-Bold").fontSize(14).text(input.employeeName);
    doc.font("Helvetica").fontSize(10).text(`Employee ${input.employeeCode} · ${input.jobTitle}`);
    if (input.departmentName) doc.text(input.departmentName);
    doc.moveDown(1.5);
    const money = (amount: string) => `${input.currency} ${amount}`;
    doc.font("Helvetica-Bold").text("Earnings", 48, doc.y, { width: 240 });
    doc.text("Amount", 330, doc.y - 12, { width: 210, align: "right" });
    doc
      .font("Helvetica")
      .text("Base pay", 48, doc.y + 10, { width: 240 })
      .text(money(input.baseAmount), 330, doc.y - 12, { width: 210, align: "right" });
    for (const component of input.components.filter((item) => item.type === "EARNING")) {
      doc
        .text(component.name, 48, doc.y + 8, { width: 240 })
        .text(money(component.amount), 330, doc.y - 12, { width: 210, align: "right" });
    }
    doc.moveDown(1.5).font("Helvetica-Bold").text("Deductions", 48, doc.y, { width: 240 });
    for (const component of input.components.filter((item) => item.type === "DEDUCTION")) {
      doc
        .font("Helvetica")
        .text(component.name, 48, doc.y + 8, { width: 240 })
        .text(money(component.amount), 330, doc.y - 12, { width: 210, align: "right" });
    }
    const employer = input.components.filter((item) => item.type === "EMPLOYER_CONTRIBUTION");
    if (employer.length) {
      doc
        .moveDown(1.5)
        .font("Helvetica-Bold")
        .text("Employer contributions (does not reduce net pay)", 48, doc.y, { width: 360 });
      for (const component of employer)
        doc
          .font("Helvetica")
          .text(component.name, 48, doc.y + 8, { width: 240 })
          .text(money(component.amount), 330, doc.y - 12, { width: 210, align: "right" });
    }
    doc.moveDown(2).strokeColor("#cbd8d4").moveTo(48, doc.y).lineTo(547, doc.y).stroke();
    doc.moveDown().font("Helvetica-Bold").fontSize(12);
    doc
      .text("Gross pay", 48, doc.y, { width: 240 })
      .text(money(input.grossPay), 330, doc.y - 14, { width: 210, align: "right" });
    doc
      .text("Deductions", 48, doc.y + 8, { width: 240 })
      .text(money(input.totalDeductions), 330, doc.y - 14, { width: 210, align: "right" });
    doc
      .fontSize(15)
      .fillColor("#0f7257")
      .text("Net pay", 48, doc.y + 14, { width: 240 })
      .text(money(input.netPay), 330, doc.y - 17, { width: 210, align: "right" });
    doc.end();
    return result;
  }
}
