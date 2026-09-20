/**
 * WebRTC Mesh Signaling and Peer Connection Architecture
 * Decoupled client-side peer connection manager for small-group meetings.
 * Architecture is cleanly separated so it can be swapped for an SFU in the future.
 */

export interface SignalingMessage {
  type: "peer_join" | "peer_leave" | "offer" | "answer" | "ice_candidate" | "media_state" | "screen_state";
  meetingCode: string;
  senderId: string;
  senderName: string;
  targetId?: string; // If targeting a specific peer (e.g. for offer/answer/candidate)
  payload?: any;
}

export interface PeerMediaState {
  audioEnabled: boolean;
  videoEnabled: boolean;
  isScreenSharing: boolean;
}

export interface RemoteParticipant {
  id: string;
  name: string;
  stream?: MediaStream;
  mediaState: PeerMediaState;
  connectionState: RTCPeerConnectionState;
}

/**
 * Get STUN/TURN ICE Servers configuration
 */
export function getIceServers(): RTCIceServer[] {
  // Check if custom ICE servers are configured in environment
  if (typeof window !== "undefined" && (window as any).__ICE_SERVERS__) {
    return (window as any).__ICE_SERVERS__;
  }

  const customServers = process.env.NEXT_PUBLIC_ICE_SERVERS;
  if (customServers) {
    try {
      const parsed = JSON.parse(customServers);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      console.warn("Invalid NEXT_PUBLIC_ICE_SERVERS JSON, using Google STUN default.");
    }
  }

  // High-reliability public STUN servers for standard NAT traversal
  return [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ];
}

/**
 * PeerConnectionManager handles multi-peer WebRTC mesh connections
 */
export class PeerConnectionManager {
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private peerConnections = new Map<string, RTCPeerConnection>();
  private remoteStreams = new Map<string, MediaStream>();
  private localId: string;
  private localName: string;
  private meetingCode: string;
  private onSignalSend: (message: SignalingMessage) => void;
  private onRemoteStreamUpdate: (peerId: string, stream: MediaStream) => void;
  private onPeerConnectionStateChange: (peerId: string, state: RTCPeerConnectionState) => void;

  constructor(options: {
    localId: string;
    localName: string;
    meetingCode: string;
    onSignalSend: (message: SignalingMessage) => void;
    onRemoteStreamUpdate: (peerId: string, stream: MediaStream) => void;
    onPeerConnectionStateChange: (peerId: string, state: RTCPeerConnectionState) => void;
  }) {
    this.localId = options.localId;
    this.localName = options.localName;
    this.meetingCode = options.meetingCode;
    this.onSignalSend = options.onSignalSend;
    this.onRemoteStreamUpdate = options.onRemoteStreamUpdate;
    this.onPeerConnectionStateChange = options.onPeerConnectionStateChange;
  }

  public setLocalStream(stream: MediaStream | null) {
    this.localStream = stream;

    // Attach local tracks to all existing peer connections
    if (stream) {
      this.peerConnections.forEach((pc) => {
        stream.getTracks().forEach((track) => {
          const senders = pc.getSenders();
          const sender = senders.find((s) => s.track?.kind === track.kind);
          if (sender) {
            sender.replaceTrack(track).catch(console.error);
          } else {
            pc.addTrack(track, stream);
          }
        });
      });
    }
  }

  public setScreenStream(stream: MediaStream | null) {
    this.screenStream = stream;

    // Replace video track with screen track across all peers
    const activeVideoTrack = stream ? stream.getVideoTracks()[0] : this.localStream?.getVideoTracks()[0] || null;

    this.peerConnections.forEach((pc) => {
      const senders = pc.getSenders();
      const videoSender = senders.find((s) => s.track?.kind === "video");
      if (videoSender) {
        videoSender.replaceTrack(activeVideoTrack).catch(console.error);
      }
    });
  }

  private createPeerConnection(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({
      iceServers: getIceServers(),
    });

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.onSignalSend({
          type: "ice_candidate",
          meetingCode: this.meetingCode,
          senderId: this.localId,
          senderName: this.localName,
          targetId: peerId,
          payload: event.candidate.toJSON(),
        });
      }
    };

    // Handle incoming remote media tracks
    pc.ontrack = (event) => {
      let stream = this.remoteStreams.get(peerId);
      if (!stream) {
        stream = new MediaStream();
        this.remoteStreams.set(peerId, stream);
      }

      event.streams[0]?.getTracks().forEach((track) => {
        if (!stream!.getTracks().some((t) => t.id === track.id)) {
          stream!.addTrack(track);
        }
      });

      this.onRemoteStreamUpdate(peerId, stream);
    };

    // Connection state changes
    pc.onconnectionstatechange = () => {
      this.onPeerConnectionStateChange(peerId, pc.connectionState);
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        this.removePeer(peerId);
      }
    };

    // Add local tracks to peer connection
    const currentStream = this.localStream;
    if (currentStream) {
      currentStream.getTracks().forEach((track) => {
        // If screen sharing is active, use screen video track instead of camera track
        if (track.kind === "video" && this.screenStream) {
          const screenTrack = this.screenStream.getVideoTracks()[0];
          if (screenTrack) {
            pc.addTrack(screenTrack, currentStream);
            return;
          }
        }
        pc.addTrack(track, currentStream);
      });
    }

    this.peerConnections.set(peerId, pc);
    return pc;
  }

  public async initiateCall(peerId: string) {
    const pc = this.createPeerConnection(peerId);
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await pc.setLocalDescription(offer);

    this.onSignalSend({
      type: "offer",
      meetingCode: this.meetingCode,
      senderId: this.localId,
      senderName: this.localName,
      targetId: peerId,
      payload: offer,
    });
  }

  public async handleOffer(senderId: string, offer: RTCSessionDescriptionInit) {
    let pc = this.peerConnections.get(senderId);
    if (!pc) {
      pc = this.createPeerConnection(senderId);
    }

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.onSignalSend({
      type: "answer",
      meetingCode: this.meetingCode,
      senderId: this.localId,
      senderName: this.localName,
      targetId: senderId,
      payload: answer,
    });
  }

  public async handleAnswer(senderId: string, answer: RTCSessionDescriptionInit) {
    const pc = this.peerConnections.get(senderId);
    if (pc && pc.signalingState !== "closed") {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  public async handleCandidate(senderId: string, candidate: RTCIceCandidateInit) {
    const pc = this.peerConnections.get(senderId);
    if (pc && pc.remoteDescription) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  public removePeer(peerId: string) {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
    }
    this.remoteStreams.delete(peerId);
  }

  public closeAll() {
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    this.remoteStreams.clear();
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
    }
  }
}
