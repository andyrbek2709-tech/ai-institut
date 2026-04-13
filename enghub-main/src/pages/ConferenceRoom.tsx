import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

interface ConferenceProps {
  project: any;
  currentUser: any;
  appUsers: any[];
  msgs: any[];
  C: any;
  token: string;
  onSendMsg: (text: string, type?: string) => Promise<boolean> | boolean;
  getUserById: (id: any) => any;
  conferenceParticipants: any[];
  onJoin: (micEnabled?: boolean, screenSharing?: boolean) => void;
  onLeave: () => Promise<void>;
  onPresenceUpdate: (updates: any) => Promise<void>;
  screenShareActive?: boolean;
}

const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
const SURL_CONST = process.env.REACT_APP_SUPABASE_URL || '';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

export function ConferenceRoom({
  project, currentUser, appUsers, msgs, C, token,
  onSendMsg, getUserById,
  conferenceParticipants, onJoin, onLeave, onPresenceUpdate,
  screenShareActive
}: ConferenceProps) {
  const [chatInput, setChatInput] = useState("");
  const [isInRoom, setIsInRoom] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "participants">("chat");
  const [showInviteMenu, setShowInviteMenu] = useState(false);
  const [selectedInvitees, setSelectedInvitees] = useState<Set<number>>(new Set());
  // Remote screen share: MediaStream received via WebRTC
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  // Sticky: turns false only after 1.5s without stream — avoids 1-frame layout flickers
  const [hasScreenContent, setHasScreenContent] = useState(false);

  const [showFloatingChat, setShowFloatingChat] = useState(false);
  // ── Управление мышью ──
  const [mouseCtrl, setMouseCtrl] = useState<'idle' | 'requesting' | 'granted'>('idle');
  const [mouseCtrlPending, setMouseCtrlPending] = useState<{id: string; name: string} | null>(null);
  const [mouseCtrlGrantedTo, setMouseCtrlGrantedTo] = useState<string | null>(null);
  const [remoteCursor, setRemoteCursor] = useState<{x: number; y: number} | null>(null);
  const lastMouseSendRef = useRef(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const inviteMenuRef = useRef<HTMLDivElement>(null);
  const broadcastRef = useRef<any>(null); // { ch, supa } Supabase signaling channel
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const screenSharingRef = useRef(false);
  const requestedFromRef = useRef<string | null>(null); // set once per sharer, never reset by presence heartbeat
  const hasRemoteRef = useRef(false); // sticky: stays true until explicit stop/disconnect
  // ── Audio WebRTC (separate from screen-share PCs) ──
  const audioPCsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const micEnabledRef = useRef(false); // ref copy to avoid stale closures in broadcast handlers
  const sendAudioOfferRef = useRef<((peerId: string) => Promise<void>) | null>(null);
  const SURL = process.env.REACT_APP_SUPABASE_URL || '';
  const SERVICE_KEY = process.env.REACT_APP_SUPABASE_SERVICE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || '';

  // ── Attach local screen stream to video element ──
  useEffect(() => {
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = screenSharing && screenStreamRef.current
        ? screenStreamRef.current : null;
    }
  }, [screenSharing]);

  // ── Attach remote WebRTC stream to video element ──
  // Use callback ref pattern so stream is set immediately when element mounts
  const remoteVideoCallbackRef = (el: HTMLVideoElement | null) => {
    (remoteVideoRef as any).current = el;
    if (el) {
      el.srcObject = remoteStreamRef.current;
      if (remoteStreamRef.current) el.play().catch(() => {});
    }
  };

  useEffect(() => {
    remoteStreamRef.current = remoteStream;
    if (remoteStream) {
      hasRemoteRef.current = true;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream || null;
      if (remoteStream) remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  // Keep micEnabledRef in sync so broadcast handlers (stale closures) can read current value
  useEffect(() => { micEnabledRef.current = micEnabled; }, [micEnabled]);

  // ── Create/reuse an audio RTCPeerConnection for one peer ──
  // Defined at component level (uses stable refs) so toggleMic can call it directly.
  const createAudioPC = (peerId: string): RTCPeerConnection => {
    const existing = audioPCsRef.current.get(peerId);
    if (existing && !['closed', 'failed'].includes(existing.connectionState)) return existing;
    if (existing) existing.close();

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    audioPCsRef.current.set(peerId, pc);

    pc.onicecandidate = ({ candidate }) => {
      if (!candidate) return;
      broadcastRef.current?.ch?.send({
        type: 'broadcast', event: 'audio_ice',
        payload: { from: String(currentUser?.id), to: peerId, candidate: candidate.toJSON() }
      });
    };

    pc.ontrack = ({ streams, track }) => {
      const stream = streams[0] || new MediaStream([track]);
      let el = document.getElementById(`raudio-${peerId}`) as HTMLAudioElement | null;
      if (!el) {
        el = document.createElement('audio');
        el.id = `raudio-${peerId}`;
        el.autoplay = true;
        document.body.appendChild(el);
      }
      el.srcObject = stream;
      el.play().catch(() => {});
    };

    pc.onconnectionstatechange = () => {
      if (['failed', 'closed'].includes(pc.connectionState)) {
        audioPCsRef.current.delete(peerId);
        document.getElementById(`raudio-${peerId}`)?.remove();
      }
    };

    // NOTE: onnegotiationneeded intentionally omitted — all offers are sent explicitly
    // via sendAudioOfferRef to avoid race conditions after setLocalDescription(answer).

    return pc;
  }; // eslint-disable-line

  // ── Debounced hasScreenContent: turns off only after 1.5s gap to avoid flicker ──
  useEffect(() => {
    if (screenSharing || remoteStream) {
      setHasScreenContent(true);
    } else {
      const t = setTimeout(() => setHasScreenContent(false), 1500);
      return () => clearTimeout(t);
    }
  }, [screenSharing, remoteStream]);

  // ── WebRTC signaling channel ──
  useEffect(() => {
    if (!isInRoom || !project?.id || !SURL_CONST || !SERVICE_KEY) return;
    const supa = createClient(SURL_CONST, SERVICE_KEY);
    const ch = supa.channel(`webrtc:${project.id}`, {
      config: { broadcast: { self: false, ack: false } }
    });

    // ── Explicit audio offer (no onnegotiationneeded) ──
    // Defined here so it captures `ch` from this closure.
    const sendAudioOffer = async (peerId: string) => {
      if (!micStreamRef.current) return;
      const existing = audioPCsRef.current.get(peerId);
      let pc: RTCPeerConnection;
      if (existing && !['closed', 'failed'].includes(existing.connectionState)) {
        pc = existing;
      } else {
        if (existing) existing.close();
        pc = createAudioPC(peerId);
      }
      // Add our mic track if not already there
      const hasSender = pc.getSenders().some(s => s.track?.kind === 'audio');
      if (!hasSender) {
        micStreamRef.current.getAudioTracks().forEach(t => pc.addTrack(t, micStreamRef.current!));
      }
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ch.send({ type: 'broadcast', event: 'audio_offer',
          payload: { from: String(currentUser?.id), to: peerId, sdp: offer } });
      } catch { /* ignore */ }
    };
    sendAudioOfferRef.current = sendAudioOffer;

    ch.on('broadcast', { event: 'offer' }, async ({ payload }: any) => {
      if (payload?.to !== String(currentUser?.id)) return;
      if (screenSharingRef.current) return;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerConnectionsRef.current.set(payload.from, pc);

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) ch.send({ type: 'broadcast', event: 'ice',
          payload: { from: String(currentUser?.id), to: payload.from, candidate: candidate.toJSON() } });
      };
      pc.ontrack = (e) => { if (e.streams[0]) setRemoteStream(e.streams[0]); };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setRemoteStream(null);
          hasRemoteRef.current = false;
          requestedFromRef.current = null;
          peerConnectionsRef.current.delete(payload.from);
        }
      };

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        ch.send({ type: 'broadcast', event: 'answer',
          payload: { from: String(currentUser?.id), to: payload.from, sdp: answer } });
      } catch { /* ignore */ }
    })
    .on('broadcast', { event: 'answer' }, async ({ payload }: any) => {
      if (payload?.to !== String(currentUser?.id)) return;
      const pc = peerConnectionsRef.current.get(payload.from);
      if (pc && pc.signalingState !== 'stable') {
        try { await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp)); } catch { /* ignore */ }
      }
    })
    .on('broadcast', { event: 'ice' }, async ({ payload }: any) => {
      if (payload?.to !== String(currentUser?.id)) return;
      const pc = peerConnectionsRef.current.get(payload.from);
      if (pc && payload.candidate) {
        try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch { /* ignore */ }
      }
    })
    .on('broadcast', { event: 'stop' }, ({ payload }: any) => {
      if (payload?.from === String(currentUser?.id)) return;
      const pc = peerConnectionsRef.current.get(payload.from);
      if (pc) { pc.close(); peerConnectionsRef.current.delete(payload.from); }
      hasRemoteRef.current = false;
      requestedFromRef.current = null;
      setRemoteStream(null);
    })
    .on('broadcast', { event: 'request' }, async ({ payload }: any) => {
      if (!screenSharingRef.current || payload?.from === String(currentUser?.id)) return;
      const viewerId = String(payload.from);
      const stream = screenStreamRef.current;
      if (!stream) return;

      const existingPc = peerConnectionsRef.current.get(viewerId);
      if (existingPc) { existingPc.close(); peerConnectionsRef.current.delete(viewerId); }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerConnectionsRef.current.set(viewerId, pc);
      pc.onicecandidate = ({ candidate }) => {
        if (candidate) ch.send({ type: 'broadcast', event: 'ice',
          payload: { from: String(currentUser?.id), to: viewerId, candidate: candidate.toJSON() } });
      };
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ch.send({ type: 'broadcast', event: 'offer',
          payload: { from: String(currentUser?.id), to: viewerId, sdp: offer } });
      } catch { /* ignore */ }
    })
    // ── Mouse control events ──
    .on('broadcast', { event: 'mouse_request' }, ({ payload }: any) => {
      if (!screenSharingRef.current || payload?.from === String(currentUser?.id)) return;
      const requester = appUsers.find((u: any) => String(u.id) === String(payload.from));
      setMouseCtrlPending({ id: String(payload.from), name: requester?.full_name || 'Участник' });
    })
    .on('broadcast', { event: 'mouse_grant' }, ({ payload }: any) => {
      if (payload?.to !== String(currentUser?.id)) return;
      setMouseCtrl('granted');
    })
    .on('broadcast', { event: 'mouse_deny' }, ({ payload }: any) => {
      if (payload?.to !== String(currentUser?.id)) return;
      setMouseCtrl('idle');
    })
    .on('broadcast', { event: 'mouse_revoke' }, () => {
      setMouseCtrl('idle');
      setMouseCtrlPending(null);
      setMouseCtrlGrantedTo(null);
      setRemoteCursor(null);
    })
    .on('broadcast', { event: 'mouse_move' }, ({ payload }: any) => {
      if (!screenSharingRef.current) return;
      setRemoteCursor({ x: payload.x, y: payload.y });
    })
    // ── Audio WebRTC events ──
    .on('broadcast', { event: 'audio_hello' }, ({ payload }: any) => {
      // A participant just joined — if our mic is on, send them an offer
      if (payload?.from === String(currentUser?.id)) return;
      if (!micEnabledRef.current || !micStreamRef.current) return;
      const peerId = String(payload.from);
      sendAudioOffer(peerId);
    })
    .on('broadcast', { event: 'audio_offer' }, async ({ payload }: any) => {
      if (payload?.to !== String(currentUser?.id)) return;
      const peerId = String(payload.from);
      // Close any conflicting PC
      const old = audioPCsRef.current.get(peerId);
      if (old && old.signalingState !== 'stable') { old.close(); audioPCsRef.current.delete(peerId); }
      const pc = createAudioPC(peerId);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        // Include our own audio track in the answer so they can hear us too
        if (micEnabledRef.current && micStreamRef.current) {
          const hasSender = pc.getSenders().some(s => s.track?.kind === 'audio');
          if (!hasSender) {
            micStreamRef.current.getAudioTracks().forEach(t => pc.addTrack(t, micStreamRef.current!));
          }
        }
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        ch.send({ type: 'broadcast', event: 'audio_answer',
          payload: { from: String(currentUser?.id), to: peerId, sdp: answer } });
      } catch { /* ignore */ }
    })
    .on('broadcast', { event: 'audio_answer' }, async ({ payload }: any) => {
      if (payload?.to !== String(currentUser?.id)) return;
      const pc = audioPCsRef.current.get(String(payload.from));
      if (pc && pc.signalingState !== 'stable') {
        try { await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp)); } catch { /* ignore */ }
      }
    })
    .on('broadcast', { event: 'audio_ice' }, async ({ payload }: any) => {
      if (payload?.to !== String(currentUser?.id)) return;
      const pc = audioPCsRef.current.get(String(payload.from));
      if (pc && payload.candidate) {
        try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch { /* ignore */ }
      }
    })
    .on('broadcast', { event: 'audio_stop' }, ({ payload }: any) => {
      if (payload?.from === String(currentUser?.id)) return;
      const peerId = String(payload.from);
      audioPCsRef.current.get(peerId)?.close();
      audioPCsRef.current.delete(peerId);
      document.getElementById(`raudio-${peerId}`)?.remove();
    })
    .subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        broadcastRef.current = { ch, supa };
        // Announce our arrival — participants with mics will send audio offers
        ch.send({ type: 'broadcast', event: 'audio_hello',
          payload: { from: String(currentUser?.id) } });
      }
    });

    return () => {
      sendAudioOfferRef.current = null;
      peerConnectionsRef.current.forEach(pc => pc.close());
      peerConnectionsRef.current.clear();
      setRemoteStream(null);
      // Clean up audio connections and <audio> elements
      audioPCsRef.current.forEach((pc, peerId) => {
        pc.close();
        document.getElementById(`raudio-${peerId}`)?.remove();
      });
      audioPCsRef.current.clear();
      supa.removeChannel(ch);
      broadcastRef.current = null;
    };
  }, [isInRoom, project?.id]); // eslint-disable-line

  // ── Send WebRTC offers to all participants when screen sharing starts/stops ──
  useEffect(() => {
    screenSharingRef.current = screenSharing;

    if (!screenSharing) {
      broadcastRef.current?.ch?.send({ type: 'broadcast', event: 'stop',
        payload: { from: String(currentUser?.id) } });
      peerConnectionsRef.current.forEach(pc => pc.close());
      peerConnectionsRef.current.clear();
      return;
    }

    const ch = broadcastRef.current?.ch;
    const stream = screenStreamRef.current;
    if (!ch || !stream) return;

    const sendOffers = async () => {
      const others = conferenceParticipants.filter(
        (p: any) => String(p.id) !== String(currentUser?.id)
      );
      for (const participant of others) {
        const viewerId = String(participant.id);
        const existing = peerConnectionsRef.current.get(viewerId);
        if (existing) { existing.close(); peerConnectionsRef.current.delete(viewerId); }

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        peerConnectionsRef.current.set(viewerId, pc);
        pc.onicecandidate = ({ candidate }) => {
          if (candidate) ch.send({ type: 'broadcast', event: 'ice',
            payload: { from: String(currentUser?.id), to: viewerId, candidate: candidate.toJSON() } });
        };
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          ch.send({ type: 'broadcast', event: 'offer',
            payload: { from: String(currentUser?.id), to: viewerId, sdp: offer } });
        } catch { /* ignore */ }
      }
    };
    void sendOffers();
  }, [screenSharing]); // eslint-disable-line

  // ── Request screen stream when someone is already sharing on join ──
  // IMPORTANT: never reset requestedFromRef based on presence — heartbeats can briefly drop sharingP
  useEffect(() => {
    if (!isInRoom || screenSharing || !broadcastRef.current?.ch) return;
    const sharingP = conferenceParticipants.find(
      (p: any) => p.screenSharing && String(p.id) !== String(currentUser?.id)
    );
    if (sharingP && !hasRemoteRef.current) {
      const sharerId = String(sharingP.id);
      if (requestedFromRef.current !== sharerId) {
        requestedFromRef.current = sharerId;
        broadcastRef.current.ch.send({ type: 'broadcast', event: 'request',
          payload: { from: String(currentUser?.id) } });
      }
    }
  }, [conferenceParticipants, isInRoom]); // eslint-disable-line

  // NOTE: remote stream is cleared by WebRTC 'stop' event / onconnectionstatechange — NOT by presence,
  // because presence heartbeats can briefly show screenSharing=false and cause a flicker frame.

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  // Close invite menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (inviteMenuRef.current && !inviteMenuRef.current.contains(e.target as Node)) {
        setShowInviteMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSend = async () => {
    if (!chatInput.trim()) return;
    const ok = await onSendMsg(chatInput, "text");
    if (ok !== false) setChatInput("");
  };

  const joinRoom = () => {
    setIsInRoom(true);
    onJoin(false, false);
    const lastMsg = msgs[msgs.length - 1];
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    const recentCallStart = lastMsg && lastMsg.type === 'call_start' && new Date(lastMsg.created_at).getTime() > fiveMinAgo;
    if (!recentCallStart) onSendMsg("📞 Начинается видеовстреча...", "call_start");
  };

  const leaveRoom = async () => {
    setIsInRoom(false);
    setMicEnabled(false);
    micEnabledRef.current = false;
    setScreenSharing(false);
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    // Broadcast audio stop and clean up audio elements
    broadcastRef.current?.ch?.send({ type: 'broadcast', event: 'audio_stop',
      payload: { from: String(currentUser?.id) } });
    audioPCsRef.current.forEach((pc, peerId) => {
      pc.close();
      document.getElementById(`raudio-${peerId}`)?.remove();
    });
    audioPCsRef.current.clear();
    await onLeave();
  };

  const [isTalking, setIsTalking] = useState(false);
  const isTalkingRef = useRef(false);
  const talkTimeoutRef = useRef<any>(null);

  // ── Voice detection (Talking status) ──
  useEffect(() => {
    if (!micEnabled || !micStreamRef.current) {
        if (isTalkingRef.current) {
            setIsTalking(false);
            isTalkingRef.current = false;
            onPresenceUpdate({ micEnabled: false, screenSharing, isTalking: false });
        }
        return;
    }

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(micStreamRef.current);
    const analyzer = audioCtx.createAnalyser();
    analyzer.fftSize = 256;
    source.connect(analyzer);

    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const checkVolume = () => {
      if (!micEnabled) return;
      analyzer.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
      const average = sum / bufferLength;
      const talkingNow = average > 10; // Threshold for talking

      if (talkingNow !== isTalkingRef.current) {
        if (talkingNow) {
          // If started talking
          clearTimeout(talkTimeoutRef.current);
          setIsTalking(true);
          isTalkingRef.current = true;
          onPresenceUpdate({ micEnabled: true, screenSharing, isTalking: true });
        } else {
          // Debounce stopping "talking" status
          clearTimeout(talkTimeoutRef.current);
          talkTimeoutRef.current = setTimeout(() => {
            setIsTalking(false);
            isTalkingRef.current = false;
            onPresenceUpdate({ micEnabled: true, screenSharing, isTalking: false });
          }, 400); 
        }
      }
      requestAnimationFrame(checkVolume);
    };

    checkVolume();

    return () => {
        audioCtx.close();
        clearTimeout(talkTimeoutRef.current);
    };
  }, [micEnabled, screenSharing]); // eslint-disable-line

  const toggleMic = async () => {
    try {
      if (!micEnabled) {
        if (!micStreamRef.current) {
          micStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        }
        micStreamRef.current.getAudioTracks().forEach(t => { t.enabled = true; });
        setMicEnabled(true);
        micEnabledRef.current = true;
        await onPresenceUpdate({ micEnabled: true, screenSharing, isTalking: false });

        // Establish audio connections with every other participant via explicit offer
        if (sendAudioOfferRef.current && broadcastRef.current?.ch) {
          const others = conferenceParticipants.filter(
            (p: any) => String(p.id) !== String(currentUser?.id)
          );
          for (const participant of others) {
            const peerId = String(participant.id);
            sendAudioOfferRef.current(peerId);
          }
        }
      } else {
        micStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = false; });
        setMicEnabled(false);
        micEnabledRef.current = false;
        setIsTalking(false);
        isTalkingRef.current = false;
        await onPresenceUpdate({ micEnabled: false, screenSharing, isTalking: false });
        // Note: audio PCs stay alive — if mic is re-enabled, tracks just need re-enabling
      }
    } catch {
      onSendMsg("Не удалось получить доступ к микрофону. Проверьте разрешения браузера.", "text");
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!screenSharing) {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
          audio: false,
        });
        screenStreamRef.current = stream;
        setScreenSharing(true);
        await onPresenceUpdate({ micEnabled, screenSharing: true });
        stream.getVideoTracks()[0].onended = async () => {
          setScreenSharing(false);
          screenStreamRef.current?.getTracks().forEach(t => t.stop());
          screenStreamRef.current = null;
          await onPresenceUpdate({ micEnabled, screenSharing: false });
        };
      } else {
        screenStreamRef.current?.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
        setScreenSharing(false);
        await onPresenceUpdate({ micEnabled, screenSharing: false });
      }
    } catch {
      onSendMsg("Демонстрация экрана не запущена. Разрешите доступ в браузере.", "text");
    }
  };

  const uploadConferenceFile = async (file: File): Promise<string | null> => {
    if (!SURL || !SERVICE_KEY || !project?.id) return null;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `conference/${project.id}/${Date.now()}_${safeName}`;
    const uploadRes = await fetch(`${SURL}/storage/v1/object/normative-docs/${filePath}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });
    if (!uploadRes.ok) return null;
    const signRes = await fetch(`${SURL}/storage/v1/object/sign/normative-docs/${filePath}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 7 }),
    });
    if (!signRes.ok) return null;
    const signJson = await signRes.json();
    const signedPath = signJson?.signedURL || signJson?.signedUrl;
    if (!signedPath) return null;
    return signedPath.startsWith('http') ? signedPath : `${SURL}/storage/v1${signedPath}`;
  };

  const handleAttachFile = async (evt: any) => {
    const file = evt.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const link = await uploadConferenceFile(file);
      if (!link) { onSendMsg(`Не удалось загрузить файл "${file.name}".`, "text"); return; }
      onSendMsg(`📎 ${file.name}\n${link}`, "text");
    } catch {
      onSendMsg(`Ошибка при отправке файла "${file.name}".`, "text");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Mouse control helpers ──
  const requestMouseControl = () => {
    setMouseCtrl('requesting');
    broadcastRef.current?.ch?.send({
      type: 'broadcast', event: 'mouse_request',
      payload: { from: String(currentUser?.id) }
    });
  };
  const grantMouseControl = () => {
    if (!mouseCtrlPending) return;
    setMouseCtrlGrantedTo(mouseCtrlPending.id);
    broadcastRef.current?.ch?.send({
      type: 'broadcast', event: 'mouse_grant',
      payload: { from: String(currentUser?.id), to: mouseCtrlPending.id }
    });
    setMouseCtrlPending(null);
  };
  const denyMouseControl = () => {
    if (!mouseCtrlPending) return;
    broadcastRef.current?.ch?.send({
      type: 'broadcast', event: 'mouse_deny',
      payload: { from: String(currentUser?.id), to: mouseCtrlPending.id }
    });
    setMouseCtrlPending(null);
  };
  const revokeMouseControl = () => {
    setMouseCtrl('idle');
    setMouseCtrlPending(null);
    setMouseCtrlGrantedTo(null);
    setRemoteCursor(null);
    broadcastRef.current?.ch?.send({
      type: 'broadcast', event: 'mouse_revoke',
      payload: { from: String(currentUser?.id) }
    });
  };
  const handleVideoMouseMove = (e: React.MouseEvent<HTMLVideoElement>) => {
    if (mouseCtrl !== 'granted') return;
    const now = Date.now();
    if (now - lastMouseSendRef.current < 50) return; // 20fps throttle
    lastMouseSendRef.current = now;
    const vid = e.currentTarget;
    const rect = vid.getBoundingClientRect();
    // Account for objectFit:contain letterboxing
    const vidAspect = (vid.videoWidth || rect.width) / (vid.videoHeight || rect.height);
    const boxAspect = rect.width / rect.height;
    let contentW = rect.width, contentH = rect.height, offsetX = 0, offsetY = 0;
    if (vidAspect > boxAspect) {
      contentH = rect.width / vidAspect;
      offsetY = (rect.height - contentH) / 2;
    } else {
      contentW = rect.height * vidAspect;
      offsetX = (rect.width - contentW) / 2;
    }
    const x = (e.clientX - rect.left - offsetX) / contentW;
    const y = (e.clientY - rect.top - offsetY) / contentH;
    if (x < 0 || x > 1 || y < 0 || y > 1) return; // outside actual video content
    broadcastRef.current?.ch?.send({
      type: 'broadcast', event: 'mouse_move',
      payload: { from: String(currentUser?.id), x, y }
    });
  };

  const toggleInvitee = (userId: number) => {
    setSelectedInvitees(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  };

  const sendInvites = async () => {
    const toInvite = appUsers.filter(u => selectedInvitees.has(u.id));
    for (const user of toInvite) {
      await onSendMsg(
        JSON.stringify({ type: 'call_invite', target_user_id: String(user.id), project_name: project?.name }),
        'call_invite'
      );
      // Надёжный broadcast через REST API — без подписки, один HTTP-запрос
      await fetch(`${SURL}/realtime/v1/api/broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{
            topic: `realtime:callnotify:${user.id}`,
            event: 'broadcast',
            payload: {
              type: 'broadcast',
              event: 'call_invite',
              payload: {
                project_id: String(project?.id),
                project_name: project?.name || 'Проект',
                initiator_name: currentUser?.full_name || currentUser?.email || 'Участник',
              },
            },
          }],
        }),
      });
    }
    setSelectedInvitees(new Set());
    setShowInviteMenu(false);
  };

  const getInitials = (name: string) => {
    const parts = name?.split(" ") || [];
    return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : (name || "?")[0].toUpperCase();
  };

  const roleColors: Record<string, string> = { gip: "#F59E0B", lead: "#8B5CF6", engineer: "#10B981" };

  const participantIds = new Set(conferenceParticipants.map((p: any) => String(p.id)));
  const invitableUsers = appUsers.filter(u => u.id !== currentUser?.id && !participantIds.has(String(u.id)));
  const sharingParticipant = conferenceParticipants.find(
    (p: any) => p.screenSharing && String(p.id) !== String(currentUser?.id)
  );

  if (!project) return <div className="empty-state" style={{ padding: 60 }}>Выберите проект</div>;

  return (
    <div
      className="conf-root screen-fade"
      style={{
        display: "flex", flexDirection: "column",
        height: screenShareActive ? "calc(100vh - 60px)" : "calc(100vh - 170px)", minHeight: 540,
        gap: 0, borderRadius: 16, overflow: "hidden",
        border: `1px solid ${C.border}`
      }}
    >
      {/* ===== HEADER ===== */}
      <div className="conf-header" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 20px", flexShrink: 0,
        background: `linear-gradient(135deg, ${C.sidebarBg} 0%, ${C.surface2} 100%)`,
        borderBottom: `1px solid ${C.border}`
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: `linear-gradient(135deg, ${C.accent}, #4f7fd8)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, color: "#fff"
          }}>🏗️</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Совещание проекта</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>{project.name} · {project.code}</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Статус: демонстрация экрана ИЛИ счётчик участников */}
          {isInRoom && (screenSharing || sharingParticipant) ? (
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 12px", borderRadius: 20,
              background: "#3B82F620",
              border: "1px solid #3B82F650",
              fontSize: 12, color: "#3B82F6", fontWeight: 600
            }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#3B82F6", display: "inline-block", animation: "pulse 1.5s infinite" }} />
              🖥️ Демонстрация экрана
            </div>
          ) : (
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 12px", borderRadius: 20,
              background: isInRoom ? "#10B98120" : C.surface2,
              border: `1px solid ${isInRoom ? "#10B98150" : C.border}`,
              fontSize: 12, color: isInRoom ? "#10B981" : C.textMuted, fontWeight: 600
            }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: isInRoom ? "#10B981" : C.textMuted, display: "inline-block" }} />
              {conferenceParticipants.length} в зале
            </div>
          )}

          {isInRoom && (
            <>
              {/* Микрофон */}
              <button onClick={toggleMic} title={micEnabled ? "Выключить микрофон" : "Включить микрофон"} style={{
                width: 38, height: 38, borderRadius: 10, border: "none", cursor: "pointer",
                background: micEnabled ? "#10B98120" : "#EF444420",
                color: micEnabled ? "#10B981" : "#EF4444",
                fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center"
              }}>{micEnabled ? "🎤" : "🔇"}</button>

              {/* Демонстрация */}
              <button onClick={toggleScreenShare} title={screenSharing ? "Остановить демонстрацию" : "Демонстрация экрана"} style={{
                width: 38, height: 38, borderRadius: 10, border: "none", cursor: "pointer",
                background: screenSharing ? "#3B82F620" : C.surface2,
                color: screenSharing ? "#3B82F6" : C.textMuted,
                fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center"
              }}>🖥️</button>

              {/* ── Управление мышью (только для зрителя) ── */}
              {!screenSharing && sharingParticipant && (
                <>
                  {mouseCtrl === 'idle' && (
                    <button onClick={requestMouseControl} title="Запросить управление мышью" style={{
                      height: 38, padding: "0 12px", borderRadius: 10, border: "none", cursor: "pointer",
                      background: C.surface2, color: C.textMuted,
                      fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5
                    }}>🖱 Управление</button>
                  )}
                  {mouseCtrl === 'requesting' && (
                    <div style={{ height: 38, padding: "0 12px", borderRadius: 10, background: "#F59E0B20", color: "#F59E0B", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                      ⏳ Запрос отправлен...
                    </div>
                  )}
                  {mouseCtrl === 'granted' && (
                    <button onClick={revokeMouseControl} title="Отдать управление" style={{
                      height: 38, padding: "0 12px", borderRadius: 10, border: "none", cursor: "pointer",
                      background: "#10B98120", color: "#10B981",
                      fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5
                    }}>🖱 Отдать управление</button>
                  )}
                </>
              )}
              {/* ── Запрос управления (для демонстратора) ── */}
              {screenSharing && mouseCtrlGrantedTo && (
                <button onClick={revokeMouseControl} title="Отозвать управление" style={{
                  height: 38, padding: "0 12px", borderRadius: 10, border: "none", cursor: "pointer",
                  background: "#EF444420", color: "#EF4444",
                  fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5
                }}>🖱 Отозвать</button>
              )}

              {/* ── Пригласить (мульти-выбор) ── */}
              <div style={{ position: "relative" }} ref={inviteMenuRef}>
                <button onClick={() => { setShowInviteMenu(v => !v); setSelectedInvitees(new Set()); }} style={{
                  height: 38, padding: "0 12px", borderRadius: 10, border: "none", cursor: "pointer",
                  background: showInviteMenu ? `${C.accent}25` : C.surface2,
                  color: showInviteMenu ? C.accent : C.textMuted,
                  fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5
                }}>📲 Пригласить</button>

                {showInviteMenu && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 300,
                    background: C.surface, border: `1px solid ${C.border}`,
                    borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
                    minWidth: 240, overflow: "hidden"
                  }}>
                    <div style={{
                      padding: "10px 16px", fontSize: 11, fontWeight: 700,
                      color: C.textMuted, textTransform: "uppercase", letterSpacing: 1,
                      borderBottom: `1px solid ${C.border}`, display: "flex",
                      justifyContent: "space-between", alignItems: "center"
                    }}>
                      <span>Не в зале ({invitableUsers.length})</span>
                      {selectedInvitees.size > 0 && (
                        <span style={{ color: C.accent }}>Выбрано: {selectedInvitees.size}</span>
                      )}
                    </div>

                    <div style={{ maxHeight: 220, overflowY: "auto" }}>
                      {invitableUsers.length === 0 ? (
                        <div style={{ padding: "16px", fontSize: 13, color: C.textMuted, textAlign: "center" }}>
                          Все участники уже в зале
                        </div>
                      ) : invitableUsers.map(u => {
                        const sel = selectedInvitees.has(u.id);
                        return (
                          <div
                            key={u.id}
                            onClick={() => toggleInvitee(u.id)}
                            style={{
                              display: "flex", alignItems: "center", gap: 10,
                              padding: "10px 16px", cursor: "pointer",
                              background: sel ? `${C.accent}15` : "transparent",
                              transition: "background 0.15s"
                            }}
                            onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = C.surface2; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = sel ? `${C.accent}15` : "transparent"; }}
                          >
                            {/* Чекбокс */}
                            <div style={{
                              width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                              border: `2px solid ${sel ? C.accent : C.border}`,
                              background: sel ? C.accent : "transparent",
                              display: "flex", alignItems: "center", justifyContent: "center"
                            }}>
                              {sel && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>✓</span>}
                            </div>
                            {/* Аватар */}
                            <div style={{
                              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                              background: `linear-gradient(135deg, ${roleColors[u.role] || C.accent}, ${roleColors[u.role] || C.accent}90)`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 11, fontWeight: 700, color: "#fff"
                            }}>{getInitials(u.full_name)}</div>
                            <div style={{ flex: 1, overflow: "hidden" }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {u.full_name?.split(" ").slice(0, 2).join(" ")}
                              </div>
                              <div style={{ fontSize: 11, color: C.textMuted }}>
                                {u.position || (u.role === "gip" ? "ГИП" : u.role === "lead" ? "Руководитель" : "Инженер")}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {invitableUsers.length > 0 && (
                      <div style={{ padding: "10px 16px", borderTop: `1px solid ${C.border}` }}>
                        <button
                          onClick={sendInvites}
                          disabled={selectedInvitees.size === 0}
                          style={{
                            width: "100%", padding: "9px", borderRadius: 8, border: "none",
                            background: selectedInvitees.size > 0
                              ? `linear-gradient(135deg, ${C.accent}, #F59E0B)` : C.surface2,
                            color: selectedInvitees.size > 0 ? "#fff" : C.textMuted,
                            fontSize: 13, fontWeight: 700, cursor: selectedInvitees.size > 0 ? "pointer" : "not-allowed",
                            transition: "all 0.2s"
                          }}
                        >
                          {selectedInvitees.size === 0
                            ? "Выберите участников"
                            : `Пригласить ${selectedInvitees.size} чел.`}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Войти / Выйти */}
          <button onClick={isInRoom ? leaveRoom : joinRoom} style={{
            padding: "8px 18px", borderRadius: 10, border: "none", cursor: "pointer",
            background: isInRoom
              ? "linear-gradient(135deg, #EF4444, #DC2626)"
              : "linear-gradient(135deg, #10B981, #059669)",
            color: "#fff", fontSize: 13, fontWeight: 700,
            boxShadow: isInRoom ? "0 4px 12px #EF444440" : "0 4px 12px #10B98140"
          }}>
            {isInRoom ? "📞 Выйти" : "☎️ Войти в зал"}
          </button>
        </div>
      </div>

      {/* ===== ТЕЛО ===== */}
      {/* ── РЕЖИМ ДЕМОНСТРАЦИИ ЭКРАНА (полноэкранный) ── */}
      {hasScreenContent ? (
        <div style={{ flex: 1, position: "relative", background: "#050505", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* Видео на весь экран */}
          {screenSharing && (
            <div style={{ position: "absolute", inset: 0 }}>
              <video
                ref={screenVideoRef}
                autoPlay muted playsInline
                style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
              />
              {remoteCursor && screenVideoRef.current && (() => {
                const vid = screenVideoRef.current!;
                const rect = vid.getBoundingClientRect();
                const vidAspect = (vid.videoWidth || rect.width) / (vid.videoHeight || rect.height);
                const boxAspect = rect.width / rect.height;
                let contentW = rect.width, contentH = rect.height, offsetX = 0, offsetY = 0;
                if (vidAspect > boxAspect) {
                  contentH = rect.width / vidAspect;
                  offsetY = (rect.height - contentH) / 2;
                } else {
                  contentW = rect.height * vidAspect;
                  offsetX = (rect.width - contentW) / 2;
                }
                return (
                  <div style={{
                    position: "absolute",
                    left: offsetX + remoteCursor.x * contentW,
                    top: offsetY + remoteCursor.y * contentH,
                    width: 22, height: 22, borderRadius: "50%",
                    border: "2.5px solid #EF4444",
                    background: "rgba(239,68,68,0.25)",
                    transform: "translate(-50%,-50%)",
                    pointerEvents: "none",
                    zIndex: 20,
                    boxShadow: "0 0 10px #EF444499, 0 0 0 4px rgba(239,68,68,0.1)"
                  }} />
                );
              })()}
            </div>
          )}
          {!screenSharing && !!remoteStream && (
            <div style={{ position: "absolute", inset: 0 }}>
              <video
                ref={remoteVideoCallbackRef}
                autoPlay playsInline
                onMouseMove={handleVideoMouseMove}
                style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", cursor: mouseCtrl === 'granted' ? 'crosshair' : 'default' }}
              />
            </div>
          )}
          {!screenSharing && sharingParticipant && !remoteStream && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: 56 }}>🖥️</span>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>
                {sharingParticipant.full_name?.split(" ").slice(0, 2).join(" ")} запускает демонстрацию...
              </div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Подождите пару секунд</div>
            </div>
          )}

          {/* Подпись внизу по центру */}
          {(screenSharing || (remoteStream && sharingParticipant)) && (
            <div style={{
              position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
              color: "#fff", fontSize: 12, background: "rgba(0,0,0,0.75)",
              padding: "6px 18px", borderRadius: 20, whiteSpace: "nowrap",
              display: "flex", alignItems: "center", gap: 8, pointerEvents: "none"
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: screenSharing ? "#3B82F6" : "#10B981", display: "inline-block", animation: "pulse 1.5s infinite" }} />
              {screenSharing
                ? "Вы демонстрируете экран"
                : `${sharingParticipant?.full_name?.split(" ").slice(0,2).join(" ")} демонстрирует экран`}
            </div>
          )}

          {/* Уведомление запроса управления (для демонстратора) */}
          {screenSharing && mouseCtrlPending && (
            <div style={{
              position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
              background: "rgba(15,15,15,0.92)", border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 14, padding: "14px 20px", zIndex: 50,
              display: "flex", flexDirection: "column", gap: 10, alignItems: "center",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)", minWidth: 280
            }}>
              <div style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>
                🖱 {mouseCtrlPending.name} запрашивает управление
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={grantMouseControl} style={{
                  padding: "7px 18px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: "#10B981", color: "#fff", fontSize: 13, fontWeight: 700
                }}>Разрешить</button>
                <button onClick={denyMouseControl} style={{
                  padding: "7px 18px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 13, fontWeight: 700
                }}>Отклонить</button>
              </div>
            </div>
          )}

          {/* Плавающая панель участников (левый нижний угол) */}
          <div style={{
            position: "absolute", bottom: 16, left: 16,
            display: "flex", gap: 6, alignItems: "center"
          }}>
            {conferenceParticipants.map((p: any) => (
              <div
                key={p.id}
                title={p.full_name}
                className={p.isTalking ? 'avatar-talking' : ''}
                style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: `linear-gradient(135deg, ${roleColors[p.role] || C.accent}, ${roleColors[p.role] || C.accent}90)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, color: "#fff",
                  border: p.isTalking ? "2px solid #10B981" : "2px solid rgba(255,255,255,0.2)",
                  boxShadow: p.isTalking ? "0 0 10px #10B98180" : "none"
                }}
              >
                {getInitials(p.full_name)}
              </div>
            ))}
          </div>

          {/* Кнопка чата (правый нижний угол) */}
          <button
            onClick={() => setShowFloatingChat(v => !v)}
            style={{
              position: "absolute", bottom: 16, right: 16,
              padding: "8px 16px", borderRadius: 20, border: "none", cursor: "pointer",
              background: showFloatingChat ? C.accent : "rgba(255,255,255,0.15)",
              color: "#fff", fontSize: 13, fontWeight: 600, backdropFilter: "blur(8px)",
              display: "flex", alignItems: "center", gap: 6
            }}
          >
            💬 Чат {msgs.filter(m => m.type !== 'call_invite').length > 0 ? `(${msgs.filter(m => m.type !== 'call_invite').length})` : ''}
          </button>

          {/* Плавающая панель чата */}
          {showFloatingChat && (
            <div style={{
              position: "absolute", right: 16, bottom: 60, top: 16,
              width: 320, background: C.surface,
              borderRadius: 14, boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
              display: "flex", flexDirection: "column", overflow: "hidden",
              border: `1px solid ${C.border}`
            }}>
              <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>💬 Обсуждение</span>
                <button onClick={() => setShowFloatingChat(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, fontSize: 18, lineHeight: 1 }}>×</button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
                {msgs.filter(m => m.type !== 'call_invite').length === 0 && (
                  <div style={{ textAlign: "center", color: C.textMuted, fontSize: 12, padding: "20px 0" }}>Нет сообщений</div>
                )}
                {msgs.filter(m => m.type !== 'call_invite').map((m: any) => {
                  const mu = getUserById(m.user_id);
                  const isMe = mu?.id === currentUser?.id;
                  const time = m.created_at ? new Date(m.created_at).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }) : "";
                  const rawText = String(m.text || "");
                  const textLines = rawText.split("\n");
                  const fileUrl = textLines.find((l: string) => l.startsWith("http")) || "";
                  const isFileMsg = textLines[0]?.startsWith("📎 ") && !!fileUrl;
                  return (
                    <div key={m.id} style={{ display: "flex", gap: 8, marginBottom: 12, flexDirection: isMe ? "row-reverse" : "row" }}>
                      <div style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, background: `linear-gradient(135deg, ${roleColors[mu?.role] || C.accent}, ${roleColors[mu?.role] || C.accent}90)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff" }}>{mu ? getInitials(mu.full_name) : "?"}</div>
                      <div style={{ maxWidth: "78%", background: isMe ? `linear-gradient(135deg, ${C.accent}, #F59E0B)` : C.surface2, borderRadius: isMe ? "12px 12px 3px 12px" : "12px 12px 12px 3px", padding: "7px 10px" }}>
                        <div style={{ fontSize: 10, color: isMe ? "#ffffff80" : C.textMuted, marginBottom: 2 }}>{mu?.full_name?.split(" ").slice(0,2).join(" ")} · {time}</div>
                        {isFileMsg ? (
                          <a href={fileUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: isMe ? "#fff" : C.accent, textDecoration: "underline" }}>{textLines[0].replace(/^📎\s*/,"")}</a>
                        ) : (
                          <div style={{ fontSize: 12, color: isMe ? "#fff" : C.textDim, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{rawText}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
              <div style={{ padding: "8px 10px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 6, background: C.surface }}>
                <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={handleAttachFile} />
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && void handleSend()}
                  placeholder="Сообщение..."
                  style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 12, outline: "none" }}
                />
                <button onClick={() => void handleSend()} style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${C.accent}, #F59E0B)`, border: "none", color: "#fff", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>↑</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── ОБЫЧНЫЙ РЕЖИМ (без демонстрации экрана) ── */
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {/* ===== УЧАСТНИКИ (боковая панель) ===== */}
          <div style={{
            width: 220, minWidth: 220, flexShrink: 0,
            background: C.bg, borderRight: `1px solid ${C.border}`,
            display: "flex", flexDirection: "column", overflow: "hidden"
          }}>
            <div style={{
              padding: "12px 16px", fontSize: 10, fontWeight: 700,
              letterSpacing: 1.2, color: C.textMuted, textTransform: "uppercase",
              borderBottom: `1px solid ${C.border}`
            }}>Участники ({conferenceParticipants.length})</div>
            <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
              {conferenceParticipants.length === 0 && (
                <div style={{ padding: "24px 16px", textAlign: "center", color: C.textMuted, fontSize: 12 }}>
                  Зал пуст.<br />Нажмите «Войти в зал»
                </div>
              )}
              {conferenceParticipants.map((p: any) => (
                <div key={p.id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 14px", borderRadius: 8, margin: "0 6px",
                  cursor: "default",
                  background: p.isTalking ? `rgba(16, 185, 129, 0.08)` : "transparent",
                  transition: "all 0.3s ease"
                }}
                onMouseEnter={e => { if(!p.isTalking) e.currentTarget.style.background = C.surface2 }}
                onMouseLeave={e => { if(!p.isTalking) e.currentTarget.style.background = "transparent" }}
                >
                  <div
                    className={p.isTalking ? 'avatar-talking' : ''}
                    style={{
                      width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                      background: `linear-gradient(135deg, ${roleColors[p.role] || C.accent}, ${roleColors[p.role] || C.accent}90)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700, color: "#fff", position: "relative"
                    }}
                  >
                    {getInitials(p.full_name)}
                    <div style={{ position: "absolute", bottom: -1, right: -1, width: 10, height: 10, borderRadius: "50%", background: "#10B981", border: `2px solid ${C.bg}` }} />
                  </div>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: p.isTalking ? "#10B981" : C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.full_name?.split(" ").slice(0, 2).join(" ")}
                    </div>
                    <div style={{ fontSize: 10, color: C.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.position || (p.role === "gip" ? "ГИП" : p.role === "lead" ? "Рук. отдела" : "Инженер")}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 3, flexShrink: 0, fontSize: 13 }}>
                    <span style={{ transform: p.isTalking ? 'scale(1.2)' : 'scale(1)', transition: 'transform 0.2s' }}>
                      {p.micEnabled ? (p.isTalking ? "🎤" : "🎙️") : "🔇"}
                    </span>
                    {p.screenSharing && <span>🖥️</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ===== ОСНОВНАЯ ОБЛАСТЬ (чат/участники) ===== */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: C.bg }}>
            {/* Табы */}
            <div style={{ display: "flex", flexShrink: 0, borderBottom: `1px solid ${C.border}`, padding: "0 16px" }}>
              {(["chat", "participants"] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  padding: "10px 18px", fontSize: 13, fontWeight: 600,
                  color: activeTab === tab ? C.accent : C.textMuted,
                  background: "none", border: "none", cursor: "pointer",
                  borderBottom: activeTab === tab ? `2px solid ${C.accent}` : "2px solid transparent",
                }}>
                  {tab === "chat" ? "💬 Обсуждение" : "👥 Участники"}
                </button>
              ))}
            </div>

            {/* ── ЧАТ ── */}
            {activeTab === "chat" && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <div style={{ flex: 1, overflowY: "auto", padding: "12px 18px" }}>
                  {msgs.filter(m => m.type !== 'call_invite').length === 0 && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: C.textMuted, gap: 10 }}>
                      <span style={{ fontSize: 40 }}>💬</span>
                      <span style={{ fontSize: 13 }}>Начните совещание по проекту</span>
                    </div>
                  )}
                  {msgs.filter(m => m.type !== 'call_invite').map((m: any) => {
                    const mu = getUserById(m.user_id);
                    const isMe = mu?.id === currentUser?.id;
                    const time = m.created_at ? new Date(m.created_at).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }) : "";
                    const rawText = String(m.text || "");
                    const textLines = rawText.split("\n");
                    const fileUrl = textLines.find((l: string) => l.startsWith("http")) || "";
                    const isFileMsg = textLines[0]?.startsWith("📎 ") && !!fileUrl;
                    const fileName = isFileMsg ? textLines[0].replace(/^📎\s*/, "") : "";
                    return (
                      <div key={m.id} style={{ display: "flex", gap: 10, marginBottom: 14, flexDirection: isMe ? "row-reverse" : "row" }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                          background: `linear-gradient(135deg, ${roleColors[mu?.role] || C.accent}, ${roleColors[mu?.role] || C.accent}90)`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 700, color: "#fff"
                        }}>{mu ? getInitials(mu.full_name) : "?"}</div>
                        <div style={{
                          maxWidth: "72%",
                          background: isMe ? `linear-gradient(135deg, ${C.accent}, #F59E0B)` : C.surface2,
                          borderRadius: isMe ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                          padding: "9px 14px"
                        }}>
                          <div style={{ display: "flex", gap: 7, marginBottom: 3, alignItems: "baseline" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: isMe ? "#fff" : C.text }}>
                              {mu?.full_name?.split(" ").slice(0, 2).join(" ") || "Пользователь"}
                            </span>
                            <span style={{ fontSize: 10, color: isMe ? "#ffffff90" : C.textMuted }}>{time}</span>
                          </div>
                          {isFileMsg ? (
                            <div>
                              <div style={{ fontSize: 13, color: isMe ? "#fff" : C.textDim, wordBreak: "break-word" }}>{fileName}</div>
                              <a href={fileUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: isMe ? "#fff" : C.accent, textDecoration: "underline" }}>Открыть файл</a>
                            </div>
                          ) : (
                            <div style={{ fontSize: 13, color: isMe ? "#fff" : C.textDim, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{rawText}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>
                {/* Поле ввода */}
                <div style={{ padding: "10px 16px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 8, alignItems: "center", background: C.surface, flexShrink: 0 }}>
                  <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={handleAttachFile} />
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ width: 36, height: 36, borderRadius: 9, background: C.surface2, border: `1px solid ${C.border}`, color: C.textMuted, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} title="Прикрепить файл">📎</button>
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && void handleSend()}
                    placeholder="Написать сообщение..."
                    style={{ flex: 1, padding: "9px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, outline: "none" }}
                  />
                  <button onClick={() => void handleSend()} style={{ width: 36, height: 36, borderRadius: 9, background: `linear-gradient(135deg, ${C.accent}, #F59E0B)`, border: "none", color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 12px ${C.accent}40` }}>↑</button>
                </div>
              </div>
            )}

            {/* ── УЧАСТНИКИ (вкладка) ── */}
            {activeTab === "participants" && (
              <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
                {conferenceParticipants.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 48, color: C.textMuted }}>
                    <span style={{ fontSize: 42, display: "block", marginBottom: 10 }}>👥</span>
                    Никого нет в зале
                  </div>
                ) : conferenceParticipants.map((p: any) => (
                  <div key={p.id} className="card" style={{
                    padding: "14px 18px", marginBottom: 10, display: "flex", alignItems: "center", gap: 14,
                    border: p.isTalking ? `1px solid #10B981` : `1px solid ${C.border}`,
                    boxShadow: p.isTalking ? `0 0 15px rgba(16, 185, 129, 0.15)` : 'none'
                  }}>
                    <div
                      className={p.isTalking ? 'avatar-talking' : ''}
                      style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${roleColors[p.role] || C.accent}, ${roleColors[p.role] || C.accent}90)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: "#fff", position: "relative" }}
                    >
                      {getInitials(p.full_name)}
                      <div style={{ position: "absolute", bottom: -2, right: -2, width: 12, height: 12, borderRadius: "50%", background: "#10B981", border: `3px solid ${C.surface}` }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: p.isTalking ? "#10B981" : C.text }}>{p.full_name}</div>
                      <div style={{ fontSize: 12, color: C.textMuted }}>{p.position || (p.role === "gip" ? "Главный Инженер Проекта" : p.role === "lead" ? "Руководитель отдела" : "Инженер")}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6, fontSize: 18 }}>
                      <span>{p.micEnabled ? (p.isTalking ? "🎤" : "🎙️") : "🔇"}</span>
                      {p.screenSharing && <span>🖥️</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
