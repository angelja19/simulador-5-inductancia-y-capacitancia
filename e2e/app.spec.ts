import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.goto('./');
});

test('inductor: v = L di/dt y paso a paso', async ({ page }, info) => {
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Simulador 5 – Inductancia y Capacitancia');
  await expect(page.getByText('50 V').first()).toBeVisible();
  if (info.project.name === 'celular') await page.getByRole('tab', { name: /2\. Solución/ }).click();
  await expect(page.getByText('Concepto clave').first()).toBeVisible();
});

test('error físico: salto de corriente en el inductor', async ({ page }) => {
  await page.getByRole('button', { name: /Plantillas/ }).click();
  await page.locator('.card', { hasText: 'corriente con un salto' }).getByRole('button').click();
  await expect(page.getByText(/impulso/).first()).toBeVisible();
});

test('red de inductores y DC con energía; captura', async ({ page }, info) => {
  await page.getByRole('button', { name: /Redes de L o C/ }).click();
  await expect(page.getByText(/L_eq entre los terminales/).first()).toBeVisible();
  await page.getByRole('button', { name: /Comportamiento en DC/ }).click();
  await expect(page.getByText('Energía almacenada en régimen permanente')).toBeVisible();
  await expect(page.getByText('3,2 mJ').first()).toBeVisible();
  await page.getByRole('button', { name: /5.1 Inductor/ }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `docs/captura-${info.project.name}.png` });
});
