import puppeteer from "puppeteer";

export async function generatePdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({ headless: "new" as never });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" as never });
    const pdf = await page.pdf({
      displayHeaderFooter: true,
      footerTemplate: `
        <div style="font-size:9px; color:#888; width:100%; text-align:center; padding:0 0.75in;">
          Page <span class="pageNumber"></span> of <span class="totalPages"></span>
        </div>
      `,
      format: "Letter",
      headerTemplate: "<span></span>",
      margin: { bottom: "0.75in", left: "0.75in", right: "0.75in", top: "0.75in" },
      printBackground: true,
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
