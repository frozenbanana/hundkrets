#!/usr/bin/env node
/**
 * Hundkrets Weekly Product Review — Automated Browser Audit
 * Usage: node weekly-review.mjs
 * Produces: review-screenshots/ + review-report.json
 *
 * Flow:
 *   1. Umami Dashboard (browser screenshot)
 *   2. Landing Page
 *   3. Register anna.malmo@example.com (deletes stale account if present)
 *   4. Onboarding
 *   5. Explore Page (logged in)
 *   6. Create a New Excursion
 *   7. Public Pages (logged out)
 *   8. Delete Account
 *   9. Umami API — real metrics (pageviews, visitors, top pages)
 *  10. PocketBase Admin Collections — user count, matches, excursions, email log
 *  11. PocketBase Admin Logs — browser-based errors/warnings check
 */
import 'dotenv/config';
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import PocketBase from 'pocketbase';

const UMAMI_HOST = process.env.UMAMI_URL;
const UMAMI_USER = process.env.UMAMI_USERNAME;
const UMAMI_PASS = process.env.UMAMI_PASSWORD;
let UMAMI_SITE_ID = process.env.UMAMI_WEBSITE_ID || '4741ad93-fdb2-4bed-8708-165f8e0bb69d';
const PB_URL = process.env.PB_ADMIN_URL || 'https://api.hundkrets.se';
const PB_EMAIL = process.env.PB_ADMIN_EMAIL;
const PB_PASS = process.env.PB_ADMIN_PASSWORD;
const TEST_EMAIL = process.env.TEST_EMAIL || 'anna.malmo@example.com';
const TEST_PASS = process.env.TEST_PASS || 'ReviewPass123!';

const REPORT = {
  date: new Date().toISOString(),
  umami: {},
  umamiMetrics: {},
  admin: {},
  hundkrets: {},
  findings: [],
  recommendations: [],
};

const outDir = '/home/henry/Projects/review-screenshots';
mkdirSync(outDir, { recursive: true });
const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');

async function capture(page, name) {
  const path = `${outDir}/${ts}_${name}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log('  📸', path);
  return path;
}

async function deleteAccount(page) {
  const pagesToTry = [
    'https://hundkrets.se/app/profile',
    'https://hundkrets.se/app/settings',
  ];

  for (const url of pagesToTry) {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const deleteBtn = page.locator('.danger-zone button.btn-danger, button').filter({ hasText: /Ta bort mitt konto|Ta bort konto/i }).first();
    await deleteBtn.scrollIntoViewIfNeeded().catch(() => {});
    const found = await deleteBtn.isVisible().catch(() => false);

    if (found) {
      REPORT.hundkrets.deleteFlow = { url, deleteBtnFound: true };
      await deleteBtn.click();
      await page.waitForTimeout(1000);

      const confirmBtn = page.locator('button').filter({ hasText: /Ja|Yes|Bekräfta|Confirm|Radera|Delete|OK/i }).first();
      const hasConfirm = await confirmBtn.isVisible().catch(() => false);
      REPORT.hundkrets.deleteFlow.confirmDialog = hasConfirm;

      if (hasConfirm) {
        await confirmBtn.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        REPORT.hundkrets.deleteFlow.postDeleteUrl = page.url();
        return true;
      }
    }
  }

  REPORT.hundkrets.deleteFlow = { triedUrls: pagesToTry, deleteBtnFound: false };
  return false;
}

async function deleteTestUserByEmail(pb, email) {
  try {
    const res = await pb.collection('users').getList(1, 1, { filter: `email = "${email}"` });
    if (res.totalItems > 0) {
      await pb.collection('users').delete(res.items[0].id);
      return true;
    }
  } catch (e) {
    console.log('  ⚠️ SDK delete failed:', e.message);
  }
  return false;
}

const pb = PB_URL && PB_EMAIL && PB_PASS ? new PocketBase(PB_URL) : null;
let pbAuthed = false;
if (pb) {
  try {
    await pb.collection('_superusers').authWithPassword(PB_EMAIL, PB_PASS);
    pbAuthed = true;
    console.log('  🔑 PocketBase admin authenticated');
  } catch (e) {
    console.log('  ⚠️ PocketBase auth failed:', e.message);
  }
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

console.log('\n=== Hundkrets Weekly Product Review ===\n');

// ── 1. Umami Dashboard ──
console.log('[1/11] Umami Dashboard');
const u = await context.newPage();
try {
  await u.goto('https://umami.henrybergstrom.com/login', { waitUntil: 'networkidle', timeout: 20000 });
  await u.fill('input[name="username"]', UMAMI_USER);
  await u.fill('input[name="password"]', UMAMI_PASS);
  await u.click('button[type="submit"]');
  await u.waitForLoadState('networkidle');
  await u.waitForTimeout(3000);
  await capture(u, 'umami_dashboard');

  const stats = await u.evaluate(() => {
    const data = { text: document.body.innerText.slice(0, 3000) };
    const cards = Array.from(document.querySelectorAll('[class*="metric"], [class*="stat"], [class*="card"]'));
    data.cardCount = cards.length;
    return data;
  });
  REPORT.umami.bodyText = stats.text;
  REPORT.umami.cardCount = stats.cardCount;
} catch (e) {
  REPORT.umami.error = e.message;
  console.log('  ⚠️ Umami error:', e.message);
}

// ── 2. Landing Page ──
console.log('[2/11] Landing Page');
const p = await context.newPage();
try {
  await p.goto('https://hundkrets.se', { waitUntil: 'networkidle', timeout: 20000 });
  await p.waitForTimeout(1000);
  await capture(p, 'landing');
  REPORT.hundkrets.landing = {
    url: p.url(),
    title: await p.title(),
    ctaVisible: await p.locator('a[href="/register"]').isVisible().catch(() => false),
    mapVisible: await p.locator('.leaflet-container, [class*="map"]').count() > 0,
  };
} catch (e) {
  REPORT.hundkrets.landingError = e.message;
}

// ── 3. Register fresh account ──
console.log('[3/11] Register fresh account (' + TEST_EMAIL + ')');
try {
  if (pbAuthed) {
    const deleted = await deleteTestUserByEmail(pb, TEST_EMAIL);
    if (deleted) {
      console.log('  🗑️ Stale account deleted via SDK');
      REPORT.hundkrets.deletedExisting = true;
    }
  }

  await p.goto('https://hundkrets.se/register', { waitUntil: 'networkidle' });
  await p.fill('input[type="email"]', TEST_EMAIL);
  const pwInputs = await p.locator('input[type="password"]').all();
  for (const inp of pwInputs) await inp.fill(TEST_PASS);
  await p.click('button[type="submit"]');
  await p.waitForLoadState('networkidle');
  await p.waitForTimeout(2000);

  REPORT.hundkrets.registration = {
    email: TEST_EMAIL,
    postUrl: p.url(),
    title: await p.title(),
    success: p.url().includes('/onboarding/') || p.url().includes('/app/'),
  };
  if (!REPORT.hundkrets.registration.success) {
    REPORT.hundkrets.registrationError = 'Registration did not redirect to onboarding/app. URL: ' + p.url();
    console.log('  ⚠️ Registration failed — got:', p.url());
  }
} catch (e) {
  REPORT.hundkrets.registrationError = e.message;
  console.log('  ⚠️ Registration error:', e.message);
}

// ── 4. Onboarding ──
console.log('[4/11] Onboarding');
try {
  await capture(p, 'onboarding_choice');

  const progressText = await p.textContent('.onboarding-progress-label, [class*="progress"]').catch(() => '');
  REPORT.hundkrets.onboardingProgressText = progressText;

  const btns = await p.locator('button').all();
  for (let i = 0; i < btns.length; i++) {
    const t = await btns[i].textContent();
    if (t && t.includes('Byta')) { await btns[i].click(); break; }
  }
  await p.waitForLoadState('networkidle');
  await p.waitForTimeout(1500);
  await capture(p, 'onboarding_profile');

  REPORT.hundkrets.postChoiceUrl = p.url();

  const hasNameField = await p.locator('input#name, input[placeholder*="namn" i]').count() > 0;
  const hasPostalField = await p.locator('input#postal-code, input[placeholder*="postnum" i]').count() > 0;
  const hasMap = await p.locator('.leaflet-container, [class*="map"]').count() > 0;
  REPORT.hundkrets.inlineProfileForm = { hasNameField, hasPostalField, hasMap };

  if (hasNameField) {
    await p.locator('input#name, input[placeholder*="namn" i]').first().fill('Anna Malmö').catch(() => {});
  }
  if (hasPostalField) {
    await p.locator('input#postal-code, input[placeholder*="postnum" i]').first().fill('21120').catch(() => {});
  }
  await p.waitForTimeout(500);
  await capture(p, 'onboarding_profile_filled');
} catch (e) {
  REPORT.hundkrets.onboardingError = e.message;
  console.log('  ⚠️ Onboarding error:', e.message);
}

// ── 5. Explore Page (logged in) ──
console.log('[5/11] Explore Page');
try {
  await p.goto('https://hundkrets.se/app/explore');
  await p.waitForLoadState('networkidle');
  await p.waitForTimeout(1500);
  await capture(p, 'explore_loggedin');
  REPORT.hundkrets.explore = {
    url: p.url(),
    title: await p.title(),
    hasMap: await p.locator('.leaflet-container, [class*="map"]').count() > 0,
  };
} catch (e) {
  REPORT.hundkrets.exploreError = e.message;
  console.log('  ⚠️ Explore error:', e.message);
}

// ── 6. Create New Excursion ──
console.log('[6/11] Create New Excursion');
try {
  await p.goto('https://hundkrets.se/app/excursions');
  await p.waitForLoadState('networkidle');
  await p.waitForTimeout(1000);

  if (p.url().includes('/onboarding')) {
    REPORT.hundkrets.excursionFlow = { skippedBecauseOnboarding: true, hasCreateBtn: null };
    console.log('  ℹ️ Create excursion skipped — test user still in onboarding');
  } else {
  const createBtn = p.locator('a.excursions-new-btn, a[href*="/app/excursions/create"]').filter({ hasText: /Ny hundträff|Skapa hundträff/i }).first();
  await createBtn.scrollIntoViewIfNeeded().catch(() => {});
  const hasCreateBtn = await createBtn.isVisible().catch(() => false);
  REPORT.hundkrets.excursionFlow = { hasCreateBtn };

  if (hasCreateBtn) {
    await createBtn.first().click();
    await p.waitForLoadState('networkidle');
    await p.waitForTimeout(1000);
    await capture(p, 'excursion_create');
    REPORT.hundkrets.excursionFlow.createUrl = p.url();

    const titleInput = p.locator('input[placeholder*="Titel" i], input[name="title"], input#title').first();
    const hasTitle = await titleInput.isVisible().catch(() => false);
    REPORT.hundkrets.excursionFlow.hasTitleField = hasTitle;
    if (hasTitle) {
      await titleInput.fill('Testrunda i Malmö');
    }

    const descInput = p.locator('textarea').first();
    const hasDesc = await descInput.isVisible().catch(() => false);
    if (hasDesc) {
      await descInput.fill('En testtur för veckorecensionen.');
    }

    await p.waitForTimeout(500);
    await capture(p, 'excursion_create_filled');

    const submitBtn = p.locator('button[type="submit"]').first();
    const hasSubmit = await submitBtn.isVisible().catch(() => false);
    REPORT.hundkrets.excursionFlow.hasSubmitBtn = hasSubmit;

    if (hasSubmit) {
      await submitBtn.click();
      await p.waitForLoadState('networkidle');
      await p.waitForTimeout(2000);
      await capture(p, 'excursion_created');
      REPORT.hundkrets.excursionFlow.postSubmitUrl = p.url();
      REPORT.hundkrets.excursionFlow.created = p.url().includes('/excursions/') || !p.url().includes('/create');
    }
  }
  }
} catch (e) {
  REPORT.hundkrets.excursionFlowError = e.message;
  console.log('  ⚠️ Excursion flow error:', e.message);
}

// ── 7. Public Pages (logged out) ──
console.log('[7/11] Public Pages');
const pub = await context.newPage();
try {
  await pub.goto('https://hundkrets.se/app/excursions', { waitUntil: 'networkidle' });
  await pub.waitForTimeout(1000);
  await capture(pub, 'excursions_public');
  const pubUrl = pub.url();
  const authGated = /\/login|\/onboarding/.test(pubUrl);
  REPORT.hundkrets.excursionsPublic = {
    url: pubUrl,
    hasGuestNav: await pub.locator('text=Logga in').isVisible().catch(() => false),
    hasCreateBtn: authGated ? null : await pub.locator('a.excursions-new-btn').first().isVisible().catch(() => false),
    skippedBecauseAuth: authGated || undefined,
  };
} catch (e) {
  REPORT.hundkrets.excursionsPublicError = e.message;
}

// ── 8. Delete Account ──
console.log('[8/11] Delete Account');
try {
  let deleted = await deleteAccount(p);
  if (!deleted && pbAuthed) {
    console.log('  ⚠️ Browser delete failed — trying SDK fallback');
    deleted = await deleteTestUserByEmail(pb, TEST_EMAIL);
  }
  REPORT.hundkrets.accountDeleted = deleted;
  console.log(deleted ? '  ✅ Account deleted' : '  ⚠️ Could not delete account');
} catch (e) {
  REPORT.hundkrets.deleteError = e.message;
  console.log('  ⚠️ Delete error:', e.message);
}

await browser.close();

// ── 9. Umami API Metrics ──
console.log('[9/11] Umami API Metrics');
if (UMAMI_HOST && UMAMI_USER && UMAMI_PASS) {
  try {
    const loginRes = await fetch(`${UMAMI_HOST}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: UMAMI_USER, password: UMAMI_PASS }),
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok || !loginData.token) {
      throw new Error(`Umami login ${loginRes.status}: ${JSON.stringify(loginData).slice(0, 240)}`);
    }
    const token = loginData.token;

    if (!UMAMI_SITE_ID) {
      const sitesRes = await fetch(`${UMAMI_HOST}/api/websites`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const sites = await sitesRes.json();
      const data = Array.isArray(sites) ? sites : (sites.data || []);
      const site = data.find(s => s.domain && s.domain.includes('hundkrets'));
      if (site) UMAMI_SITE_ID = site.id;
      REPORT.umamiMetrics.siteAutoDetected = !!site;
    }

    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    // Umami stats API expects unix timestamps in milliseconds.
    const startAt = weekAgo;
    const endAt = now;

    if (UMAMI_SITE_ID) {
      const [statsRes, pagesRes] = await Promise.all([
        fetch(`${UMAMI_HOST}/api/websites/${UMAMI_SITE_ID}/stats?startAt=${startAt}&endAt=${endAt}&unit=day`,
          { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${UMAMI_HOST}/api/websites/${UMAMI_SITE_ID}/metrics?type=path&startAt=${startAt}&endAt=${endAt}&limit=20`,
          { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const stats = await statsRes.json();
      const pages = await pagesRes.json();
      if (!statsRes.ok) {
        throw new Error(`Umami stats ${statsRes.status}: ${JSON.stringify(stats).slice(0, 240)}`);
      }

      // Umami v1 returned { value: n }; current API returns n directly.
      const statValue = (field) => (typeof field === 'number' ? field : (field?.value ?? 0));
      const pageviews = statValue(stats.pageviews);
      const visitors = statValue(stats.visitors);
      const topPages = Array.isArray(pages)
        ? pages.slice(0, 20)
        : (Array.isArray(pages?.data) ? pages.data.slice(0, 20) : []);

      REPORT.umamiMetrics = {
        pageviews,
        visitors,
        visits: statValue(stats.visits),
        bounces: statValue(stats.bounces),
        totaltime: statValue(stats.totaltime),
        topPages,
        rawStats: stats,
      };

      if (!pagesRes.ok) {
        REPORT.umamiMetrics.topPagesError = `Umami metrics ${pagesRes.status}: ${JSON.stringify(pages).slice(0, 180)}`;
      }

      if (pageviews === 0 && visitors === 0) {
        REPORT.umamiMetrics.zeroWarning =
          'Umami API returned zeros for the last 7 days. Confirm website id 4741ad93-fdb2-4bed-8708-165f8e0bb69d and that script.js is loading (it is installed in entry-server.tsx). Do not treat this as a missing script without checking the dashboard.';
        console.log('  ⚠️ Umami API returned zeros — check website id / date range, not necessarily a missing script');
      } else {
        console.log(`  ✅ Umami last 7 days: ${pageviews} pageviews, ${visitors} visitors`);
      }
    } else {
      REPORT.umamiMetrics.siteNotFound = true;
    }
  } catch (e) {
    REPORT.umamiMetrics.error = e.message;
    console.log('  ⚠️ Umami API error:', e.message);
  }
} else {
  REPORT.umamiMetrics.skipped = 'credentials not set';
  console.log('  ⚠️ Skipped — UMAMI_URL/USER/PASS not set in .env');
}

// ── 10. PocketBase Admin Collections ──
console.log('[10/11] PocketBase Admin Collections');
if (pbAuthed) {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const q = async (name, fn) => {
      try {
        const r = await fn();
        console.log(`  ✅ ${name}: ${r.totalItems}`);
        return r;
      } catch (e) {
        console.log(`  ❌ ${name}: ${e.message}`);
        return { totalItems: -1, items: [], _error: e.message };
      }
    };

    const usersAll = await q('users', () => pb.collection('users').getList(1, 1));
    const usersWeek = await q('users (7d)', () => pb.collection('users').getList(1, 1, { filter: `created > "${sevenDaysAgo}"` }));

    const connAll = await q('connection_requests', () => pb.collection('connection_requests').getList(1, 1));
    const connWeek = await q('connection_requests (7d)', () =>
      pb.collection('connection_requests').getList(1, 1, { filter: `created > "${sevenDaysAgo}"` })
    );

    const excAll = await q('excursions', () => pb.collection('excursions').getList(1, 1));
    const excWeek = await q('excursions (7d)', () =>
      pb.collection('excursions').getList(1, 1, { filter: `created > "${sevenDaysAgo}"` })
    );

    const emails = await q('email_log', () => pb.collection('email_log').getList(1, 30, { sort: '-sent_at' }));

    REPORT.admin = {
      totalUsers: usersAll.totalItems,
      newUsersThisWeek: usersWeek.totalItems,
      totalConnectionRequests: connAll.totalItems,
      newConnectionRequestsThisWeek: connWeek.totalItems,
      totalExcursions: excAll.totalItems,
      newExcursionsThisWeek: excWeek.totalItems,
      emailLog: emails.items
        .map(e => ({ to: e.to, subject: e.subject, sentAt: e.sent_at, status: e.status, error: e.error }))
        .slice(0, 30),
      emailLogErrorCount: emails.items.filter(e => e.error && e.error !== '').length,
    };
  } catch (e) {
    REPORT.admin.error = e.message;
    console.log('  ⚠️ Admin query error:', e.message);
  }
} else {
  REPORT.admin.skipped = 'credentials not set or auth failed';
  console.log('  ⚠️ Skipped — PB SDK not authenticated');
}

// ── 11. PocketBase Admin Logs (browser) ──
console.log('[11/11] Admin Logs (browser)');
if (pbAuthed) {
  try {
    const ab = await chromium.launch({ headless: true });
    const ac = await ab.newContext({ viewport: { width: 1440, height: 900 } });
    const ap = await ac.newPage();

    await ap.goto(`${PB_URL}/_/`, { waitUntil: 'networkidle', timeout: 20000 });
    await ap.fill('input[type="email"]', PB_EMAIL);
    await ap.fill('input[type="password"]', PB_PASS);
    await ap.click('button[type="submit"]');
    await ap.waitForLoadState('networkidle');
    await ap.waitForTimeout(2000);

    await capture(ap, 'pocketbase_admin_dashboard');

    await ap.goto(`${PB_URL}/_/#/logs`, { waitUntil: 'networkidle', timeout: 10000 });
    await ap.waitForTimeout(3000);
    await capture(ap, 'pocketbase_admin_logs');

    const logText = await ap.evaluate(() => document.body.innerText.slice(0, 5000));
    REPORT.admin.logsSample = logText;

    const errorRows = await ap.locator('table tr').count().catch(() => 0);
    REPORT.admin.logRowCount = errorRows;

    await ab.close();
  } catch (e) {
    REPORT.admin.logsError = e.message;
    console.log('  ⚠️ Admin logs error:', e.message);
  }
} else {
  console.log('  ⚠️ Skipped — PB SDK not authenticated');
}

writeFileSync(`${outDir}/${ts}_review-report.json`, JSON.stringify(REPORT, null, 2));
console.log(`\n✅ Review complete. Report: ${outDir}/${ts}_review-report.json\n`);
