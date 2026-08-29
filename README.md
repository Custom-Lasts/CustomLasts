# Custom Lasts

Public atelier site for [customlasts.app](https://customlasts.app).

Consumers scan a foot into a digital last. Wearers free. Makers subscribe. Native iOS (ARKit) is a separate app — this repo is the marketing site plus a **browser foot-scan prototype**.

## Brand
- Cream `#F4EFE6`
- Espresso `#1C1916`
- Sage `#3F5C4D`
- Tagline: Your last. Forged from your foot.

## Browser scan (this repo)
Guided phone-camera photos (`scan.html`), stored only in this browser via IndexedDB (`custom-lasts-vault`). Vault: `history.html`. No backend, no Firebase, no uploads, no analytics.

After deploy, on a phone (Safari or Chrome, HTTPS):

https://customlasts.app/scan.html

Camera needs HTTPS. Photos never leave the device. Clearing site data wipes the vault.

## Preview
```
python3 -m http.server 4173
```
Then open http://127.0.0.1:4173 (camera may be blocked on plain http except localhost).

## Contact
tyler@customlasts.app
