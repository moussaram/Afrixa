import { useCallback, useEffect, useRef, useState } from 'react';
import AgoraRTC, { type ICameraVideoTrack, type IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';
import type { IAgoraRTCClient, IAgoraRTCRemoteUser } from 'agora-rtc-sdk-ng';
import { supabase } from '@/integrations/supabase/client';

type LiveRole = 'publisher' | 'audience';

export function useAgoraLive(sessionId: string | undefined, role: LiveRole) {
  const videoElementRef = useRef<HTMLDivElement>(null);
  const tracksRef = useRef<(IMicrophoneAudioTrack | ICameraVideoTrack)[]>([]);
  const remoteUsersRef = useRef(new Map<string, IAgoraRTCRemoteUser>());
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [isMicOn, setMicOn] = useState(true);
  const [isCamOn, setCamOn] = useState(true);
  const isMicOnRef = useRef(true);
  const isCamOnRef = useRef(true);

  const requestToken = useCallback(async () => {
    if (!sessionId) throw new Error('Session live manquante');
    const { data, error: tokenError } = await supabase.functions.invoke('get-agora-token', {
      body: { sessionId, role },
    });
    if (tokenError || !data?.token || !data?.appId || !data?.channel || !data?.uid) {
      throw new Error(data?.error || 'Impossible de sécuriser la connexion au live');
    }
    return data as { token: string; appId: string; channel: string; uid: number; expiresIn: number };
  }, [role, sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    let renewTimer: number | undefined;
    const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
    clientRef.current = client;

    const handlePublished = async (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
      try {
        await client.subscribe(user, mediaType);
        remoteUsersRef.current.set(String(user.uid), user);
        if (mediaType === 'video' && videoElementRef.current) user.videoTrack?.play(videoElementRef.current);
        if (mediaType === 'audio') user.audioTrack?.play();
      } catch (subscribeError) {
        console.error('Agora remote track subscription failed', subscribeError);
      }
    };
    const handleUnpublished = (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
      if (mediaType === 'video') user.videoTrack?.stop();
    };
    const handleLeft = (user: IAgoraRTCRemoteUser) => {
      user.videoTrack?.stop();
      user.audioTrack?.stop();
      remoteUsersRef.current.delete(String(user.uid));
      if (role === 'publisher') setViewerCount(remoteUsersRef.current.size);
    };
    client.on('user-published', handlePublished);
    client.on('user-unpublished', handleUnpublished);
    client.on('user-left', handleLeft);
    const handleJoined = (user: IAgoraRTCRemoteUser) => {
      remoteUsersRef.current.set(String(user.uid), user);
      if (role === 'publisher') setViewerCount(remoteUsersRef.current.size);
    };
    client.on('user-joined', handleJoined);

    void (async () => {
      try {
        const credentials = await requestToken();
        if (!active) return;
        await client.setClientRole(role === 'publisher' ? 'host' : 'audience');
        await client.join(credentials.appId, credentials.channel, credentials.token, credentials.uid);
        if (!active) return;
        setConnected(true);
        if (role === 'publisher') {
          const tracks = await AgoraRTC.createMicrophoneAndCameraTracks();
          if (!active) {
            tracks.forEach(track => track.close());
            return;
          }
          tracksRef.current = tracks;
          tracks[1].play(videoElementRef.current ?? undefined);
          await tracks[0].setEnabled(isMicOnRef.current);
          await tracks[1].setEnabled(isCamOnRef.current);
          await client.publish(tracks);
        }
        renewTimer = window.setInterval(async () => {
          try {
            const refreshed = await requestToken();
            await client.renewToken(refreshed.token);
          } catch (renewError) {
            console.error('Agora token renewal failed', renewError);
            setError('La connexion sécurisée au live a expiré. Quittez puis rejoignez le live.');
          }
        }, 50 * 60 * 1000);
      } catch (joinError) {
        console.error('Agora live connection failed', joinError);
        if (active) setError(joinError instanceof Error ? joinError.message : 'Connexion au live impossible');
      }
    })();

    return () => {
      active = false;
      if (renewTimer) window.clearInterval(renewTimer);
      client.off('user-published', handlePublished);
      client.off('user-unpublished', handleUnpublished);
      client.off('user-left', handleLeft);
      client.off('user-joined', handleJoined);
      tracksRef.current.forEach(track => { track.stop(); track.close(); });
      tracksRef.current = [];
      remoteUsersRef.current.clear();
      void client.leave();
      clientRef.current = null;
    };
  }, [requestToken, role, sessionId]);

  const toggleMic = useCallback(async () => {
    const enabled = !isMicOn;
    isMicOnRef.current = enabled;
    const track = tracksRef.current.find(item => item.trackMediaType === 'audio');
    if (track) await track.setEnabled(enabled);
    setMicOn(enabled);
  }, [isMicOn]);

  const toggleCamera = useCallback(async () => {
    const enabled = !isCamOn;
    isCamOnRef.current = enabled;
    const track = tracksRef.current.find(item => item.trackMediaType === 'video');
    if (track) await track.setEnabled(enabled);
    setCamOn(enabled);
  }, [isCamOn]);

  return { videoElementRef, connected, error, viewerCount, isMicOn, isCamOn, toggleMic, toggleCamera };
}
