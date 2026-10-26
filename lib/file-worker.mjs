import { parentPort, workerData } from "node:worker_threads";
const { name, data } = workerData;
const bytes = Buffer.from(data, "base64");
const extension = name.split(".").at(-1).toLowerCase();
try {
  let text = "";
  if (["txt", "md", "csv", "json"].includes(extension)) {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } else if (extension === "docx") {
    const mammoth = await import("mammoth");
    text = (await mammoth.extractRawText({ buffer: bytes })).value;
  } else if (extension === "xlsx") {
    const { default: ExcelJS } = await import("exceljs");
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(bytes);
    if (book.worksheets.length > 20) throw Error("20 хүртэл sheet дэмжинэ");
    for (const sheet of book.worksheets) {
      if (sheet.rowCount > 10000) throw Error("10,000 хүртэл мөр дэмжинэ");
      text += "\n# " + sheet.name + "\n";
      sheet.eachRow((row) => {
        text +=
          row.values
            .slice(1)
            .map((v) => (typeof v === "object" ? JSON.stringify(v) : (v ?? "")))
            .join("\t") + "\n";
      });
      if (text.length > 100000) throw Error("Текстийн хэмжээ хэтэрлээ");
    }
  } else if (extension === "pdf") {
    const { getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(bytes), {
      isEvalSupported: false,
      maxImageSize: 1000000,
    });
    try {
      if (pdf.numPages > 80) throw Error("PDF 80 хүртэл хуудастай байна");
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const items = await page.getTextContent();
        text +=
          items.items.map((t) => t.str + (t.hasEOL ? "\n" : " ")).join("") +
          "\n";
        if (text.length > 100000) throw Error("Текстийн хэмжээ хэтэрлээ");
      }
    } finally {
      await pdf.destroy?.();
    }
  } else throw Error("Дэмжигдээгүй файл");
  text = text.replaceAll("\u0000", "").trim();
  if (!text)
    throw Error("Уншигдах текст олдсонгүй. Зураг/scan PDF-д OCR шаардлагатай.");
  if (text.length > 100000) throw Error("100,000 тэмдэгтээс их текст байна");
  parentPort.postMessage({ text });
} catch (e) {
  parentPort.postMessage({ error: String(e.message).slice(0, 200) });
}
