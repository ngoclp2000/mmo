import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('buyer workflow: resolve exact SKU, observe price, opt-in alert and affiliate demo', async ({
  page,
}) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Chào mừng trở lại' }),
  ).toBeVisible();
  await page
    .getByLabel('Email', { exact: true })
    .fill('demo-a@commerceos.local');
  await page
    .getByLabel('Mật khẩu', { exact: true })
    .fill(process.env.DEMO_PASSWORD ?? 'CommerceOS-demo-2026');
  await page.getByRole('button', { name: 'Mở workspace' }).click();
  await expect(
    page.getByRole('heading', { name: 'Tổng quan workspace.' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Theo dõi sản phẩm', exact: true })
    .click();
  await page.getByLabel('URL sản phẩm mẫu').fill('https://169.254.169.254/');
  await page.getByRole('button', { name: 'Kiểm tra', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
  await page
    .getByLabel('URL sản phẩm mẫu')
    .fill('https://shopee.vn/mock/sneaker');
  await page.getByRole('button', { name: 'Kiểm tra', exact: true }).click();
  await page.getByLabel('Biến thể / SKU chính xác').selectOption('sneaker-38');
  await page.getByLabel('Cảnh báo khi giá ≤ (VND)').fill('1100000');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Bật theo dõi SKU' }).click();
  const card = page
    .getByTestId('watch-card')
    .filter({ hasText: 'Everyday Runner' });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Chi tiết', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('heading', { name: 'Everyday Runner' }),
  ).toBeVisible();
  const session = await (await page.request.get('/api/session')).json();
  const tenant = session.workspaces[0].id;
  await expect
    .poll(async () => {
      const dash = await (
        await page.request.get(`/api/workspaces/${tenant}/dashboard`)
      ).json();
      return dash.jobs.some(
        (job: { scenario: string; status: string }) =>
          job.scenario === 'steady' && job.status === 'completed',
      );
    })
    .toBe(true);
  await page.getByLabel('Mô phỏng lần kiểm tra tiếp theo').selectOption('drop');
  await page.getByRole('button', { name: 'Chạy mô phỏng' }).click();
  await expect(dialog.getByText('Deal score: 25/100')).toBeVisible({
    timeout: 15000,
  });
  await expect
    .poll(async () => {
      const dash = await (
        await page.request.get(`/api/workspaces/${tenant}/dashboard`)
      ).json();
      return dash.alerts.length;
    })
    .toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Thu hồi opt-in' }).click();
  await expect(
    dialog.getByRole('button', { name: 'Bật opt-in' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Bật opt-in' }).click();
  await page.getByRole('button', { name: 'Mở link demo' }).click();
  await expect(
    page.getByRole('heading', {
      name: 'Một click được ghi nhận. Mọi giới hạn đều rõ ràng.',
    }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Về tổng quan' }).click();
  await expect(page.getByTestId('click-count')).toContainText('1');
  // Seed additional synthetic cards through the UI for visual coverage.
  for (const title of ['Studio Quiet', 'Daily Carry']) {
    const library = page.locator('.library-card').filter({ hasText: title });
    await library.getByRole('button', { name: 'Theo dõi mẫu' }).click();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Bật theo dõi SKU' }).click();
    await page.goto('/overview');
  }
  await expect(page.getByTestId('watch-card')).toHaveCount(3);
  if (await page.locator('.toast .icon-button').count())
    await page.locator('.toast .icon-button').first().click();
  await mkdir('test-results/screenshots', { recursive: true });
  await page.screenshot({
    path: 'test-results/screenshots/overview-desktop.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole('heading', { name: 'Tổng quan workspace.' }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  await page.screenshot({
    path: 'test-results/screenshots/overview-mobile.png',
    fullPage: true,
  });
  await page
    .locator('.mobile-nav')
    .getByRole('link', { name: 'Cảnh báo', exact: true })
    .click();
  await expect(page.getByTestId('alert-row')).toHaveCount(1);
  await page
    .locator('.mobile-nav')
    .getByRole('link', { name: 'Vận hành', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Hàng đợi & dead-letter' }),
  ).toBeVisible();
  await page
    .locator('.mobile-nav')
    .getByRole('button', { name: 'Đăng xuất' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Chào mừng trở lại' }),
  ).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});
