import { ConflictException, Injectable } from "@nestjs/common";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import type { InvoicesService } from "../invoices.service.js";

type Invoice = Awaited<ReturnType<InvoicesService["getInvoice"]>>;

export function invoicePdfFilename(invoiceNumber: string) {
  return `${invoiceNumber.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100) || "invoice"}.pdf`;
}

@Injectable()
export class InvoicePdfService {
  async render(invoice: Invoice): Promise<Buffer> {
    if (invoice.status !== "ISSUED")
      throw new ConflictException("Only issued invoices can be downloaded as PDF");
    // Never substitute mutable organization/client data for missing snapshots.
    if (!invoice.issuedAt || !invoice.sellerName || !invoice.currency ||
        !invoice.billingName || !invoice.billingEmail)
      throw new ConflictException("Invoice billing snapshots are incomplete");

    const doc = new PDFDocument({
      size: "A4", margins: { top: 44, right: 44, bottom: 60, left: 44 },
      bufferPages: true,
      info: { Title: `Invoice ${invoice.invoiceNumber}`, Author: "PuffinPal" },
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
      const left = 44;
      const width = doc.page.width - 88;
      const bottom = doc.page.height - 76;
      const money = (value: string) => `${invoice.currency} ${value}`;
      const date = (value: { toString(): string }) => value.toString().slice(0, 10);
      const text = (value: string, x: number, y: number, w: number, bold = false, size = 10, align: "left" | "right" = "left") => {
        doc.font(bold ? "bold" : "regular").fontSize(size).fillColor("#253b35")
          .text(value, x, y, { width: w, lineGap: 3, align });
        return doc.y;
      };
      text("PuffinPal", left, 44, width, true, 22);
      text("INVOICE", left, 83, width, true, 26);
      let y = text(invoice.invoiceNumber, left, 126, width, true, 12) + 8;
      y = text(`Issued on ${date(invoice.issuedAt)}  •  Currency: ${invoice.currency}`, left, y, width) + 22;
      y = text("FROM", left, y, width, true, 9) + 5;
      y = text(invoice.sellerName, left, y, width, true, 12) + 16;
      y = text("BILL TO", left, y, width, true, 9) + 5;
      for (const line of [invoice.billingName, invoice.billingCompanyName, invoice.billingEmail,
        invoice.billingTaxId ? `Tax ID: ${invoice.billingTaxId}` : null]) {
        if (line) y = text(line, left, y, width) + 3;
      }
      y += 12;
      y = text(`Issue date: ${date(invoice.issueDate)}     Due date: ${date(invoice.dueDate)}`, left, y, width) + 22;

      const columns = [left, left + 210, left + 275, left + 391];
      const widths = [202, 57, 108, width - 391];
      const tableHeader = () => {
        doc.rect(left, y, width, 28).fill("#edf5f1");
        ["Description", "Qty", "Unit price", "Amount"].forEach((label, index) => {
          text(label, columns[index]!, y + 7, widths[index]!, true, 9, index > 0 ? "right" : "left");
        });
        y += 36;
      };
      const newTablePage = () => {
        doc.addPage();
        y = text(`PuffinPal • ${invoice.invoiceNumber}`, left, 44, width, true, 10) + 18;
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
          const count = Math.min(lines.length - offset, Math.floor((bottom - y - 12) / 17));
          for (let index = 0; index < count; index++) {
            text(lines[offset + index]!, left, y + index * 17, widths[0]!, false, 9);
          }
          if (offset === 0) {
            [String(item.quantity), money(item.unitPrice), money(item.amount)].forEach((value, index) => {
              text(value, columns[index + 1]!, y, widths[index + 1]!, false, 9, "right");
            });
          }
          y += count * 17 + 12;
          doc.moveTo(left, y - 5).lineTo(left + width, y - 5).strokeColor("#dce5e1").stroke();
          offset += count;
        }
      }
      if (y + 115 > bottom) { doc.addPage(); y = 44; }
      y += 15;
      for (const [label, value] of [["Subtotal", invoice.subtotal], ["Tax", invoice.tax], ["Total", invoice.total]]) {
        const bold = label === "Total";
        text(label!, left + 210, y, 140, bold, bold ? 12 : 10);
        text(money(value!), left + 350, y, width - 350, bold, bold ? 12 : 10, "right");
        y += 28;
      }
      if (invoice.notes) {
        if (y + 65 > bottom) { doc.addPage(); y = 44; }
        y = text("Notes", left, y + 12, width, true) + 8;
        text(invoice.notes, left, y, width);
      }
      const pages = doc.bufferedPageRange();
      for (let index = pages.start; index < pages.start + pages.count; index++) {
        doc.switchToPage(index);
        doc.font("regular").fontSize(8).fillColor("#687d75")
          .text(`PuffinPal  •  Page ${index + 1} of ${pages.count}`, left, doc.page.height - 39,
            { width, align: "center", lineBreak: false });
      }
      doc.end();
    } catch (error) {
      doc.destroy(error instanceof Error ? error : new Error("PDF generation failed"));
    }
    return result;
  }
}
