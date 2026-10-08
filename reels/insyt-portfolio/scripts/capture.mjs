// Captura os sites do portfólio em página inteira (desktop e mobile) para o
// vídeo animar a rolagem dentro dos mockups. Rola a página devagar antes do
// print porque a maioria dos sites revela seções com animação ao rolar — sem
// isso, metade da página sai em branco.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const SITES = [
  { slug: "pereira-garcia", url: "https://www.pereiragarciaadvocacia.com.br/" },
  { slug: "pg-holding", url: "https://holding.pereiragarciaadvocacia.com.br/" },
  { slug: "outeiral", url: "https://www.insytstudio.com.br/sites/outeiral-advocacia/index.html" },
  { slug: "ordem-digital", url: "https://www.insytstudio.com.br/sites/ordem-digital-leticia/index.html" },
  { slug: "bismarchi", url: "https://www.bismarchipires.com.br/" },
  { slug: "beatriz-bertho", url: "https://beatrizberthoadv.com.br/" },
  { slug: "confiara", url: "https://www.confiara.com.br/" },
];

const VIEWPORTS = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, maxHeight: 5200 },
  mobile: { width: 390, height: 844, deviceScaleFactor: 2, maxHeight: 4200, isMobile: true, hasTouch: true },
};

const only = process.argv.slice(2);
await mkdir("public/captures", { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });

for (const site of SITES.filter((s) => !only.length || only.includes(s.slug))) {
  for (const [kind, vp] of Object.entries(VIEWPORTS)) {
    const { maxHeight, ...ctxOpts } = vp;
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      ...ctxOpts,
      locale: "pt-BR",
    });
    const page = await ctx.newPage();
    try {
      await page.goto(site.url, { waitUntil: "networkidle", timeout: 60000 });
      // Esconde banners de cookie / botões flutuantes que poluem o print.
      await page.addStyleTag({
        content: `[class*="cookie" i],[id*="cookie" i],[class*="consent" i]{display:none!important}`,
      });
      // Banners de privacidade que não casam com o seletor acima: fecha pelo botão.
      for (const label of ["Entendi", "Aceitar", "Concordo", "OK"]) {
        const btn = page.getByRole("button", { name: label, exact: true });
        if (await btn.count()) await btn.first().click().catch(() => {});
      }
      const total = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < Math.min(total, maxHeight); y += vp.height / 2) {
        await page.evaluate((yy) => window.scrollTo(0, yy), y);
        await page.waitForTimeout(250);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(1200);
      const h = Math.min(total, maxHeight);
      await page.screenshot({
        path: `public/captures/${site.slug}-${kind}.jpg`,
        type: "jpeg",
        quality: 88,
        clip: { x: 0, y: 0, width: vp.width, height: h },
        fullPage: true,
      });
      console.log("ok", site.slug, kind, h);
    } catch (err) {
      console.error("FALHOU", site.slug, kind, err.message);
    }
    await ctx.close();
  }
}
await browser.close();
