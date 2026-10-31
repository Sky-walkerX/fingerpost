import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { buildApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';

export type AdbCommand = (args: string[]) => Promise<string>;
export type UsbState = 'ready' | 'waiting' | 'forwarding_failed';

export async function restoreUsbForwarding(run: AdbCommand): Promise<UsbState> {
  try {
    if ((await run(['-d', 'get-state'])).trim() !== 'device') return 'waiting';
  } catch { return 'waiting'; }
  try {
    const forwards = await run(['-d', 'reverse', '--list']);
    if (!forwards.split('\n').some((line) => line.trim().split(/\s+/).slice(-2).join(' ') === 'tcp:8080 tcp:8080'))
      await run(['-d', 'reverse', 'tcp:8080', 'tcp:8080']);
    return 'ready';
  } catch { return 'forwarding_failed'; }
}

export function phoneDevConfig() {
  // Never inherit provider credentials or live mode from the developer's shell.
  return loadConfig({ MODEL_MODE: 'mock', AUTH_REQUIRED: 'false', LOG_LEVEL: 'silent', GIT_SHA: 'phone-dev' });
}

export function buildPhoneGateway() {
  return buildApp(phoneDevConfig(), {
    mockNotice: 'Practice mode. Targets are simulated. Do not use these directions on real controls.',
  });
}

export function watchUsbForwarding(run: AdbCommand, report: (state: UsbState) => void): () => Promise<void> {
  let stopped = false;
  let previous: UsbState | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: Promise<void>;
  const check = async () => {
    const state = await restoreUsbForwarding(run);
    if (stopped) return;
    if (state !== previous) { previous = state; report(state); }
    timer = setTimeout(() => { pending = check(); }, 2_000);
  };
  pending = check();
  return async () => { stopped = true; clearTimeout(timer); await pending; };
}

const exec = promisify(execFile);
export function adbCommand(): AdbCommand {
  const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? join(homedir(), 'Android', 'Sdk');
  const adb = join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
  return async (args) => (await exec(adb, args, { timeout: 3_000, maxBuffer: 64 * 1024 })).stdout;
}

export async function startPhoneDev(run: AdbCommand = adbCommand(), report: (message: string) => void = console.log, port = 8080) {
  const app = await buildPhoneGateway();
  try { await app.listen({ host: '127.0.0.1', port }); }
  catch (error) { await app.close(); throw error; }
  report('Local mock gateway ready. Keep this terminal open while testing the USB phone.');
  report('Use a debug APK built with -Pfingerpost.gatewayUrl=ws://127.0.0.1:8080. No live recognition or cloud calls.');
  const messages: Record<UsbState, string> = {
    ready: 'USB gateway route ready. Open Fingerpost on the phone.',
    waiting: 'Waiting for one USB phone. Connect it and allow USB debugging.',
    forwarding_failed: 'USB forwarding failed. Check the USB debugging connection.',
  };
  const stopWatching = watchUsbForwarding(run, (state) => report(messages[state]));
  return async () => { await stopWatching(); await app.close(); };
}

if (import.meta.main) {
  try {
    const stop = await startPhoneDev();
    let stopping = false;
    const shutdown = () => {
      if (stopping) return;
      stopping = true;
      void stop().catch(() => { process.exitCode = 1; });
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  } catch {
    console.error('Could not start the local phone gateway. Check port 8080, Node 24 and installed dependencies.');
    process.exitCode = 1;
  }
}
