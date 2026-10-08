// Подпись APK схемами v1 + v2 + v3 (библиотека apk_sign_ts из тулчейна).
// usage: node sign_apk.mjs <unsigned.apk> <signed.apk> <key.pem> <cert.pem> <apk_sign_ts dir>
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const [, , input, output, keyPem, certPem, lib] = process.argv;
const { ApkSigner, SigningKey } = await import(pathToFileURL(join(lib, 'dist', 'index.js')).href);

const apk = new Uint8Array(readFileSync(input));
const signer = new ApkSigner({
  signingKey: SigningKey.fromPEM(readFileSync(keyPem, 'utf8'), readFileSync(certPem, 'utf8')),
});
const { signedApk } = await signer.sign(apk);
writeFileSync(output, Buffer.from(signedApk));
console.log(`signed: ${output} (${signedApk.length} bytes)`);
