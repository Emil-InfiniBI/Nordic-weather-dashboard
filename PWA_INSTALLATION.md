# Weather Dashboard - PWA Installation Guide

Your weather dashboard is now a **Progressive Web App (PWA)**! You can install it on your Android phone like a native app.

## 📱 How to Install on Android

### Method 1: Chrome Browser (Recommended)
1. Open Chrome on your Android device
2. Visit your dashboard URL (e.g., `http://your-cloudflare-tunnel-url.trycloudflare.com` or your local IP)
3. Tap the **three dots menu** (⋮) in the top-right corner
4. Select **"Add to Home screen"** or **"Install app"**
5. Choose a name (default: "Weather Dashboard")
6. Tap **"Add"** or **"Install"**
7. The app icon will appear on your home screen! 🎉

### Method 2: Firefox Browser
1. Open Firefox on your Android device
2. Visit your dashboard URL
3. Tap the **three dots menu** (⋮)
4. Select **"Install"** or **"Add to Home screen"**
5. Confirm the installation

### Method 3: Samsung Internet Browser
1. Open Samsung Internet on your device
2. Visit your dashboard URL
3. Tap the **menu icon**
4. Select **"Add page to"** → **"Home screen"**

## ✨ Features

Once installed, your PWA app will:
- **Work offline** (cached pages and assets)
- **Launch in fullscreen** (no browser UI)
- **Show a splash screen** on startup
- **Appear in your app drawer** alongside native apps
- **Update automatically** when you refresh

## 🔄 Updates

The app automatically caches files for offline use. When you make changes to your dashboard:
1. Open the installed app
2. Pull down to refresh (or close and reopen)
3. The service worker will fetch the latest version

## 🎨 Customizing the Icon

The current icon is a placeholder (sun + cloud + rain). To use a custom icon:

1. Create or download 192x192px and 512x512px PNG images
2. Replace these files on your server:
   - `/home/admin/weather-cinematic-dashboard/backend/static/icon-192.png`
   - `/home/admin/weather-cinematic-dashboard/backend/static/icon-512.png`
3. Restart Flask: `sudo systemctl restart weather-dashboard`
4. Reinstall the app (or clear cache)

## 🐛 Troubleshooting

### "Add to Home Screen" option doesn't appear
- Make sure you're using HTTPS or localhost (PWAs require secure contexts)
- Clear browser cache and reload
- Check browser console for service worker errors

### App doesn't update
- Open Chrome DevTools on desktop
- Go to Application → Service Workers
- Click "Unregister" to force re-registration
- Reload the page

### Service worker errors
- Check `/backend/static/service-worker.js` file paths match your structure
- Verify all cached files exist

## 📊 What Gets Cached

The service worker caches these files for offline use:
- HTML, CSS, JavaScript files
- Three.js modules and shaders
- Background images (optional - currently not cached to save space)

**API calls are NOT cached** - they always fetch fresh data from your server.

## 🚀 Next Steps (Optional)

### Add Push Notifications
Requires backend integration with Firebase Cloud Messaging or similar service.

### Add Background Sync
Update weather data even when app is closed (requires advanced service worker setup).

### Publish to Play Store
Wrap your PWA with [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) or [PWABuilder](https://www.pwabuilder.com/) to create a proper APK for Google Play Store distribution.

---

Enjoy your installable weather dashboard! 🌤️
