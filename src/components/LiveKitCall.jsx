import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { Mic, MicOff, Video, VideoOff, Volume2, Users, PhoneOff } from "lucide-react";
import { Button } from "./ui/button";
import { joinRoom } from "@/lib/livekit.functions";
import { motion } from "framer-motion";

function ParticipantMedia({
  participant,
  local,
  revision,
  mode = "grid", // "grid" | "featured" | "main" | "thumb"
  constraintsRef,
  onSwap,
}) {
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

  const name = participant.name || participant.identity;
  const isThumb = mode === "thumb";

  const tileClass = {
    grid: "relative aspect-[3/4] min-h-0 rounded-2xl",
    featured: "relative min-h-[360px] flex-1 rounded-2xl",
    main: "absolute inset-0 z-0 rounded-2xl",
    thumb:
      "absolute right-3 top-3 z-20 h-40 w-28 cursor-grab rounded-xl shadow-2xl shadow-black/60 active:cursor-grabbing sm:h-48 sm:w-36",
  }[mode];

  return (
    <motion.section
      layout
      drag={isThumb}
      dragConstraints={constraintsRef}
      dragElastic={0.1}
      dragMomentum={false}
      onTap={isThumb ? onSwap : undefined}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={`isolate touch-none overflow-hidden border border-white/10 bg-[#171725] ${tileClass}`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={local}
        aria-label={`${local ? "Local" : "Remote"} video`}
        className={`absolute inset-0 h-full w-full object-cover ${
          local ? "-scale-x-100" : ""
        } ${cameraOff ? "invisible" : ""}`}
      />

      {cameraOff && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-300">
          <div
            className={`flex items-center justify-center rounded-full bg-white/10 ${
              isThumb ? "h-10 w-10 text-lg" : "h-16 w-16 text-2xl"
            }`}
          >
            {name.charAt(0).toUpperCase()}
          </div>
          {!isThumb && <span className="text-sm">Camera is off</span>}
        </div>
      )}

      {!local && <audio ref={audioRef} autoPlay />}

      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent ${
          isThumb ? "p-1.5 pt-6" : "p-3 pt-12"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className={`min-w-0 truncate rounded-full bg-black/40 font-medium text-white backdrop-blur-md ${
              isThumb ? "px-2 py-0.5 text-[11px]" : "px-3 py-1.5 text-sm"
            }`}
          >
            {name}
            {local ? " (You)" : ""}
          </span>

          {microphone?.isMuted && (
            <span
              className={`flex shrink-0 items-center justify-center rounded-full bg-red-500/90 text-white ${
                isThumb ? "h-5 w-5" : "h-8 w-8"
              }`}
            >
              <MicOff size={isThumb ? 11 : 15} />
            </span>
          )}
        </div>
      </div>
    </motion.section>
  );
}

export default function LiveKitCall({ roomId, onEndCall }) {
  const roomRef = useRef(null);

  const [room, setRoom] = useState(null);
  const [status, setStatus] = useState("Connecting…");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [needsAudio, setNeedsAudio] = useState(false);

  const stageRef = useRef(null);
  const [swapped, setSwapped] = useState(false);

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

        await meeting.connect(credentials.serverUrl, credentials.participantToken);

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
            "Connected, but your camera or microphone could not start. Check browser permissions and use the controls to retry.",
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
            : "Could not join this room. Check that the room is active and your server configuration is correct.",
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
          !meeting.localParticipant.isMicrophoneEnabled,
        );
      } else {
        await meeting.localParticipant.setCameraEnabled(!meeting.localParticipant.isCameraEnabled);
      }

      setError("");
      setRevision((value) => value + 1);
    } catch (err) {
      console.error(`Could not toggle ${kind}:`, err);
      setError(`Could not enable ${kind}. Check browser permissions and device availability.`);
    } finally {
      setBusy(false);
    }
  }

  const microphoneOn = room?.localParticipant.isMicrophoneEnabled ?? false;
  const cameraOn = room?.localParticipant.isCameraEnabled ?? false;

  const remotes = room ? Array.from(room.remoteParticipants.values()) : [];

  useEffect(() => {
    if (remotes.length !== 1) setSwapped(false);
  }, [remotes.length]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <p role="status" className="text-center text-sm text-muted-foreground">
        {status}
      </p>

      {error && (
        <p role="alert" className="text-center text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {remotes.length === 0 ? (
          <div className="flex min-h-[420px] flex-1 flex-col gap-4">
            {room && (
              <ParticipantMedia
                participant={room.localParticipant}
                local
                revision={revision}
                mode="featured"
              />
            )}

            <div className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-[#171725] px-4 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-violet-400">
                <Users size={20} />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-white">Waiting for someone to join</p>
                <p className="mt-1 text-sm text-gray-400">
                  Share your room link to invite a friend.
                </p>
              </div>
            </div>
          </div>
        ) : remotes.length === 1 ? (
          /* WhatsApp-style 1-on-1 */
          <div ref={stageRef} className="relative min-h-[420px] flex-1 overflow-hidden rounded-2xl">
            <ParticipantMedia
              key="local"
              participant={room.localParticipant}
              local
              revision={revision}
              mode={swapped ? "main" : "thumb"}
              constraintsRef={stageRef}
              onSwap={() => setSwapped((s) => !s)}
            />
            <ParticipantMedia
              key={remotes[0].identity}
              participant={remotes[0]}
              revision={revision}
              mode={swapped ? "thumb" : "main"}
              constraintsRef={stageRef}
              onSwap={() => setSwapped((s) => !s)}
            />
          </div>
        ) : (
          /* Group call: purana grid */
          <div className="grid min-h-[420px] flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
            {room && (
              <ParticipantMedia participant={room.localParticipant} local revision={revision} />
            )}
            {remotes.map((participant) => (
              <ParticipantMedia
                key={participant.identity}
                participant={participant}
                revision={revision}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-auto shrink-0 border-t border-white/10 bg-[#090912]/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-4 backdrop-blur-xl">
  <div className="flex items-center justify-center gap-3">
    <Button
      variant="secondary"
      className={`h-14 w-14 rounded-full border border-white/10 ${
        microphoneOn
          ? "bg-[#26263a] text-white hover:bg-[#35354a]"
          : "bg-red-500/15 text-red-400 hover:bg-red-500/25"
      }`}
      title={microphoneOn ? "Mute microphone" : "Unmute microphone"}
      aria-label={microphoneOn ? "Mute microphone" : "Unmute microphone"}
      aria-pressed={microphoneOn}
      disabled={status !== "Connected" || busy}
      onClick={() => toggleMedia("microphone")}
    >
      {microphoneOn ? <Mic size={22} /> : <MicOff size={22} />}
    </Button>

    <Button
      variant="secondary"
      className={`h-14 w-14 rounded-full border border-white/10 ${
        cameraOn
          ? "bg-[#26263a] text-white hover:bg-[#35354a]"
          : "bg-red-500/15 text-red-400 hover:bg-red-500/25"
      }`}
      title={cameraOn ? "Turn camera off" : "Turn camera on"}
      aria-label={cameraOn ? "Turn camera off" : "Turn camera on"}
      aria-pressed={cameraOn}
      disabled={status !== "Connected" || busy}
      onClick={() => toggleMedia("camera")}
    >
      {cameraOn ? <Video size={22} /> : <VideoOff size={22} />}
    </Button>

    <Button
      variant="destructive"
      className="h-14 rounded-full bg-red-600 px-6 text-white hover:bg-red-500"
      title="End call"
      aria-label="End call"
      onClick={onEndCall}
    >
      <PhoneOff size={22} />
    </Button>

    {needsAudio && (
      <Button
        variant="secondary"
        className="h-14 rounded-full bg-violet-600 px-5 text-white hover:bg-violet-500"
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
        <Volume2 size={20} />
        Enable audio
      </Button>
    )}
  </div>
</div>

      <p className="text-center text-xs text-muted-foreground">
        Your connection uses a server-generated, short-lived LiveKit token.
      </p>
    </div>
  );
}
