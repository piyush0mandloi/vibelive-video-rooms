# VibeLive Video Rooms

Build a minimal, functional video-calling web app named VibeLive using React, plain JavaScript, Vite and Tailwind CSS. Do not use TypeScript. Create a polished, mobile-first dark UI with violet accents. The home screen should let a user enter a room name or generate a random room name, enter a display name, and click Start Video Call. Use the official Jitsi Meet IFrame API from https://meet.jit.si/external_api.js to embed a real meeting for the entered room on meet.jit.si. Load the external API script dynamically and initialize JitsiMeetExternalAPI only after the user clicks Start Video Call and the container is mounted. Use a sanitized, unique room name; do not generate a fixed shared room name for everyone. Show a clear pre-join screen, room name, loading state, error message, and Leave Call button. Include copy-room-link functionality so another user can join the same room. Clean up the Jitsi API instance and event listeners when leaving or unmounting. Make the video container responsive and tall enough for mobile devices. Use the meeting's built-in microphone, camera and hang-up controls. Do not add authentication, database, payments, fake video, or unrelated features. Do not claim calls are private or encrypted end-to-end. Keep the code simple and avoid unnecessary dependencies. After implementation, tell me how to test with two devices and any limitations of the public meet.jit.si service.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/76d5c081-0707-4830-96f8-6b527c22d0b5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
