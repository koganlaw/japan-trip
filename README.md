# Japan Family Trip · Jul 2026

A single-file, mobile-first trip companion (installable PWA, works offline),
protected by a family passphrase.

- **Live:** https://koganlaw.github.io/japan-trip/ — enter the family passphrase to unlock.
- Share the passphrase with family privately (it is not stored in this repo).
- Open the link, unlock, then **Add to Home Screen** to install.

## How it works
- `app.src.html` — the real app (HTML/CSS/JS inline). **Gitignored — never deployed.**
- `gate.mjs` — AES-256-GCM encrypts `app.src.html` (PBKDF2 key from the passphrase) into `index.html`.
- `index.html` — the deployed lock screen; contains only ciphertext until unlocked in-browser.
- `sw.js`, `manifest.webmanifest`, `icon-*.png` — offline + install support.

## Update the content
1. Edit `app.src.html`.
2. `node gate.mjs`  (enter the passphrase when prompted)
3. `git add -A && git commit && git push` — GitHub Pages redeploys.
