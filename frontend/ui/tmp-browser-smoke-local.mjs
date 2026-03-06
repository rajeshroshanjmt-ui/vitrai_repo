import { chromium } from 'playwright';

const baseUrl = 'http://localhost:4173';
const routes = [
  '/dashboard',
  '/chatflows',
  '/agentflows',
  '/marketplaces',
  '/datasets',
  '/evaluators',
  '/evaluations',
  '/canvas'
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1512, height: 982 } });
const page = await context.newPage();

const pageErrors = [];
const consoleErrors = [];
const failedRequests = [];

page.on('pageerror', (err) => {
  pageErrors.push({ url: page.url(), message: String(err) });
});

page.on('console', (msg) => {
  if (msg.type() === 'error') {
    consoleErrors.push({ url: page.url(), message: msg.text() });
  }
});

page.on('requestfailed', (req) => {
  failedRequests.push({
    url: page.url(),
    requestUrl: req.url(),
    method: req.method(),
    errorText: req.failure()?.errorText || 'unknown'
  });
});

async function visit(path) {
  const startPageErr = pageErrors.length;
  const startConsoleErr = consoleErrors.length;
  const startFailed = failedRequests.length;

  let status = 'ok';
  let navError = null;
  const target = `${baseUrl}${path}`;

  try {
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2500);
  } catch (err) {
    status = 'navigation_error';
    navError = String(err);
  }

  const routePageErrors = pageErrors.slice(startPageErr);
  const routeConsoleErrors = consoleErrors.slice(startConsoleErr);
  const routeFailedRequests = failedRequests.slice(startFailed);

  const safeName = path.replace(/\//g, '_').replace(/^_/, '') || 'root';
  await page.screenshot({ path: `tmp/test-artifacts/${safeName}.png`, fullPage: true }).catch(() => {});

  return {
    path,
    finalUrl: page.url(),
    status,
    navError,
    pageErrors: routePageErrors,
    consoleErrors: routeConsoleErrors,
    failedRequests: routeFailedRequests
  };
}

// login
await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(500);

const email = page.locator('input[name="username"], input[type="email"]').first();
const password = page.locator('input[name="password"], input[type="password"]').first();
await email.fill('admin@vetrai.com');
await password.fill('admin123');
await page.getByRole('button', { name: /login/i }).click();
await page.waitForTimeout(2500);

const results = [];
for (const route of routes) {
  results.push(await visit(route));
}

await browser.close();

const summary = {
  baseUrl,
  loginFinalUrl: results[0]?.finalUrl || null,
  totalRoutes: results.length,
  routesWithPageErrors: results.filter((r) => r.pageErrors.length > 0).length,
  routesWithConsoleErrors: results.filter((r) => r.consoleErrors.length > 0).length,
  routesWithFailedRequests: results.filter((r) => r.failedRequests.length > 0).length,
  results
};

console.log(JSON.stringify(summary, null, 2));
