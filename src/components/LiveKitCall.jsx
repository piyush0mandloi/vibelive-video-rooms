import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, TokenSource, Track } from "livekit-client";
import { Mic, MicOff, Video, VideoOff, Volume2 } from "lucide-react";
import { Button } from "./ui/button";

export async function fetchRoomCredentials(roomName, participantName, participantIdentity) {
  const source = TokenSource.developmentTokenServer("vibelive-1j40t6");
  const credentials = await source.fetch({ roomName, participantName, participantIdentity });
  if (!credentials.serverUrl || !credentials.participantToken) {
    throw new Error("LiveKit did not return connection credentials.");
  }
  return credentials;
}

function ParticipantMedia({ participant, local, revision }) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const camera = participant.getTrackPublication(Track.Source.Camera);
  const microphone = participant.getTrackPublication(Track.Source.Microphone);
  const videoTrack = camera?.track;
  const audioTrack = microphone?.track;

  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (videoTrack && video) videoTrack.attach(video);
    if (!local && audioTrack && audio) audioTrack.attach(audio);
    return () => {
      if (videoTrack && video) videoTrack.detach(video);
      if (!local && audioTrack && audio) audioTrack.detach(audio);
    };
  }, [videoTrack, audioTrack, local, revision]);

  return (
    <section className="relative min-h-[240px] overflow-hidden rounded-xl border border-border bg-card">
      <video ref={videoRef} autoPlay playsInline muted={local} aria-label={`${local ? "Local" : "Remote"} video`} className={`h-full min-h-[240px] w-full object-contain ${camera?.isMuted || !videoTrack ? "invisible" : ""}`} />
      {(camera?.isMuted || !videoTrack) && <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">Camera off</div>}
      {!local && <audio ref={audioRef} autoPlay />}
      <span className="absolute bottom-3 left-3 rounded-lg bg-background/80 px-3 py-1 text-sm">{participant.name || participant.identity}{local ? " (you)" : ""}</span>
    </section>
  );
}

export default function LiveKitCall({ roomName, displayName }) {
  const roomRef = useRef(null);
  const [room, setRoom] = useState(null);
  const [status, setStatus] = useState("Connecting…");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [needsAudio, setNeedsAudio] = useState(false);

  useEffect(() => {
    const meeting = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = meeting;
    let cancelled = false;
    const refresh = () => { if (!cancelled) setRevision((value) => value + 1); };
    const events = [RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed, RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished, RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.ParticipantNameChanged];
    events.forEach((event) => meeting.on(event, refresh));
    meeting.on(RoomEvent.ConnectionStateChanged, (state) => {
      if (!cancelled) setStatus(state === "connected" ? "Connected" : state === "reconnecting" ? "Reconnecting…" : state === "disconnected" ? "Disconnected" : "Connecting…");
    });
    meeting.on(RoomEvent.Disconnected, () => {
      if (!cancelled) setError("The call disconnected. Leave and join again to reconnect.");
    });
    meeting.on(RoomEvent.AudioPlaybackStatusChanged, () => {
      if (!cancelled) setNeedsAudio(!meeting.canPlaybackAudio);
    });

    async function connect() {
      try {
        const { serverUrl, participantToken } = await fetchRoomCredentials(roomName, displayName, `vibelive-${crypto.randomUUID()}`);
        if (cancelled) return;
        await meeting.connect(serverUrl, participantToken);
        if (cancelled) { await meeting.disconnect(); return; }
        setRoom(meeting);
        const results = await Promise.allSettled([
          meeting.localParticipant.setCameraEnabled(true),
          meeting.localParticipant.setMicrophoneEnabled(true),
        ]);
        if (cancelled) { await meeting.disconnect(); return; }
        if (results.some((result) => result.status === "rejected")) setError("Camera or microphone unavailable. Check browser permissions, then use the controls to try again.");
        setNeedsAudio(!meeting.canPlaybackAudio);
        refresh();
      } catch {
        if (cancelled) return;
        await meeting.disconnect();
        setStatus("Connection failed");
        setError("Could not connect to LiveKit. Check your connection and enable Development token server for ID vibelive-1j40t6 in your LiveKit Cloud project Settings.");
      }
    }
    void connect();
    return () => {
      cancelled = true;
      meeting.removeAllListeners();
      roomRef.current = null;
      void meeting.disconnect(true);
    };
  }, [roomName, displayName]);

  async function toggleMedia(kind) {
    const meeting = roomRef.current;
    if (!meeting || meeting.state !== "connected" || busy) return;
    setBusy(true);
    try {
      if (kind === "microphone") await meeting.localParticipant.setMicrophoneEnabled(!meeting.localParticipant.isMicrophoneEnabled);
      else await meeting.localParticipant.setCameraEnabled(!meeting.localParticipant.isCameraEnabled);
      setError("");
      setRevision((value) => value + 1);
    } catch {
      setError(`Could not enable ${kind}. Check browser permissions and device availability.`);
    } finally { setBusy(false); }
  }

  const microphoneOn = room?.localParticipant.isMicrophoneEnabled;
  const cameraOn = room?.localParticipant.isCameraEnabled;
  const remotes = room ? Array.from(room.remoteParticipants.values()) : [];
  return (
    <div className="flex min-h-[calc(100dvh-100px)] flex-col gap-3">
      <p role="status" className="text-center text-sm text-muted-foreground">{status}</p>
      {error && <p role="alert" className="text-center text-sm text-destructive">{error}</p>}
      <div className="grid flex-1 gap-3 sm:grid-cols-2">
        {room && <ParticipantMedia participant={room.localParticipant} local revision={revision} />}
        {remotes.map((participant) => <ParticipantMedia key={participant.identity} participant={participant} revision={revision} />)}
        {!remotes.length && <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-border bg-card text-muted-foreground">{room ? "Waiting for the other participant…" : "Connecting to meeting…"}</div>}
      </div>
      <div className="flex justify-center gap-3">
        <Button variant="secondary" className="btn-ghost" size="icon" title={microphoneOn ? "Mute microphone" : "Unmute microphone"} aria-label={microphoneOn ? "Mute microphone" : "Unmute microphone"} aria-pressed={Boolean(microphoneOn)} disabled={status !== "Connected" || busy} onClick={() => toggleMedia("microphone")}>{microphoneOn ? <Mic /> : <MicOff />}</Button>
        <Button variant="secondary" className="btn-ghost" size="icon" title={cameraOn ? "Turn camera off" : "Turn camera on"} aria-label={cameraOn ? "Turn camera off" : "Turn camera on"} aria-pressed={Boolean(cameraOn)} disabled={status !== "Connected" || busy} onClick={() => toggleMedia("camera")}>{cameraOn ? <Video /> : <VideoOff />}</Button>
        {needsAudio && <Button variant="secondary" className="btn-ghost" onClick={async () => {
          try { await roomRef.current?.startAudio(); setNeedsAudio(false); }
          catch { setError("Audio playback was blocked. Try Enable audio again."); }
        }}><Volume2 />Enable audio</Button>}
      </div>
      <p className="text-center text-xs text-muted-foreground">Prototype only — development tokens are not secure for production.</p>
    </div>
  );
}