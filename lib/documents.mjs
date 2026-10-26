import { Worker } from "node:worker_threads";
import { readFile } from "node:fs/promises";
let processing = 0;
export async function importDocument(name, data) {
  if (
    typeof name !== "string" ||
    !/^.+\.(txt|md|csv|json|pdf|docx|xlsx)$/i.test(name)
  )
    throw Error("TXT, MD, CSV, JSON, PDF, DOCX, XLSX дэмжинэ");
  if (
    typeof data !== "string" ||
    data.length > 7000000 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(data)
  )
    throw Error("Файлын хэмжээ/формат буруу");
  const bytes = Buffer.from(data, "base64");
  if (bytes.length > 5 * 1024 * 1024) throw Error("Файл 5 MB-аас бага байна");
  if (processing >= 2)
    throw Error(
      "Файл боловсруулах дараалал дүүрсэн. Түр хүлээгээд дахин оролдоно уу.",
    );
  if (/\.(xlsx|docx)$/i.test(name)) {
    let offset = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (offset < 0 || offset + 22 > bytes.length)
      throw Error("ZIP бүтэц буруу");
    const entries = bytes.readUInt16LE(offset + 10);
    let central = bytes.readUInt32LE(offset + 16),
      expanded = 0;
    if (entries > 2000) throw Error("Файл хэт олон хэсэгтэй");
    for (let i = 0; i < entries; i++) {
      if (
        central + 46 > bytes.length ||
        bytes.readUInt32LE(central) !== 0x02014b50
      )
        throw Error("ZIP бүтэц буруу");
      expanded += bytes.readUInt32LE(central + 24);
      if (expanded > 32 * 1024 * 1024)
        throw Error("Задалсан файл 32 MB-аас их байна");
      central +=
        46 +
        bytes.readUInt16LE(central + 28) +
        bytes.readUInt16LE(central + 30) +
        bytes.readUInt16LE(central + 32);
    }
  }
  processing++;
  try {
    return await new Promise((ok, no) => {
      const worker = new Worker(new URL("./file-worker.mjs", import.meta.url), {
        workerData: { name, data },
        resourceLimits: {
          maxOldGenerationSizeMb: 192,
          maxYoungGenerationSizeMb: 32,
        },
      });
      const timer = setTimeout(() => {
        worker.terminate();
        no(Error("Файл боловсруулах 20 секундийн хугацаа хэтэрлээ"));
      }, 20000);
      const finish = () => {
        clearTimeout(timer);
        worker.terminate();
      };
      worker.once("message", (m) => {
        finish();
        m.error
          ? no(Error(m.error))
          : ok({ text: m.text, bytes: bytes.length });
      });
      worker.once("error", () => {
        finish();
        no(Error("Файлыг боловсруулах боломжгүй"));
      });
      worker.once("exit", (code) => {
        if (code !== 0) {
          clearTimeout(timer);
          no(Error("Файл боловсруулах процесс зогслоо"));
        }
      });
    });
  } finally {
    processing--;
  }
}
export async function exportDocument(title, content, format) {
  if (format === "txt" || format === "md")
    return {
      bytes: Buffer.from(title + "\n\n" + content),
      mime: "text/plain; charset=utf-8",
    };
  if (format === "docx") {
    const { Document, Packer, Paragraph, HeadingLevel, TextRun } = await import(
      "docx"
    );
    const doc = new Document({
      creator: "RAINY AI OFFICE",
      title,
      sections: [
        {
          children: [
            new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
            ...content.split("\n").map(
              (line) =>
                new Paragraph({
                  children: [
                    new TextRun({ text: line, font: "Calibri", size: 22 }),
                  ],
                  spacing: { after: 120 },
                }),
            ),
          ],
        },
      ],
    });
    return {
      bytes: await Packer.toBuffer(doc),
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  }
  if (format === "xlsx") {
    const { default: ExcelJS } = await import("exceljs");
    const book = new ExcelJS.Workbook();
    book.creator = "RAINY AI OFFICE";
    const sheet = book.addWorksheet("Output");
    sheet.columns = [{ header: title, key: "text", width: 110 }];
    for (const line of content.split("\n")) sheet.addRow([line]);
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF18352B" },
    };
    sheet.eachRow((row) => {
      row.alignment = { wrapText: true, vertical: "top" };
      row.height = 30;
    });
    return {
      bytes: Buffer.from(await book.xlsx.writeBuffer()),
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }
  if (format === "pdf") {
    const { PDFDocument, rgb } = await import("pdf-lib");
    const { default: fontkit } = await import("@pdf-lib/fontkit");
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const font = await pdf.embedFont(
      await readFile(new URL("../assets/OfficeSans.ttf", import.meta.url)),
      { subset: true },
    );
    const supported = new Set(font.getCharacterSet());
    const clean = (s) =>
      [...s].map((c) => (supported.has(c.codePointAt(0)) ? c : " ")).join("");
    const width = 499;
    let page, y;
    function next() {
      page = pdf.addPage([595, 842]);
      y = 785;
      page.drawText("RAINY / AI OFFICE", {
        x: 48,
        y: 812,
        font,
        size: 8,
        color: rgb(0.35, 0.42, 0.38),
      });
      page.drawText(String(pdf.getPageCount()), {
        x: 540,
        y: 25,
        font,
        size: 8,
      });
    }
    next();
    function line(text, size = 10) {
      if (y < 55) next();
      page.drawText(text, {
        x: 48,
        y,
        font,
        size,
        color: rgb(0.13, 0.2, 0.17),
      });
      y -= size * 1.65;
    }
    for (const [index, paragraph] of [
      title,
      "",
      ...content.split("\n"),
    ].entries()) {
      const size = index === 0 ? 18 : 10;
      let current = "";
      for (const word of clean(paragraph).split(/\s+/)) {
        let remaining = word;
        while (font.widthOfTextAtSize(remaining, size) > width) {
          let length = 1;
          while (
            length < remaining.length &&
            font.widthOfTextAtSize(remaining.slice(0, length + 1), size) <=
              width
          )
            length++;
          if (current) {
            line(current, size);
            current = "";
          }
          line(remaining.slice(0, length), size);
          remaining = remaining.slice(length);
        }
        const candidate = current ? current + " " + remaining : remaining;
        if (font.widthOfTextAtSize(candidate, size) > width) {
          line(current, size);
          current = remaining;
        } else current = candidate;
      }
      line(current, size);
      if (pdf.getPageCount() > 250) throw Error("PDF хэт том");
    }
    return { bytes: Buffer.from(await pdf.save()), mime: "application/pdf" };
  }
  throw Error("Экспортын формат буруу");
}
