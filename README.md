# 🎥 VibeLive — Video Rooms

**VibeLive** is a lightweight, mobile-friendly video-calling web application that lets users create or join rooms and communicate through real-time video and audio.

Built with React and Vite, VibeLive provides a simple interface for starting video calls and sharing room links with other participants.

## ✨ Features

- 📹 **Live Video Calling** — Join video meetings using an integrated video service.
- 🚪 **Room-Based Meetings** — Create a room or join an existing room using its name.
- 🔗 **Shareable Room Links** — Share a room link so others can join the same meeting.
- 🎲 **Random Room Generation** — Generate unique room names for new meetings.
- 🎤 **Audio and Video Controls** — Manage your microphone and camera during calls.
- 📱 **Responsive UI** — Designed to work on desktop and mobile browsers.
- 🌙 **Modern Dark Theme** — Clean interface with dark backgrounds and violet accents.
- 🧹 **Call Cleanup** — Leave meetings and clean up the active video-call session.

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| React | UI components and application logic |
| JavaScript | Application functionality |
| Vite | Development server and build tooling |
| Tailwind CSS | Styling and responsive layouts |
| Video SDK / Service | Real-time video and audio communication |

## 🚀 Getting Started

### Prerequisites

Install the following before running the project:

- [Node.js](https://nodejs.org/) — preferably a current LTS version
- npm — included with Node.js
- [Git](https://git-scm.com/) — for cloning the repository

### 1. Clone the repository

```bash
git clone <your-repository-url>
```

### 2. Navigate to the project directory

```bash
cd <repository-name>
```

Replace `<repository-name>` with your actual project folder name.

### 3. Install dependencies

```bash
npm install
```

### 4. Start the development server

```bash
npm run dev
```

Open the local URL shown in your terminal, usually:

```text
http://localhost:5173
```

## 📞 How to Use VibeLive

1. Open the application.
2. Enter a display name.
3. Enter a room name or generate a random one.
4. Start the video call.
5. Copy and share the room link with another participant.
6. Open the shared link on another device and join the same room.
7. Use the available microphone and camera controls during the call.
8. Leave the meeting when finished.

For the best testing experience, use two devices or two separate browser sessions and allow camera and microphone permissions.

## 🧪 Testing

Verify the following before deploying:

- The application starts without errors.
- Users can create or select a room.
- Shared links preserve the intended room name.
- Two participants can join the same room.
- Video and audio work in both directions.
- Microphone, camera, and leave-call controls work correctly.
- The layout works on mobile and desktop screens.

## 🌐 Deployment

VibeLive can be deployed to a compatible web-hosting platform, such as:

- [Lovable](https://lovable.dev/)
- [Vercel](https://vercel.com/)
- [Netlify](https://www.netlify.com/)

After deployment, test the published URL on real devices. Camera and microphone access generally requires a secure HTTPS context, except for certain local development origins.

## ⚠️ Limitations and Security

- Video-call availability depends on the configured video service.
- Public video services may impose meeting, moderation, or usage restrictions.
- A shared room name is not authentication and should not be treated as a security boundary.
- Do not share private API credentials in frontend code or commit secrets to GitHub.
- The app should not be considered production-ready for private or sensitive conversations without appropriate access controls, abuse prevention, and a reviewed security design.

## 🧑‍💻 Built with Lovable

This project was initially created using [Lovable](https://lovable.dev/).

Continue editing it in the [VibeLive Lovable project](https://lovable.dev/projects/76d5c081-0707-4830-96f8-6b527c22d0b5).

Changes made in Lovable are synchronized with the connected GitHub repository according to its integration settings. You can also clone the repository, edit the code locally, and push your changes to the configured branch.

## 📄 License

Choose and add an appropriate open-source license before distributing this project publicly. Until then, all rights remain with the copyright holder.

---

**VibeLive — Simple rooms. Real conversations.** 💜
