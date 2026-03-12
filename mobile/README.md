# Tabby Mobile

Expo-based React Native client for the Tabby iOS app.

## Requirements

- Node `>= 20.19.4`
- Xcode + iOS Simulator
- EAS CLI for cloud builds and TestFlight

## Local setup

1. Copy `.env.example` to `.env` and point `EXPO_PUBLIC_API_URL` at your backend.
2. Install dependencies:
   `npm install`
3. Start the backend from the repo root:
   `npm run server`
4. Start the native dev client:
   `npm run start`

## Native workflows

- Build native iOS project locally:
  `npm run ios`
- Prebuild native folders if needed:
  `npm run prebuild`
- Typecheck:
  `npm run typecheck`

## App capabilities included

- Secure token storage with refresh-token support
- Native auth, onboarding, groups, notifications, group detail, receipt upload, item claiming, settlement, account, and card flows
- Deep-link scheme: `tabby://join/:token`
- Optional push-token registration endpoint
- Plaid mobile SDK wiring with fallback to the existing stub bank-link route

## Release checklist

1. Replace `expo.extra.apiUrl` in `app.json` with the production API.
2. Replace `expo.extra.eas.projectId` with the real EAS project id.
3. Confirm `com.tabby.mobile` is the final iOS bundle identifier.
4. Replace default Expo icons/splash assets with final Tabby branding.
5. If you want true Universal Links, add the real associated domain to `app.json` and host the Apple App Site Association file on that domain.
6. Confirm Plaid dashboard redirect/package settings match the production iOS bundle id.
7. Run the production migration set on the backend, including `010_device_tokens.sql`.
8. Log into Expo:
   `npx eas login`
9. Create a preview/internal build:
   `npm run build:ios:preview`
10. Create the production/TestFlight build:
    `npm run build:ios:production`
11. Submit the latest production build:
    `npm run submit:ios`

## Notes

- `expo start --dev-client` is used because Plaid and other native modules require a dev client or EAS build, not Expo Go.
- Push token registration is stored server-side, but delivery logic still depends on your notification sending infrastructure.
