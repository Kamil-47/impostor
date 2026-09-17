import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { usePlayerIdentity } from './usePlayerIdentity';
import { usePreferences } from './usePreferences';
import type { Room, RoundResult, PlayerHand, RoundAbortedPayload } from '@impostor/shared';

export function useRoom(code: string) {
  const socket = useSocket();
  const navigate = useNavigate();
  const { getUuid, saveUuid } = usePlayerIdentity();
  const { nickname, setLastCode } = usePreferences();

  const [room, setRoom] = useState<Room | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [hand, setHand] = useState<PlayerHand | null>(null);
  const [lastResult, setLastResult] = useState<RoundResult | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [kicked, setKicked] = useState(false);
  const [abortMessage, setAbortMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;

    const uuid = getUuid();

    if (!nickname) {
      navigate(`/join/${code}`, { replace: true });
      return;
    }

    socket.emit(
      'room:join',
      { code, nickname, playerUuid: uuid ?? undefined },
      (response) => {
        saveUuid(response.playerUuid);
        setMyPlayerId(response.playerId);
        setLastCode(code);
      },
    );

    return () => {
      socket.emit('room:leave');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, socket, navigate]);

  useEffect(() => {
    function onRoomState(r: Room) {
      setRoom((prev) => {
        if (prev && prev.status !== 'lobby' && r.status === 'lobby') {
          setHand(null);
          setLastResult(null);
        }
        return r;
      });
    }
    function onPrivateHand(h: PlayerHand) {
      setHand(h);
    }
    function onVotingOpen() {
      // room:state z nowym statusem przyjdzie zaraz po tym evencie
    }
    function onResults(result: RoundResult) {
      setLastResult(result);
    }
    function onError(err: { code: string; message: string }) {
      if (err.code === 'KICKED') {
        setKicked(true);
      } else {
        setJoinError(err.message);
      }
    }
    function onRoundAborted(payload: RoundAbortedPayload) {
      setAbortMessage(payload.playerNickname);
    }

    socket.on('room:state', onRoomState);
    socket.on('round:privateHand', onPrivateHand);
    socket.on('round:votingOpen', onVotingOpen);
    socket.on('round:results', onResults);
    socket.on('round:aborted', onRoundAborted);
    socket.on('error', onError);

    return () => {
      socket.off('room:state', onRoomState);
      socket.off('round:privateHand', onPrivateHand);
      socket.off('round:votingOpen', onVotingOpen);
      socket.off('round:results', onResults);
      socket.off('round:aborted', onRoundAborted);
      socket.off('error', onError);
    };
  }, [socket, navigate]);

  const clearAbortMessage = useCallback(() => setAbortMessage(null), []);

  return { room, myPlayerId, hand, lastResult, joinError, kicked, abortMessage, clearAbortMessage };
}
