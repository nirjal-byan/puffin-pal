import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";
import type { FinancialReport } from "./financial-reports.service.js";
import { csvCell } from "./financial-report-utils.js";

@Injectable()
export class FinancialExportService {
  csv(report: FinancialReport) {
    const revenue = report.revenue as Record<string, unknown>;
    const expenses = report.expenses as Record<string, unknown>;
    const payroll = report.payroll as Record<string, unknown>;
    const profitability = report.profitability as Record<string, unknown>;
    const rows = [
      ["Report", "Operational Profitability Report"],
      ["Period", `${report.period.from} to ${report.period.to}`],
      ["Currency", report.currency],
      ["Metric", "Amount"],
      ["Issued revenue", revenue.issued],
      ["Collected revenue", revenue.collected],
      ["Outstanding receivables", revenue.outstanding],
      ["Approved expenses", expenses.approved],
      ["Gross payroll", payroll.gross],
      ["Employer contributions", payroll.employerContributions],
      ["Operational profit", profitability.profit],
      ["Limitation", report.basis.disclosures.join(" ")],
    ];
    return `${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
  }

  pdf(report: FinancialReport): Promise<Buffer> {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const result = new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });
    const metric = (label: string, value: unknown) =>
      doc.fontSize(11).fillColor("#24332f").text(`${label}: ${report.currency} ${String(value)}`);
    doc.fontSize(20).fillColor("#153f73").text("Operational Profitability Report");
    doc.moveDown(0.4).fontSize(10).fillColor("#60716c").text(
      `${report.period.from} to ${report.period.to} · ${report.currency}`,
    );
    doc.moveDown();
    metric("Issued revenue", report.revenue.issued);
    metric("Collected revenue", report.revenue.collected);
    metric("Outstanding receivables", report.revenue.outstanding);
    metric("Approved expenses", report.expenses.approved);
    metric("Gross payroll", report.payroll.gross);
    metric("Employer contributions", report.payroll.employerContributions);
    metric("Operational profit", report.profitability.profit);
    doc.moveDown().fontSize(12).fillColor("#24332f").text("Basis and limitations");
    for (const disclosure of report.basis.disclosures)
      doc.fontSize(9).fillColor("#60716c").text(`• ${disclosure}`);
    doc.end();
    return result;
  }
}
