"use client";

import React, { useState, useEffect, useRef, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PeerConnectionManager,
  SignalingMessage,
  PeerMediaState,
  RemoteParticipant,
} from "../../lib/webrtc";

interface MeetingData {
  id: string;
  meeting_code: string;
  event_id: string;
  club_id: string;
  title: string;
  status: string;
  event_name: string;
  club_name: string;
  club_code: string;
  isHost: boolean;
  isLeader: boolean;
  currentUserId: string;
  currentUserName: string;
  currentUserPhoto: string | null;
  participants: Array<{ id: string; display_name: string; role: string }>;
}

interface ChatMessage {
  id: string;
  senderName: string;
  text: string;
  time: string;
}

export default function MeetingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: meetingCode } = use(params);
  const router = useRouter();

  // Navigation & Core States
  const [meeting, setMeeting] = useState<MeetingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"prejoin" | "meeting" | "ended">("prejoin");

  // Device & Stream States
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>("");
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>("");
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [displayName, setDisplayName] = useState("");

  // Live Room States
  const [remoteParticipants, setRemoteParticipants] = useState<Map<string, RemoteParticipant>>(new Map());
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showParticipantsDrawer, setShowParticipantsDrawer] = useState(false);
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [recordingUploading, setRecordingUploading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // References
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peerManagerRef = useRef<PeerConnectionManager | null>(null);
  const sseSourceRef = useRef<EventSource | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch Meeting Details on Mount
  useEffect(() => {
    async function fetchMeeting() {
      try {
        setLoading(true);
        const res = await fetch(`/api/meetings/${meetingCode}`);
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || "Failed to load meeting.");
        }
        setMeeting(data.meeting);
        setDisplayName(data.meeting.currentUserName || "Member");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading meeting.");
      } finally {
        setLoading(false);
      }
    }
    fetchMeeting();
  }, [meetingCode]);

  // Helper to attach stream to video element reliably
  const attachStreamToVideo = (videoEl: HTMLVideoElement | null, stream: MediaStream | null) => {
    if (!videoEl || !stream) return;
    try {
      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }
      videoEl.muted = true;
      const playPromise = videoEl.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          if (err.name !== "AbortError") {
            console.warn("Video playback warning:", err);
          }
        });
      }
    } catch (e) {
      console.warn("Error attaching stream to video:", e);
    }
  };

  // Callback ref to attach stream immediately as soon as video DOM node mounts
  const handleLocalVideoRef = useCallback((videoEl: HTMLVideoElement | null) => {
    localVideoRef.current = videoEl;
    if (videoEl && localStreamRef.current) {
      attachStreamToVideo(videoEl, localStreamRef.current);
    }
  }, []);

  // Global listener to immediately un-suspend AudioContext on any user interaction
  useEffect(() => {
    const resumeAudioOnGesture = () => {
      if (audioContextRef.current && audioContextRef.current.state === "suspended") {
        audioContextRef.current.resume().catch(() => {});
      }
    };
    window.addEventListener("click", resumeAudioOnGesture, { capture: true });
    window.addEventListener("keydown", resumeAudioOnGesture, { capture: true });
    window.addEventListener("touchstart", resumeAudioOnGesture, { capture: true });
    return () => {
      window.removeEventListener("click", resumeAudioOnGesture, { capture: true });
      window.removeEventListener("keydown", resumeAudioOnGesture, { capture: true });
      window.removeEventListener("touchstart", resumeAudioOnGesture, { capture: true });
    };
  }, []);

  // Helper to setup Web Audio level meter
  const setupAudioMeter = (stream: MediaStream) => {
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }

      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;
      if (audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
      }

      // Create audio-only media stream to avoid multi-track issues on Safari/Chrome
      const audioOnlyStream = new MediaStream([audioTracks[0]]);
      const source = audioCtx.createMediaStreamSource(audioOnlyStream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.fftSize);
      let animationFrameId: number;

      const checkVolume = () => {
        if (audioCtx.state === "suspended") {
          audioCtx.resume().catch(() => {});
        }

        analyser.getByteTimeDomainData(dataArray);
        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const norm = (dataArray[i] - 128) / 128;
          sumSquares += norm * norm;
        }
        const rms = Math.sqrt(sumSquares / dataArray.length);
        // Conversational speaking RMS is typically 0.04 to 0.25
        const computedLevel = Math.min(100, Math.round(rms * 350));
        setAudioLevel(computedLevel);

        animationFrameId = requestAnimationFrame(checkVolume);
      };
      checkVolume();

      return () => {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
      };
    } catch (err) {
      console.warn("Audio meter setup failed:", err);
    }
  };

  // 2. Initialize Media Devices & Pre-Join Stream (Run once on prejoin mount)
  useEffect(() => {
    if (step !== "prejoin") return;

    let cleanupMeter: (() => void) | undefined;
    let localStream: MediaStream | null = null;

    async function initDevicesAndPreview() {
      try {
        setCameraError(null);
        setMicError(null);

        // 1. Request user media with ideal constraints, falling back gracefully
        try {
          localStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          });
        } catch (initialErr: any) {
          console.warn("Initial getUserMedia failed, attempting basic constraints:", initialErr);
          try {
            localStream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: true,
            });
          } catch (basicErr: any) {
            console.warn("Combined getUserMedia failed, attempting separate tracks:", basicErr);
            let videoStream: MediaStream | null = null;
            let audioStream: MediaStream | null = null;

            try {
              videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
            } catch (vErr: any) {
              setCameraError(vErr.name === "NotAllowedError" ? "Camera permission denied" : "Camera unavailable");
            }

            try {
              audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            } catch (aErr: any) {
              setMicError(aErr.name === "NotAllowedError" ? "Microphone permission denied" : "Microphone unavailable");
            }

            localStream = new MediaStream([
              ...(videoStream ? videoStream.getVideoTracks() : []),
              ...(audioStream ? audioStream.getAudioTracks() : []),
            ]);
          }
        }

        localStreamRef.current = localStream;

        // Attach stream to video element
        if (localVideoRef.current && localStream.getVideoTracks().length > 0) {
          attachStreamToVideo(localVideoRef.current, localStream);
        }

        // Setup microphone meter
        if (localStream.getAudioTracks().length > 0) {
          cleanupMeter = setupAudioMeter(localStream);
        }

        // 2. Enumerate devices AFTER permissions are granted
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioIns = devices.filter((d) => d.kind === "audioinput");
            const videoIns = devices.filter((d) => d.kind === "videoinput");
            setAudioDevices(audioIns);
            setVideoDevices(videoIns);

            const activeAudio = localStream.getAudioTracks()[0]?.getSettings()?.deviceId;
            const activeVideo = localStream.getVideoTracks()[0]?.getSettings()?.deviceId;

            if (activeAudio) setSelectedAudioDevice(activeAudio);
            else if (audioIns[0]) setSelectedAudioDevice(audioIns[0].deviceId);

            if (activeVideo) setSelectedVideoDevice(activeVideo);
            else if (videoIns[0]) setSelectedVideoDevice(videoIns[0].deviceId);
          } catch (e) {
            console.warn("Device enumeration error:", e);
          }
        }
      } catch (err) {
        console.error("Error setting up preview stream:", err);
      }
    }

    initDevicesAndPreview();

    return () => {
      if (cleanupMeter) cleanupMeter();
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [step]);

  // Ensure video element receives stream as soon as loading completes or view re-renders
  useEffect(() => {
    if (!loading && localVideoRef.current && localStreamRef.current) {
      attachStreamToVideo(localVideoRef.current, localStreamRef.current);
    }
  }, [loading, step, cameraEnabled]);

  // Seamless Audio Device Switcher
  const handleAudioDeviceChange = async (newDeviceId: string) => {
    setSelectedAudioDevice(newDeviceId);
    if (!localStreamRef.current) return;

    try {
      const constraints: MediaTrackConstraints = newDeviceId
        ? { deviceId: { ideal: newDeviceId } }
        : {};
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: constraints,
      });
      const newTrack = newStream.getAudioTracks()[0];
      if (newTrack) {
        const oldTrack = localStreamRef.current.getAudioTracks()[0];
        if (oldTrack) {
          localStreamRef.current.removeTrack(oldTrack);
          oldTrack.stop();
        }
        localStreamRef.current.addTrack(newTrack);
        newTrack.enabled = micEnabled;
        peerManagerRef.current?.setLocalStream(localStreamRef.current);
        setupAudioMeter(localStreamRef.current);
      }
    } catch (err) {
      console.warn("Failed to switch audio input device:", err);
    }
  };

  // Seamless Video Device Switcher
  const handleVideoDeviceChange = async (newDeviceId: string) => {
    setSelectedVideoDevice(newDeviceId);
    if (!localStreamRef.current) return;

    try {
      const constraints: MediaTrackConstraints = {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        ...(newDeviceId ? { deviceId: { ideal: newDeviceId } } : {}),
      };
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: constraints,
      });
      const newTrack = newStream.getVideoTracks()[0];
      if (newTrack) {
        const oldTrack = localStreamRef.current.getVideoTracks()[0];
        if (oldTrack) {
          localStreamRef.current.removeTrack(oldTrack);
          oldTrack.stop();
        }
        localStreamRef.current.addTrack(newTrack);
        newTrack.enabled = cameraEnabled;
        attachStreamToVideo(localVideoRef.current, localStreamRef.current);
        peerManagerRef.current?.setLocalStream(localStreamRef.current);
      }
    } catch (err) {
      console.warn("Failed to switch video input device:", err);
    }
  };

  // Toggle Camera in Prejoin / Meeting
  const toggleCamera = () => {
    if (!localStreamRef.current) return;
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      const nextEnabled = !videoTrack.enabled;
      videoTrack.enabled = nextEnabled;
      setCameraEnabled(nextEnabled);
      if (nextEnabled && localVideoRef.current) {
        attachStreamToVideo(localVideoRef.current, localStreamRef.current);
      }
      broadcastMediaState();
    }
  };

  // Toggle Microphone in Prejoin / Meeting
  const toggleMic = () => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      const nextEnabled = !audioTrack.enabled;
      audioTrack.enabled = nextEnabled;
      setMicEnabled(nextEnabled);
      if (nextEnabled) {
        setupAudioMeter(localStreamRef.current);
      } else {
        setAudioLevel(0);
      }
      broadcastMediaState();
    }
  };

  // Broadcast media state changes over signaling
  const broadcastMediaState = () => {
    if (step !== "meeting" || !meeting) return;
    sendSignal({
      type: "media_state",
      meetingCode,
      senderId: meeting.currentUserId,
      senderName: displayName,
      payload: {
        audioEnabled: micEnabled,
        videoEnabled: cameraEnabled,
        isScreenSharing,
      },
    });
  };

  // 3. Signaling Message Sender via POST
  const sendSignal = async (msg: SignalingMessage) => {
    try {
      await fetch(`/api/meetings/${meetingCode}/signal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(msg),
      });
    } catch (err) {
      console.error("Failed to send signaling message:", err);
    }
  };

  // 4. Enter Meeting
  const handleJoinMeeting = async () => {
    if (!meeting) return;
    try {
      setStep("meeting");

      // Notify backend participant joined
      await fetch(`/api/meetings/${meetingCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", displayName }),
      });

      // Initialize WebRTC Mesh Connection Manager
      const peerManager = new PeerConnectionManager({
        localId: meeting.currentUserId,
        localName: displayName,
        meetingCode,
        onSignalSend: sendSignal,
        onRemoteStreamUpdate: (peerId: string, stream: MediaStream) => {
          setRemoteParticipants((prev) => {
            const next = new Map(prev);
            const existing = next.get(peerId);
            if (existing) {
              next.set(peerId, { ...existing, stream });
            } else {
              next.set(peerId, {
                id: peerId,
                name: "Peer",
                stream,
                mediaState: { audioEnabled: true, videoEnabled: true, isScreenSharing: false },
                connectionState: "connected",
              });
            }
            return next;
          });
        },
        onPeerConnectionStateChange: (peerId: string, connState: RTCPeerConnectionState) => {
          setRemoteParticipants((prev) => {
            const next = new Map(prev);
            const p = next.get(peerId);
            if (p) next.set(peerId, { ...p, connectionState: connState });
            return next;
          });
        },
      });

      peerManagerRef.current = peerManager;
      peerManager.setLocalStream(localStreamRef.current);

      // Connect to SSE Signaling Stream
      const eventSource = new EventSource(`/api/meetings/${meetingCode}/signal`);
      sseSourceRef.current = eventSource;

      eventSource.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (!msg || !msg.type) return;

          const senderId = msg.senderId;
          const senderName = msg.senderName;

          if (senderId === meeting.currentUserId) return;

          switch (msg.type) {
            case "peer_join":
              // New peer entered! Initiate call to establish mesh
              setRemoteParticipants((prev) => {
                const next = new Map(prev);
                if (!next.has(senderId)) {
                  next.set(senderId, {
                    id: senderId,
                    name: senderName || "Participant",
                    mediaState: { audioEnabled: true, videoEnabled: true, isScreenSharing: false },
                    connectionState: "connecting",
                  });
                }
                return next;
              });
              await peerManager.initiateCall(senderId);
              break;

            case "offer":
              setRemoteParticipants((prev) => {
                const next = new Map(prev);
                if (!next.has(senderId)) {
                  next.set(senderId, {
                    id: senderId,
                    name: senderName || "Participant",
                    mediaState: { audioEnabled: true, videoEnabled: true, isScreenSharing: false },
                    connectionState: "connecting",
                  });
                }
                return next;
              });
              await peerManager.handleOffer(senderId, msg.payload);
              break;

            case "answer":
              await peerManager.handleAnswer(senderId, msg.payload);
              break;

            case "ice_candidate":
              await peerManager.handleCandidate(senderId, msg.payload);
              break;

            case "media_state":
              setRemoteParticipants((prev) => {
                const next = new Map(prev);
                const p = next.get(senderId);
                if (p) {
                  next.set(senderId, { ...p, mediaState: msg.payload });
                }
                return next;
              });
              break;

            case "peer_leave":
              peerManager.removePeer(senderId);
              setRemoteParticipants((prev) => {
                const next = new Map(prev);
                next.delete(senderId);
                return next;
              });
              break;

            case "chat":
              setChatMessages((prev) => [
                ...prev,
                {
                  id: `${Date.now()}-${Math.random()}`,
                  senderName: msg.senderName,
                  text: msg.payload.text,
                  time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                },
              ]);
              break;
          }
        } catch (e) {
          console.error("Failed to parse incoming signal message:", e);
        }
      };

      // Broadcast own entry to room
      await sendSignal({
        type: "peer_join",
        meetingCode,
        senderId: meeting.currentUserId,
        senderName: displayName,
      });
    } catch (err) {
      console.error("Error joining meeting room:", err);
    }
  };

  // Attach local stream to video element when step changes to meeting
  useEffect(() => {
    if (step === "meeting" && localVideoRef.current && localStreamRef.current) {
      attachStreamToVideo(localVideoRef.current, localStreamRef.current);
    }
  }, [step]);

  // 5. Screen Sharing
  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      // Stop screen sharing
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);
      peerManagerRef.current?.setScreenStream(null);
      sendSignal({
        type: "screen_state",
        meetingCode,
        senderId: meeting!.currentUserId,
        senderName: displayName,
        payload: { isScreenSharing: false },
      });
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });

        screenStreamRef.current = screenStream;
        setIsScreenSharing(true);

        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = screenStream;
        }

        peerManagerRef.current?.setScreenStream(screenStream);

        // Handle native browser "Stop sharing" button
        screenStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          screenStreamRef.current = null;
          peerManagerRef.current?.setScreenStream(null);
          sendSignal({
            type: "screen_state",
            meetingCode,
            senderId: meeting!.currentUserId,
            senderName: displayName,
            payload: { isScreenSharing: false },
          });
        };

        sendSignal({
          type: "screen_state",
          meetingCode,
          senderId: meeting!.currentUserId,
          senderName: displayName,
          payload: { isScreenSharing: true },
        });
      } catch (err: any) {
        if (err.name !== "NotAllowedError") {
          console.error("Screen sharing error:", err);
        }
      }
    }
  };

  // 6. Audio-Only Recording with MediaRecorder
  const startRecordingWithConsent = () => {
    setShowConsentModal(false);
    try {
      if (!localStreamRef.current) return;

      // Extract only audio tracks for audio-only recording
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length === 0) {
        alert("No active audio tracks available to record. Please unmute your microphone.");
        return;
      }

      const audioStream = new MediaStream(audioTracks);

      // Check browser MIME type support dynamically
      const mimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ];
      let selectedMime = "";
      for (const m of mimeTypes) {
        if (MediaRecorder.isTypeSupported(m)) {
          selectedMime = m;
          break;
        }
      }

      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(audioStream, selectedMime ? { mimeType: selectedMime } : undefined);
      } catch {
        recorder = new MediaRecorder(audioStream);
      }
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      try {
        recorder.start(1000); // 1-second chunks
      } catch {
        recorder.start(); // Fallback without timeslice for Safari / restrictive WebKit
      }
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (e) {
      console.error("Failed to start MediaRecorder:", e);
      alert("Audio recording failed to initialize on this browser.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
  };

  // 7. Send In-Room Chat Message
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !meeting) return;

    const newMsg: ChatMessage = {
      id: `${Date.now()}-${Math.random()}`,
      senderName: displayName,
      text: chatInput.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setChatMessages((prev) => [...prev, newMsg]);

    sendSignal({
      type: "chat" as any,
      meetingCode,
      senderId: meeting.currentUserId,
      senderName: displayName,
      payload: { text: chatInput.trim() },
    });

    setChatInput("");
  };

  // 8. Leave or End Meeting
  const handleLeaveOrEnd = async (isEndingForAll: boolean) => {
    try {
      // Stop recording if active and wait for final audio chunk
      if (isRecording && mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        await new Promise<void>((resolve) => {
          if (!mediaRecorderRef.current) return resolve();
          mediaRecorderRef.current.onstop = () => resolve();
          mediaRecorderRef.current.stop();
        });
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        setIsRecording(false);
      }

      // Stop media tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
      }

      // Close WebRTC
      peerManagerRef.current?.closeAll();

      // Close SSE
      if (sseSourceRef.current) {
        sseSourceRef.current.close();
      }

      // Broadcast leave signal
      await sendSignal({
        type: "peer_leave",
        meetingCode,
        senderId: meeting!.currentUserId,
        senderName: displayName,
      });

      // Prepare audio upload if chunks exist
      let audioBlob: Blob | null = null;
      if (recordedChunksRef.current.length > 0) {
        audioBlob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
      }

      setStep("ended");

      if (audioBlob || isEndingForAll) {
        setRecordingUploading(true);
        const formData = new FormData();
        if (audioBlob) {
          formData.append("audio", audioBlob, `meeting-${meetingCode}.webm`);
          formData.append("duration", recordingSeconds.toString());
        }

        await fetch(`/api/meetings/${meetingCode}/end`, {
          method: "POST",
          body: formData,
        });
        setRecordingUploading(false);
      } else {
        // Simple leave
        await fetch(`/api/meetings/${meetingCode}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "leave" }),
        });
      }
    } catch (err) {
      console.error("Error leaving meeting:", err);
      setStep("ended");
    }
  };

  const copyMeetingCode = () => {
    navigator.clipboard.writeText(meetingCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Format recording timer seconds to mm:ss
  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#121810] text-[#F4F6F0] flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 rounded-full border-2 border-[#859B62] border-t-transparent animate-spin mb-4" />
        <p className="text-sm font-medium text-[#98AA90]">Connecting to ClubOps meeting room...</p>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="min-h-screen bg-[#121810] text-[#F4F6F0] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold mb-2">Meeting Not Found</h2>
        <p className="text-sm text-[#98AA90] max-w-md mb-6">{error || "The meeting code you entered is invalid or has expired."}</p>
        <button
          onClick={() => router.back()}
          className="px-5 py-2.5 rounded-xl bg-[#859B62] hover:bg-[#738852] text-white font-medium text-sm transition-all"
        >
          Go Back
        </button>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: PRE-JOIN SCREEN
  // ─────────────────────────────────────────────────────────────────────────────
  if (step === "prejoin") {
    return (
      <div className="min-h-screen bg-[#0E140D] text-[#F4F6F0] flex flex-col justify-between p-4 sm:p-8">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-[#283422] pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#859B62]/20 border border-[#859B62]/40 flex items-center justify-center text-[#8FA96D] font-bold">
              CO
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">{meeting.title}</h1>
              <p className="text-xs text-[#98AA90]">{meeting.club_name} • {meeting.event_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyMeetingCode}
              className="px-3 py-1.5 rounded-lg bg-[#192015] border border-[#283422] text-xs font-mono text-[#D5E2C5] hover:border-[#859B62] transition-colors flex items-center gap-1.5"
            >
              <span>{meeting.meeting_code}</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            {copiedCode && <span className="text-xs text-[#8FA96D]">Copied!</span>}
          </div>
        </header>

        {/* Center Grid */}
        <main className="max-w-4xl w-full mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-center my-auto">
          {/* Camera Preview Card */}
          <div className="md:col-span-7 flex flex-col items-center">
            <div className="relative w-full aspect-video bg-[#192015] border border-[#283422] rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center group">
              <video
                ref={handleLocalVideoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={(e) => {
                  const el = e.currentTarget;
                  el.muted = true;
                  el.play().catch(() => {});
                }}
                className={`w-full h-full object-cover -scale-x-100 ${!cameraEnabled || cameraError ? "hidden" : "block"}`}
              />

              {!cameraError && cameraEnabled && !localStreamRef.current && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#192015]">
                  <div className="w-10 h-10 rounded-full border-2 border-[#859B62] border-t-transparent animate-spin mb-3" />
                  <p className="text-xs font-medium text-[#98AA90]">Starting camera preview...</p>
                </div>
              )}

              {(!cameraEnabled || cameraError) && (
                <div className="flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-20 h-20 rounded-full bg-[#202A1B] border border-[#283422] text-[#8FA96D] text-2xl font-bold flex items-center justify-center mb-3">
                    {displayName.slice(0, 2).toUpperCase() || "ME"}
                  </div>
                  <p className="text-sm font-medium text-[#98AA90]">
                    {cameraError ? cameraError : "Camera is turned off"}
                  </p>
                </div>
              )}

              {/* Audio Activity Meter Bar */}
              <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-2.5 bg-[#0E140D]/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-[#283422]/80 shadow-lg">
                  <svg className={`w-4 h-4 transition-colors ${micEnabled && !micError ? (audioLevel > 5 ? "text-emerald-400" : "text-[#8FA96D]") : "text-red-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  <div className="w-24 h-2 bg-[#283422] rounded-full overflow-hidden p-0.5 flex items-center">
                    <div
                      className={`h-full rounded-full transition-all duration-75 ${
                        audioLevel > 5 ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" : "bg-[#8FA96D]"
                      }`}
                      style={{ width: `${micEnabled && !micError ? Math.max(audioLevel > 5 ? audioLevel : 8, 0) : 0}%` }}
                    />
                  </div>
                  {micEnabled && !micError && (
                    <span className="text-[10px] font-mono text-[#98AA90] min-w-[28px]">
                      {audioLevel > 5 ? `${audioLevel}%` : "Live"}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 pointer-events-auto">
                  <button
                    onClick={toggleMic}
                    className={`p-2.5 rounded-xl border transition-all ${
                      micEnabled && !micError
                        ? "bg-[#202A1B] border-[#859B62] text-[#8FA96D] hover:bg-[#859B62]/20"
                        : "bg-red-500/10 border-red-500/40 text-red-400 hover:bg-red-500/20"
                    }`}
                    title={micEnabled ? "Mute Microphone" : "Unmute Microphone"}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {micEnabled ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      )}
                    </svg>
                  </button>

                  <button
                    onClick={toggleCamera}
                    className={`p-2.5 rounded-xl border transition-all ${
                      cameraEnabled && !cameraError
                        ? "bg-[#202A1B] border-[#859B62] text-[#8FA96D] hover:bg-[#859B62]/20"
                        : "bg-red-500/10 border-red-500/40 text-red-400 hover:bg-red-500/20"
                    }`}
                    title={cameraEnabled ? "Turn Off Camera" : "Turn On Camera"}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {cameraEnabled ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      )}
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Device Selectors */}
            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <div>
                <label className="block text-xs font-medium text-[#98AA90] mb-1">Microphone</label>
                <select
                  value={selectedAudioDevice}
                  onChange={(e) => handleAudioDeviceChange(e.target.value)}
                  className="w-full px-3 py-2 bg-[#192015] border border-[#283422] rounded-xl text-xs text-[#F4F6F0] focus:outline-none focus:border-[#859B62]"
                >
                  {audioDevices.length > 0 ? (
                    audioDevices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0, 5)}`}</option>
                    ))
                  ) : (
                    <option value="">Default Microphone</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#98AA90] mb-1">Camera</label>
                <select
                  value={selectedVideoDevice}
                  onChange={(e) => handleVideoDeviceChange(e.target.value)}
                  className="w-full px-3 py-2 bg-[#192015] border border-[#283422] rounded-xl text-xs text-[#F4F6F0] focus:outline-none focus:border-[#859B62]"
                >
                  {videoDevices.length > 0 ? (
                    videoDevices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 5)}`}</option>
                    ))
                  ) : (
                    <option value="">Default Camera</option>
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* Join Form & Room Details */}
          <div className="md:col-span-5 flex flex-col justify-center bg-[#192015] border border-[#283422] p-6 rounded-2xl shadow-xl">
            <h2 className="text-xl font-bold mb-1">Ready to join?</h2>
            <p className="text-xs text-[#98AA90] mb-6">
              {meeting.participants?.length || 0} participant{meeting.participants?.length === 1 ? "" : "s"} already connected
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#D5E2C5] mb-1.5">Your Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-4 py-2.5 bg-[#0E140D] border border-[#283422] rounded-xl text-sm text-white focus:outline-none focus:border-[#859B62]"
                />
              </div>

              <div className="pt-2">
                <button
                  onClick={handleJoinMeeting}
                  disabled={!displayName.trim()}
                  className="w-full py-3 rounded-xl bg-[#859B62] hover:bg-[#738852] disabled:opacity-50 text-white font-semibold text-sm shadow-lg shadow-[#859B62]/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Join Meeting</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>

              <p className="text-[11px] text-center text-[#6B7E64] mt-2">
                By entering, you grant access to audio and video. Real-time encryption is handled directly in-browser.
              </p>
            </div>
          </div>
        </main>

        <footer className="text-center text-xs text-[#6B7E64] pt-4">
          ClubOps.AI WebRTC Real-Time Conferencing • Mesh Node v1.0
        </footer>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: LIVE MEETING ROOM
  // ─────────────────────────────────────────────────────────────────────────────
  if (step === "meeting") {
    const peersList = Array.from(remoteParticipants.values());

    return (
      <div className="h-screen w-screen bg-[#0E140D] text-[#F4F6F0] flex flex-col overflow-hidden select-none">
        {/* Top Floating Glass Header */}
        <header className="h-14 border-b border-[#283422]/60 bg-[#121810]/70 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-20">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-[#8FA96D] animate-pulse" />
            <h1 className="text-sm font-semibold truncate max-w-xs">{meeting.title}</h1>
            <span className="hidden sm:inline-block text-xs px-2 py-0.5 rounded bg-[#192015] border border-[#283422] text-[#98AA90]">
              {meeting.meeting_code}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Recording Indicator */}
            {isRecording && (
              <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/30 rounded-full animate-pulse">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-xs font-bold text-red-400">REC</span>
                <span className="text-xs font-mono text-red-300">{formatTimer(recordingSeconds)}</span>
              </div>
            )}

            <button
              onClick={() => setShowParticipantsDrawer(!showParticipantsDrawer)}
              className="p-2 rounded-lg bg-[#192015] hover:bg-[#202A1B] border border-[#283422] text-xs text-[#D5E2C5] flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span>{peersList.length + 1}</span>
            </button>
          </div>
        </header>

        {/* Main Stage Grid */}
        <div className="flex-1 relative flex overflow-hidden">
          {/* Video Grid Canvas */}
          <main className="flex-1 p-3 sm:p-4 overflow-y-auto flex items-center justify-center">
            {isScreenSharing ? (
              // Screen Sharing Mode: Large Stage with Participant Strip
              <div className="w-full h-full flex flex-col gap-3">
                <div className="flex-1 relative bg-[#121810] border border-[#283422] rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center">
                  <video
                    ref={screenVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-3 left-3 bg-[#0E140D]/80 backdrop-blur-md px-3 py-1 rounded-lg border border-[#283422] text-xs text-[#8FA96D] flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>You are presenting your screen</span>
                  </div>
                </div>

                {/* Participant Thumbnails */}
                <div className="h-28 flex gap-3 overflow-x-auto pb-1">
                  {/* Local Thumbnail */}
                  <div className="w-44 h-full relative bg-[#192015] border border-[#283422] rounded-xl overflow-hidden shrink-0">
                    <video
                      ref={handleLocalVideoRef}
                      autoPlay
                      playsInline
                      muted
                      onLoadedMetadata={(e) => {
                        const el = e.currentTarget;
                        el.muted = true;
                        el.play().catch(() => {});
                      }}
                      className={`w-full h-full object-cover -scale-x-100 ${!cameraEnabled ? "hidden" : "block"}`}
                    />
                    {!cameraEnabled && (
                      <div className="w-full h-full flex items-center justify-center text-xs font-bold text-[#8FA96D]">
                        {displayName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="absolute bottom-1 left-2 text-[10px] text-white/80 bg-black/60 px-1.5 py-0.5 rounded">
                      You
                    </span>
                  </div>

                  {/* Remote Peer Thumbnails */}
                  {peersList.map((peer) => (
                    <div key={peer.id} className="w-44 h-full relative bg-[#192015] border border-[#283422] rounded-xl overflow-hidden shrink-0">
                      {peer.stream && (
                        <video
                          autoPlay
                          playsInline
                          ref={(el) => {
                            if (el && peer.stream) el.srcObject = peer.stream;
                          }}
                          className="w-full h-full object-cover"
                        />
                      )}
                      <span className="absolute bottom-1 left-2 text-[10px] text-white/80 bg-black/60 px-1.5 py-0.5 rounded">
                        {peer.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // Standard Participant Mesh Grid
              <div
                className={`w-full h-full grid gap-3 sm:gap-4 ${
                  peersList.length === 0
                    ? "grid-cols-1"
                    : peersList.length === 1
                    ? "grid-cols-1 sm:grid-cols-2"
                    : peersList.length <= 3
                    ? "grid-cols-2"
                    : "grid-cols-2 sm:grid-cols-3"
                }`}
              >
                {/* Local Participant Card */}
                <div className="relative bg-[#192015] border border-[#283422] rounded-2xl overflow-hidden shadow-lg flex items-center justify-center group">
                  <video
                    ref={handleLocalVideoRef}
                    autoPlay
                    playsInline
                    muted
                    onLoadedMetadata={(e) => {
                      const el = e.currentTarget;
                      el.muted = true;
                      el.play().catch(() => {});
                    }}
                    className={`w-full h-full object-cover -scale-x-100 ${!cameraEnabled ? "hidden" : "block"}`}
                  />

                  {!cameraEnabled && (
                    <div className="flex flex-col items-center justify-center p-6 text-center">
                      <div className="w-20 h-20 rounded-full bg-[#202A1B] border border-[#859B62]/40 text-[#8FA96D] text-2xl font-bold flex items-center justify-center mb-2">
                        {displayName.slice(0, 2).toUpperCase() || "ME"}
                      </div>
                      <p className="text-xs text-[#98AA90]">Camera is turned off</p>
                    </div>
                  )}

                  {/* Overlays */}
                  <div className="absolute bottom-3 left-3 bg-[#0E140D]/80 backdrop-blur-md px-3 py-1 rounded-lg border border-[#283422] flex items-center gap-2">
                    <span className="text-xs font-medium text-white">{displayName} (You)</span>
                    {!micEnabled && (
                      <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      </svg>
                    )}
                  </div>
                </div>

                {/* Remote Participant Cards */}
                {peersList.map((peer) => (
                  <div key={peer.id} className="relative bg-[#192015] border border-[#283422] rounded-2xl overflow-hidden shadow-lg flex items-center justify-center">
                    {peer.stream && (
                      <video
                        autoPlay
                        playsInline
                        ref={(el) => {
                          if (el && peer.stream) el.srcObject = peer.stream;
                        }}
                        className={`w-full h-full object-cover ${!peer.mediaState.videoEnabled ? "hidden" : "block"}`}
                      />
                    )}

                    {(!peer.stream || !peer.mediaState.videoEnabled) && (
                      <div className="flex flex-col items-center justify-center p-6 text-center">
                        <div className="w-20 h-20 rounded-full bg-[#202A1B] border border-[#283422] text-[#8FA96D] text-2xl font-bold flex items-center justify-center mb-2">
                          {peer.name.slice(0, 2).toUpperCase()}
                        </div>
                        <p className="text-xs text-[#98AA90]">{peer.name}</p>
                      </div>
                    )}

                    <div className="absolute bottom-3 left-3 bg-[#0E140D]/80 backdrop-blur-md px-3 py-1 rounded-lg border border-[#283422] flex items-center gap-2">
                      <span className="text-xs font-medium text-white">{peer.name}</span>
                      {!peer.mediaState.audioEnabled && (
                        <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        </svg>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>

          {/* Right Drawers (Participants / Chat) */}
          {showParticipantsDrawer && (
            <aside className="w-72 bg-[#121810] border-l border-[#283422] p-4 flex flex-col z-20">
              <div className="flex items-center justify-between pb-3 border-b border-[#283422] mb-3">
                <h3 className="text-sm font-semibold">Participants ({peersList.length + 1})</h3>
                <button onClick={() => setShowParticipantsDrawer(false)} className="text-[#98AA90] hover:text-white text-xs">Close</button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2">
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#192015] border border-[#283422]">
                  <span className="text-xs font-medium text-white">{displayName} (You)</span>
                  <span className="text-[10px] text-[#8FA96D] uppercase">{meeting.isHost ? "Host" : "Member"}</span>
                </div>
                {peersList.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-[#192015] border border-[#283422]">
                    <span className="text-xs text-[#D5E2C5]">{p.name}</span>
                    <span className="text-[10px] text-[#6B7E64]">Connected</span>
                  </div>
                ))}
              </div>
            </aside>
          )}

          {showChatDrawer && (
            <aside className="w-80 bg-[#121810] border-l border-[#283422] flex flex-col z-20">
              <div className="p-3 border-b border-[#283422] flex items-center justify-between">
                <h3 className="text-sm font-semibold">In-Meeting Chat</h3>
                <button onClick={() => setShowChatDrawer(false)} className="text-[#98AA90] hover:text-white text-xs">Close</button>
              </div>

              <div className="flex-1 p-3 overflow-y-auto space-y-2">
                {chatMessages.length === 0 ? (
                  <p className="text-xs text-[#6B7E64] text-center pt-8">No messages yet. Say hello!</p>
                ) : (
                  chatMessages.map((msg) => (
                    <div key={msg.id} className="bg-[#192015] border border-[#283422] p-2 rounded-xl text-xs">
                      <div className="flex items-center justify-between text-[#8FA96D] text-[10px] mb-1">
                        <span className="font-semibold">{msg.senderName}</span>
                        <span className="text-[#6B7E64]">{msg.time}</span>
                      </div>
                      <p className="text-[#F4F6F0] break-words">{msg.text}</p>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleSendChat} className="p-3 border-t border-[#283422] flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-1.5 bg-[#0E140D] border border-[#283422] rounded-lg text-xs text-white focus:outline-none focus:border-[#859B62]"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="px-3 py-1.5 bg-[#859B62] hover:bg-[#738852] disabled:opacity-50 text-white rounded-lg text-xs font-semibold"
                >
                  Send
                </button>
              </form>
            </aside>
          )}
        </div>

        {/* Bottom Floating Glass Control Bar */}
        <footer className="h-18 bg-[#121810]/80 backdrop-blur-xl border-t border-[#283422]/60 px-4 flex items-center justify-between z-20">
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={copyMeetingCode}
              className="text-xs text-[#98AA90] hover:text-white flex items-center gap-1.5"
            >
              <span>Code: {meeting.meeting_code}</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>

          {/* Core Controls */}
          <div className="flex items-center gap-2 sm:gap-3 mx-auto">
            {/* Mic */}
            <button
              onClick={toggleMic}
              className={`p-3 rounded-2xl border transition-all ${
                micEnabled
                  ? "bg-[#192015] border-[#283422] text-[#D5E2C5] hover:bg-[#202A1B]"
                  : "bg-red-500/10 border-red-500/40 text-red-400"
              }`}
              title={micEnabled ? "Mute Microphone" : "Unmute Microphone"}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {micEnabled ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                )}
              </svg>
            </button>

            {/* Camera */}
            <button
              onClick={toggleCamera}
              className={`p-3 rounded-2xl border transition-all ${
                cameraEnabled
                  ? "bg-[#192015] border-[#283422] text-[#D5E2C5] hover:bg-[#202A1B]"
                  : "bg-red-500/10 border-red-500/40 text-red-400"
              }`}
              title={cameraEnabled ? "Turn Off Camera" : "Turn On Camera"}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {cameraEnabled ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                )}
              </svg>
            </button>

            {/* Screen Share */}
            <button
              onClick={handleToggleScreenShare}
              className={`p-3 rounded-2xl border transition-all ${
                isScreenSharing
                  ? "bg-[#859B62] border-[#859B62] text-white"
                  : "bg-[#192015] border-[#283422] text-[#D5E2C5] hover:bg-[#202A1B]"
              }`}
              title={isScreenSharing ? "Stop Presenting" : "Present Screen"}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </button>

            {/* Audio Recording */}
            <button
              onClick={() => {
                if (isRecording) {
                  stopRecording();
                } else {
                  setShowConsentModal(true);
                }
              }}
              className={`p-3 rounded-2xl border transition-all ${
                isRecording
                  ? "bg-red-500 border-red-500 text-white animate-pulse"
                  : "bg-[#192015] border-[#283422] text-[#D5E2C5] hover:bg-[#202A1B]"
              }`}
              title={isRecording ? "Stop Recording" : "Record Meeting Audio"}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="6" fill={isRecording ? "white" : "currentColor"} />
              </svg>
            </button>

            {/* Chat Drawer Toggle */}
            <button
              onClick={() => setShowChatDrawer(!showChatDrawer)}
              className="p-3 rounded-2xl bg-[#192015] hover:bg-[#202A1B] border border-[#283422] text-[#D5E2C5]"
              title="Chat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </button>

            {/* Leave / End Button */}
            <button
              onClick={() => handleLeaveOrEnd(meeting.isHost)}
              className="px-5 py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs tracking-wide shadow-lg shadow-red-600/20 transition-all flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>{meeting.isHost ? "End Meeting" : "Leave"}</span>
            </button>
          </div>
        </footer>

        {/* Recording Consent Modal */}
        {showConsentModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#192015] border border-[#283422] rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold mb-2">Record Meeting Audio?</h3>
              <p className="text-xs text-[#98AA90] leading-relaxed mb-6">
                Meeting audio will be recorded and processed to generate executive summaries, decisions, and action items using ClubOps AI. Participants will see a recording indicator.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowConsentModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#202A1B] text-xs font-medium text-[#D5E2C5] hover:bg-[#283422]"
                >
                  Cancel
                </button>
                <button
                  onClick={startRecordingWithConsent}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-semibold text-white shadow-lg shadow-red-600/20"
                >
                  Start Recording
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: MEETING ENDED / PROCESSING FEEDBACK
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0E140D] text-[#F4F6F0] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#859B62]/20 border border-[#859B62]/40 text-[#8FA96D] flex items-center justify-center mb-4">
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h2 className="text-2xl font-bold mb-2">Meeting ended</h2>
      <p className="text-sm text-[#98AA90] max-w-md mb-6">
        {recordingUploading
          ? "Uploading meeting recording..."
          : "Your meeting recording is being processed. The AI executive summary and action items will appear on the event dashboard shortly."}
      </p>

      <div className="flex gap-4">
        <Link
          href={`/club/${meeting.club_code}/event/${meeting.event_id}`}
          className="px-6 py-2.5 rounded-xl bg-[#859B62] hover:bg-[#738852] text-white font-semibold text-sm transition-all shadow-lg shadow-[#859B62]/20"
        >
          Back to Event
        </Link>
      </div>
    </div>
  );
}
