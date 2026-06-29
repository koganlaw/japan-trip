// Build a passphrase-gated index.html from the plaintext app (app.src.html).
// The app is AES-256-GCM encrypted with a key derived from the passphrase
// (PBKDF2-SHA256). The deployed page contains ONLY ciphertext; it decrypts
// in the browser after the correct passphrase is entered.
//
//   node gate.mjs "your passphrase"      (or: echo "pass" | node gate.mjs)
//
// Then commit & push the regenerated index.html. Edit app.src.html for any
// content change and re-run this. app.src.html is gitignored (never deployed).

import { webcrypto as crypto } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import readline from "node:readline";

function ask(q) {
  return new Promise((res) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, (a) => { rl.close(); res(a); });
  });
}

const pass = (process.argv[2] || process.env.GATE_PASS || (await ask("Set the family passphrase: "))).trim();
if (!pass) { console.error("No passphrase given - aborting."); process.exit(1); }

const html = readFileSync("app.src.html");
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const ITER = 200000;

const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
const key = await crypto.subtle.deriveKey(
  { name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" },
  km, { name: "AES-GCM", length: 256 }, false, ["encrypt"]
);
const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, html));
const b64 = (u) => Buffer.from(u).toString("base64");

const TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#15223c">
<meta name="robots" content="noindex,nofollow">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icon-192.png">
<title>Japan · Jul 2026</title>
<style>
  :root{--navy:#15223c;--verm:#cf4628;--mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;--sans:-apple-system,system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  *{box-sizing:border-box}
  html,body{margin:0;height:100%}
  body{font-family:var(--sans);background:var(--navy);color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;-webkit-font-smoothing:antialiased}
  .lock{width:100%;max-width:360px;text-align:center}
  .mk{font-family:var(--mono);font-size:12px;letter-spacing:.3em;color:#aeb9d2}
  h1{font-size:20px;margin:10px 0 4px;font-weight:650;letter-spacing:.01em}
  .sub{font-size:13px;color:#aeb9d2;margin-bottom:22px}
  form{display:flex;gap:8px}
  input{flex:1;min-width:0;border:1px solid #2e3e60;background:#1d2c4a;color:#fff;border-radius:10px;padding:12px 13px;font-size:16px;font-family:var(--sans);-webkit-appearance:none}
  input::placeholder{color:#7d89a8}
  button{border:none;border-radius:10px;padding:12px 16px;background:var(--verm);color:#fff;font-family:var(--mono);font-size:13px;letter-spacing:.04em;cursor:pointer}
  button:disabled{opacity:.6}
  .err{color:#ff9b82;font-family:var(--mono);font-size:12px;margin-top:12px;min-height:14px}
  .hint{color:#6f7c9b;font-size:11px;margin-top:20px;line-height:1.5}
  :focus-visible{outline:2px solid var(--verm);outline-offset:2px}
</style>
</head>
<body>
  <div class="lock">
    <div class="mk">日本</div>
    <h1>Japan Family Trip</h1>
    <div class="sub">🔒 Private — enter the family passphrase.</div>
    <form id="f">
      <input id="p" type="password" autocomplete="current-password" placeholder="Passphrase" aria-label="Passphrase" autofocus>
      <button type="submit" id="go">Unlock</button>
    </form>
    <div id="err" class="err" role="alert"></div>
    <div class="hint">Shared once with family. Saved on this device for the session after you unlock.</div>
  </div>
<script>
const SALT="__SALT__", IV="__IV__", CT="__CT__", ITER=__ITER__;
const dec=b=>Uint8Array.from(atob(b),c=>c.charCodeAt(0));
async function unlock(pass){
  const km=await crypto.subtle.importKey("raw",new TextEncoder().encode(pass),"PBKDF2",false,["deriveKey"]);
  const key=await crypto.subtle.deriveKey({name:"PBKDF2",salt:dec(SALT),iterations:ITER,hash:"SHA-256"},km,{name:"AES-GCM",length:256},false,["decrypt"]);
  const buf=await crypto.subtle.decrypt({name:"AES-GCM",iv:dec(IV)},key,dec(CT));
  const html=new TextDecoder().decode(buf);
  try{sessionStorage.setItem("jp_pass",pass);}catch(e){}
  document.open();document.write(html);document.close();
}
document.getElementById("f").addEventListener("submit",async e=>{
  e.preventDefault();
  const err=document.getElementById("err"), go=document.getElementById("go");
  err.textContent=""; go.disabled=true;
  try{ await unlock(document.getElementById("p").value); }
  catch(_){ err.textContent="Wrong passphrase — try again."; go.disabled=false; }
});
(()=>{ let s=null; try{s=sessionStorage.getItem("jp_pass");}catch(e){} if(s) unlock(s).catch(()=>{ try{sessionStorage.removeItem("jp_pass");}catch(e){} }); })();
</script>
</body>
</html>
`;

const out = TEMPLATE
  .replaceAll("__SALT__", b64(salt))
  .replaceAll("__IV__", b64(iv))
  .replaceAll("__ITER__", String(ITER))
  .replaceAll("__CT__", b64(ct));

writeFileSync("index.html", out);
console.log(`Wrote gated index.html - ${ct.length} bytes ciphertext, ${ITER} PBKDF2 iterations.`);
