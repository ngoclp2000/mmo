import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'tests/e2e',fullyParallel:false,workers:1,retries:0,timeout:45000,
  reporter:process.env.CI ? [['github'],['html',{open:'never'}]] : 'list',
  use:{baseURL:process.env.E2E_BASE_URL ?? 'http://localhost:5173',headless:true,viewport:{width:1440,height:1080},trace:'retain-on-failure',screenshot:'only-on-failure',launchOptions:process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH}:{}},
  ...(process.env.CI || process.env.E2E_MANAGED ? {webServer:[
    {command:'npm run start:api',url:`${process.env.E2E_BASE_URL ?? 'http://localhost:3000'}/healthz`,reuseExistingServer:false,env:{APP_ORIGIN:process.env.E2E_BASE_URL ?? 'http://localhost:3000',PORT:new URL(process.env.E2E_BASE_URL ?? 'http://localhost:3000').port}},
    {command:'npm run start:worker',wait:{stdout:/Worker ready/},reuseExistingServer:false},
  ]}:{}),
});
