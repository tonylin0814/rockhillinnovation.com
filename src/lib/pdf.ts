import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer";
import puppeteerCore from "puppeteer-core";

async function launchBrowser() {
  if (process.env.VERCEL) {
    return puppeteerCore.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  return puppeteer.launch({ headless: "new" as never });
}

export async function generatePdf(html: string): Promise<Buffer> {
  const browser = await launchBrowser();

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
      margin: { bottom: "0.9in", left: "0.75in", right: "0.75in", top: "0.9in" },
      printBackground: true,
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
