/**
 * OCR receipt parsing - runs in a child process so each request gets
 * a fresh process with no shared Tesseract state (fixes 422 on every
 * upload after one bad image).
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function extractReceiptItems(imagePath: string): Promise<{ name: string; price: number }[]> {
  return new Promise((resolve, reject) => {
    const serverDir = path.join(__dirname, '..');
    const workerScript = path.join(__dirname, 'ocr-worker.ts');
    const tsxCli = path.join(serverDir, 'node_modules/tsx/dist/cli.mjs');
    const proc = spawn(process.execPath, [tsxCli, workerScript, imagePath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: serverDir,
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (chunk) => { stdout += chunk; });
    proc.stderr?.on('data', (chunk) => { stderr += chunk; });

    proc.on('close', (code) => {
      if (code === 0) {
        try {
          const items = JSON.parse(stdout || '[]') as { name: string; price: number }[];
          resolve(Array.isArray(items) ? items : []);
        } catch {
          reject(new Error('Couldn\'t read the image. Please try again with a clearer photo.'));
        }
      } else {
        console.warn('OCR worker failed:', stderr || code);
        reject(new Error('Couldn\'t read the image. Please try again with a clearer photo.'));
      }
    });

    proc.on('error', (err) => {
      console.warn('OCR spawn error:', err);
      reject(new Error('Couldn\'t read the image. Please try again with a clearer photo.'));
    });
  });
}
