
import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { Mic, MicOff, Video, VideoOff, Volume2 } from "lucide-react";
import { Button } from "./ui/button";
import { joinRoom } from "@/lib/livekit.functions";

function ParticipantMedia({ participant, local, revision }) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  const camera = participant.getTrackPublication(Track.Source.Camera);
  const microphone = participant.getTrackPublication(Track.Source.Microphone);
  const videoTrack = camera?.track;
  const audioTrack = microphone?.track;
  const cameraOff = camera?.isMuted || !videoTrack;

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
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={local}
        aria-label={`${local ? "Local" : "Remote"} video`}
        className={`h-full min-h-[240px] w-full object-contain ${
          cameraOff ? "invisible" : ""
        }`}
      />

      {cameraOff && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          Camera off
        </div>
      )}

      {!local && <audio ref={audioRef} autoPlay />}

      <span className="absolute bottom-3 left-3 rounded-lg bg-background/80 px-3 py-1 text-sm">
        {participant.name || participant.identity}
        {local ? " (you)" : ""}
      </span>
    </section>
  );
}

export default function LiveKitCall({ roomId }) {
  const roomRef = useRef(null);

  const [room, setRoom] = useState(null);
  const [status, setStatus] = useState("Connecting…");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [needsAudio, setNeedsAudio] = useState(false);

  useEffect(() => {
    if (!roomId) {
      setStatus("Connection failed");
      setError("No room ID was provided. Return to Rooms and try again.");
      return;
    }

    let cancelled = false;

    const meeting = new Room({
      adaptiveStream: true,
      dynacast: true,
    });

    roomRef.current = meeting;
    setRoom(null);
    setError("");
    setStatus("Connecting…");

    const refresh = () => {
      if (!cancelled) setRevision((value) => value + 1);
    };

    const events = [
      RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
      RoomEvent.TrackSubscribed,
      RoomEvent.TrackUnsubscribed,
      RoomEvent.LocalTrackPublished,
      RoomEvent.LocalTrackUnpublished,
      RoomEvent.TrackMuted,
      RoomEvent.TrackUnmuted,
      RoomEvent.ParticipantNameChanged,
    ];

    events.forEach((event) => meeting.on(event, refresh));

    meeting.on(RoomEvent.ConnectionStateChanged, (state) => {
      if (cancelled) return;

      if (state === "connected") setStatus("Connected");
      else if (state === "reconnecting") setStatus("Reconnecting…");
      else if (state === "disconnected") setStatus("Disconnected");
      else setStatus("Connecting…");
    });

    meeting.on(RoomEvent.Disconnected, () => {
      if (!cancelled) {
        setError("The call disconnected. Return to Rooms and try joining again.");
      }
    });

    meeting.on(RoomEvent.AudioPlaybackStatusChanged, () => {
      if (!cancelled) setNeedsAudio(!meeting.canPlaybackAudio);
    });

    async function connect() {
      try {
        // Pass the room UUID to the server.
        // The server validates the room and generates the LiveKit token.
        const credentials = await joinRoom({
          data: { roomId },
        });

        if (!credentials?.serverUrl || !credentials?.participantToken) {
          throw new Error("The server did not return valid LiveKit credentials.");
        }

        if (cancelled) return;

        await meeting.connect(
          credentials.serverUrl,
          credentials.participantToken
        );

        if (cancelled) {
          await meeting.disconnect();
          return;
        }

        setRoom(meeting);

        const results = await Promise.allSettled([
          meeting.localParticipant.setCameraEnabled(true),
          meeting.localParticipant.setMicrophoneEnabled(true),
        ]);

        if (cancelled) {
          await meeting.disconnect();
          return;
        }

        if (results.some((result) => result.status === "rejected")) {
          setError(
            "Connected, but your camera or microphone could not start. Check browser permissions and use the controls to retry."
          );
        }

        setNeedsAudio(!meeting.canPlaybackAudio);
        refresh();
      } catch (err) {
        if (cancelled) return;

        console.error("LiveKit join failed:", err);

        await meeting.disconnect();

        setRoom(null);
        setStatus("Connection failed");
        setError(
          err instanceof Error
            ? err.message
            : "Could not join this room. Check that the room is active and your server configuration is correct."
        );
      }
    }

    void connect();

    return () => {
      cancelled = true;
      meeting.removeAllListeners();

      if (roomRef.current === meeting) {
        roomRef.current = null;
      }

      void meeting.disconnect();
    };
  }, [roomId]);

  async function toggleMedia(kind) {
    const meeting = roomRef.current;

    if (!meeting || meeting.state !== "connected" || busy) return;

    setBusy(true);

    try {
      if (kind === "microphone") {
        await meeting.localParticipant.setMicrophoneEnabled(
          !meeting.localParticipant.isMicrophoneEnabled
        );
      } else {
        await meeting.localParticipant.setCameraEnabled(
          !meeting.localParticipant.isCameraEnabled
        );
      }

      setError("");
      setRevision((value) => value + 1);
    } catch (err) {
      console.error(`Could not toggle ${kind}:`, err);
      setError(
        `Could not enable ${kind}. Check browser permissions and device availability.`
      );
    } finally {
      setBusy(false);
    }
  }

  const microphoneOn = room?.localParticipant.isMicrophoneEnabled ?? false;
  const cameraOn = room?.localParticipant.isCameraEnabled ?? false;

  const remotes = room
    ? Array.from(room.remoteParticipants.values())
    : [];

  return (
    <div className="flex min-h-[calc(100dvh-100px)] flex-col gap-3">
      <p role="status" className="text-center text-sm text-muted-foreground">
        {status}
      </p>

      {error && (
        <p role="alert" className="text-center text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid flex-1 gap-3 sm:grid-cols-2">
        {room && (
          <ParticipantMedia
            participant={room.localParticipant}
            local
            revision={revision}
          />
        )}

        {remotes.map((participant) => (
          <ParticipantMedia
            key={participant.identity}
            participant={participant}
            revision={revision}
          />
        ))}

        {!remotes.length && (
          <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-border bg-card text-center text-muted-foreground">
            {room
              ? "You're connected! Waiting for another participant…"
              : "Connecting to meeting…"}
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Button
          variant="secondary"
          className="btn-ghost"
          size="icon"
          title={microphoneOn ? "Mute microphone" : "Unmute microphone"}
          aria-label={microphoneOn ? "Mute microphone" : "Unmute microphone"}
          aria-pressed={microphoneOn}
          disabled={status !== "Connected" || busy}
          onClick={() => toggleMedia("microphone")}
        >
          {microphoneOn ? <Mic /> : <MicOff />}
        </Button>

        <Button
          variant="secondary"
          className="btn-ghost"
          size="icon"
          title={cameraOn ? "Turn camera off" : "Turn camera on"}
          aria-label={cameraOn ? "Turn camera off" : "Turn camera on"}
          aria-pressed={cameraOn}
          disabled={status !== "Connected" || busy}
          onClick={() => toggleMedia("camera")}
        >
          {cameraOn ? <Video /> : <VideoOff />}
        </Button>

        {needsAudio && (
          <Button
            variant="secondary"
            className="btn-ghost"
            onClick={async () => {
              try {
                await roomRef.current?.startAudio();
                setNeedsAudio(false);
                setError("");
              } catch (err) {
                console.error("Audio playback failed:", err);
                setError("Audio playback was blocked. Try enabling audio again.");
              }
            }}
          >
            <Volume2 />
            Enable audio
          </Button>
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Your connection uses a server-generated, short-lived LiveKit token.
      </p>
    </div>
  );
}
