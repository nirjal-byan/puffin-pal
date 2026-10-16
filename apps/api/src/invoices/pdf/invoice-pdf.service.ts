import { ConflictException, Injectable } from "@nestjs/common";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";

export type InvoicePdfInput = {
  status: string;
  invoiceNumber: string;
  issuedAt: { toString(): string } | string | null;
  issueDate: { toString(): string } | string;
  dueDate: { toString(): string } | string;
  sellerName: string | null;
  currency: string | null;
  billingName: string | null;
  billingEmail: string | null;
  billingCompanyName: string | null;
  billingTaxId: string | null;
  notes: string | null;
  subtotal: string;
  tax: string;
  total: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: string;
    amount: string;
  }>;
};

export function invoicePdfFilename(invoiceNumber: string) {
  return `${invoiceNumber.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100) || "invoice"}.pdf`;
}

@Injectable()
export class InvoicePdfService {
  async render(invoice: InvoicePdfInput): Promise<Buffer> {
    if (!["ISSUED", "PAID", "OVERDUE"].includes(invoice.status))
      throw new ConflictException("Only issued invoices can be downloaded as PDF");
    // Never substitute mutable organization/client data for missing snapshots.
    if (!invoice.issuedAt || !invoice.sellerName || !invoice.currency ||
        !invoice.billingName || !invoice.billingEmail)
      throw new ConflictException("Invoice billing snapshots are incomplete");

    const doc = new PDFDocument({
      size: "A4", margins: { top: 32, right: 40, bottom: 42, left: 40 },
      bufferPages: true,
      info: { Title: `Invoice ${invoice.invoiceNumber}`, Author: invoice.sellerName },
    });
    const result = new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });
    try {
      for (const [name, filename] of [["regular", "Poppins-Regular.ttf"], ["bold", "Poppins-Bold.ttf"]])
        doc.registerFont(name!, fileURLToPath(new URL(`./assets/${filename}`, import.meta.url)));
      const left = 40;
      const width = doc.page.width - 80;
      const bottom = doc.page.height - 52;
      const money = (value: string) => `${invoice.currency} ${value}`;
      const date = (value: { toString(): string }) => value.toString().slice(0, 10);
      const text = (value: string, x: number, y: number, w: number, bold = false, size = 10, align: "left" | "right" = "left") => {
        doc.font(bold ? "bold" : "regular").fontSize(size).fillColor("#253b35")
          .text(value, x, y, { width: w, lineGap: 1, align });
        return doc.y;
      };
      text("INVOICE", left, 32, width / 2, true, 22);
      text(invoice.invoiceNumber, left, 64, width / 2, true, 11);
      text(`Issued ${date(invoice.issuedAt)}`, left + width / 2, 35, width / 2, false, 9, "right");
      text(`Currency ${invoice.currency}`, left + width / 2, 52, width / 2, false, 9, "right");
      text(`Issue date ${date(invoice.issueDate)}`, left + width / 2, 69, width / 2, false, 9, "right");
      text(`Due date ${date(invoice.dueDate)}`, left + width / 2, 86, width / 2, false, 9, "right");
      let y = 112;
      text("FROM", left, y, width / 2 - 12, true, 8);
      const sellerBottom = text(invoice.sellerName, left, y + 15, width / 2 - 12, true, 11);
      text("BILL TO", left + width / 2, y, width / 2, true, 8);
      let billingY = y + 15;
      for (const line of [invoice.billingName, invoice.billingCompanyName, invoice.billingEmail,
        invoice.billingTaxId ? `Tax ID: ${invoice.billingTaxId}` : null]) {
        if (line) billingY = text(line, left + width / 2, billingY, width / 2, line === invoice.billingName, line === invoice.billingName ? 10 : 9) + 1;
      }
      y = Math.max(sellerBottom, billingY) + 13;

      const columns = [left, left + 210, left + 275, left + 391];
      const widths = [202, 57, 108, width - 391];
      const tableHeader = () => {
        doc.rect(left, y, width, 23).fill("#edf5f1");
        ["Description", "Qty", "Unit price", "Amount"].forEach((label, index) => {
          text(label, columns[index]!, y + 6, widths[index]!, true, 8, index > 0 ? "right" : "left");
        });
        y += 29;
      };
      const newTablePage = () => {
        doc.addPage();
        y = text(invoice.invoiceNumber, left, 32, width, true, 10) + 14;
        tableHeader();
      };
      if (y + 65 > bottom) newTablePage();
      else tableHeader();
      // Explicit wrapping also handles long words and newline-heavy descriptions.
      const wrap = (value: string) => {
        doc.font("regular").fontSize(9);
        const lines: string[] = [];
        let line = "";
        for (const character of value.replace(/\r\n?/g, "\n")) {
          if (character === "\n") { lines.push(line); line = ""; continue; }
          if (line && doc.widthOfString(line + character) > widths[0]!) {
            const space = line.lastIndexOf(" ");
            if (space > 0) {
              lines.push(line.slice(0, space));
              line = line.slice(space + 1);
            } else {
              lines.push(line);
              line = "";
            }
          }
          line += character;
        }
        lines.push(line);
        return lines;
      };
      for (const item of invoice.items) {
        const lines = wrap(item.description);
        let offset = 0;
        while (offset < lines.length) {
          if (bottom - y < 34) newTablePage();
          const count = Math.min(lines.length - offset, Math.floor((bottom - y - 9) / 14));
          for (let index = 0; index < count; index++) {
            text(lines[offset + index]!, left, y + index * 14, widths[0]!, false, 9);
          }
          if (offset === 0) {
            [String(item.quantity), money(item.unitPrice), money(item.amount)].forEach((value, index) => {
              text(value, columns[index + 1]!, y, widths[index + 1]!, false, 9, "right");
            });
          }
          y += count * 14 + 8;
          doc.moveTo(left, y - 4).lineTo(left + width, y - 4).strokeColor("#dce5e1").stroke();
          offset += count;
        }
      }
      if (y + 90 > bottom) { doc.addPage(); y = 32; }
      y += 10;
      const totalsY = y;
      for (const [label, value] of [["Subtotal", invoice.subtotal], ["Tax", invoice.tax], ["Total", invoice.total]]) {
        const bold = label === "Total";
        text(label!, left + 270, y, 95, bold, bold ? 11 : 9);
        text(money(value!), left + 365, y, width - 365, bold, bold ? 11 : 9, "right");
        y += 21;
      }
      if (invoice.notes) {
        text("Notes", left, totalsY, 245, true, 9);
        text(invoice.notes, left, totalsY + 17, 245, false, 9);
      }
      const pages = doc.bufferedPageRange();
      for (let index = pages.start; index < pages.start + pages.count; index++) {
        doc.switchToPage(index);
        doc.font("regular").fontSize(8).fillColor("#687d75")
          .text(`Page ${index + 1} of ${pages.count}`, left, doc.page.height - 30,
            { width, align: "center", lineBreak: false });
      }
      doc.end();
    } catch (error) {
      doc.destroy(error instanceof Error ? error : new Error("PDF generation failed"));
    }
    return result;
  }
}
