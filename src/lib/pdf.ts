import puppeteer from "puppeteer";

export async function generatePdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({ headless: "new" as never });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" as never });
    const pdf = await page.pdf({
      displayHeaderFooter: true,
      footerTemplate: `
        <div style="width:100%;font-size:8px;color:#5a6270;text-align:center;
                    padding:0 0.75in;font-family:Arial,sans-serif;">
          Page <span class="pageNumber"></span> of <span class="totalPages"></span>
        </div>
      `,
      format: "Letter",
      headerTemplate: "<span></span>",
      margin: { bottom: "0.55in", left: "0.75in", right: "0.75in", top: "0.75in" },
      printBackground: true,
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
