// import { fireEvent, getByText } from '@testing-library/dom'
// import '@testing-library/jest-dom/extend-expect'
// import { expect, beforeAll, afterAll } from "@jest/globals";

const puppeteer = require("puppeteer");

let browser;
let page;

describe("Open new file", () => {
  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: false });
    page = await browser.newPage();
    await page.goto("http://localhost:6173/edit/new");
  });

  it('should be titled "Page Editor"', async () => {
    await expect(page.title()).resolves.toMatch("Page Editor");
  });
});

describe("Open shape tab", () => {
  it("open the insert shapes", async () => {
    await page.evaluate(() => {
      document.getElementById("menuShapes").click();
    });
    const element = await page.waitForSelector(".autoshape");
    await expect(element).toBeDefined();
  });
  it("draw a shape", async () => {
    const element = await page.waitForSelector(
      ".autoshape[data-name='Rectangle']"
    );
    await element.click();
    const element2 = await page.waitForSelector(".shp");
    const [width, height] = await element2.evaluate((el) => [
      parseInt(el.style.width, 10),
      parseInt(el.style.height, 10),
    ]);
    await expect(width).toEqual(200); // default before resize is 200
    await expect(width).toEqual(height);
  });
  it("click BR handle to resize shape", async () => {
    const element2 = await page.waitForSelector(".shp");
    // element2.click();
    const sizingEl = await page.waitForSelector(".test-sizing");

    const bounding_box = await sizingEl.boundingBox();
    const x = bounding_box.x + bounding_box.width / 2;
    const y = bounding_box.y + bounding_box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(50);
    await page.mouse.move(x + 100, y + 100, { steps: 10 });
    await page.waitForTimeout(50);
    await page.mouse.up();
    await page.waitForTimeout(50);

    const [width, height] = await element2.evaluate((el) => [
      parseInt(el.style.width, 10),
      parseInt(el.style.height, 10),
    ]);
    await expect(width).toBeGreaterThan(200); // default before resize is 200
    await expect(width).toEqual(height);

    // await expect(element2)
  });
});

describe("edit text", () => {
  it("double click to open edit text", async () => {
    const el = await page.waitForSelector(".shp");
    const bounding_box = await el.boundingBox();
    const x = bounding_box.x;
    const y = bounding_box.y;
    await page.mouse.click(x + 20, y + 20, { count: 2, delay: 100 });
    // await page.waitForTimeout(500);
    page.keyboard.type("hello");
    // expect to open edit text
    const tagName = await page.evaluate(() => {
      console.log(document.activeElement.tagName);
      return document.activeElement.tagName;
    });
    expect(tagName).toEqual("DIV");
  });
});

describe("test table", () => {
  it("draw a table", async () => {
    const element = await page.waitForSelector(
      ".autoshape[data-name='Table']"
    );
    await element.click();
    const element2 = await page.waitForSelector(".shp[data-type='table']");
    expect(element2).toBeDefined();
  });
  it("double click on TD edit text", async () => {
    const td = await page.waitForSelector(".shp td");
    const bounding_box = await td.boundingBox();
    const x = bounding_box.x;
    const y = bounding_box.y;
    await page.mouse.click(x + 20, y + 20, { count: 2, delay: 10 });
    await page.waitForTimeout(50);
    page.keyboard.type("hello");
    await page.waitForTimeout(50);
    const textContent = await page.evaluate((td) => {
      return td.textContent;
    }, td);
    expect(textContent).toEqual("hello");
  });
});

describe("Complete", () => {
  it("Close browser", async () => {
    // Close browser.
    // await browser.close();
  });
});
