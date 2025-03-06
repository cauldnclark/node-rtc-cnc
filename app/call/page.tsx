'use client';

import React, { useState, useEffect, useRef } from 'react';
import styles from './rtc.module.css';

export default function RTC() {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [offerSDP, setOfferSDP] = useState<string>('');
  const [answerSDP, setAnswerSDP] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<string>('Disconnected');
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [iceCandidates, setIceCandidates] = useState<string>('');
  const [gatheredCandidates, setGatheredCandidates] = useState<string>('');

  // Initialize WebRTC when component mounts
  useEffect(() => {
    // Start with getting user media
    startVideo();
    
    // Cleanup on component unmount
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (peerConnection) {
        peerConnection.close();
      }
    };
  });

  // Configure local video stream when it's available
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Configure remote video stream when it's available
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Initialize local video stream
  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      setConnectionStatus('Camera and microphone access granted');
    } catch (error) {
      console.error('Error accessing media devices:', error);
      setConnectionStatus('Failed to access camera or microphone');
    }
  };

  // Initialize WebRTC peer connection
  const initializePeerConnection = () => {
    // Configure ICE servers (STUN servers)
    const configuration = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
      ]
    };

    const pc = new RTCPeerConnection(configuration);
    
    // Add local stream tracks to peer connection
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    // Create a new MediaStream for the remote tracks
    const remoteMediaStream = new MediaStream();
    setRemoteStream(remoteMediaStream);
    const iceCandidates: RTCIceCandidate[] = [];
    // Handle ICE candidate events
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('ICE candidate:', JSON.stringify(event.candidate));
        iceCandidates.push(event.candidate);
      } else {
        console.log('ICE gathering complete');
        setGatheredCandidates(JSON.stringify(iceCandidates));
      }
    };

    console.log("iceCandidates1",JSON.stringify({iceCandidates: iceCandidates}));

    // Log connection state changes
    pc.onconnectionstatechange = () => {
      setConnectionStatus(`Connection state: ${pc.connectionState}`);
      console.log('Connection state change:', pc.connectionState);
    };

    // Handle ICE connection state changes
    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
    };

    // Handle remote tracks
    pc.ontrack = (event) => {
      console.log('Remote track received:', event.track);
      event.streams[0].getTracks().forEach(track => {
        remoteMediaStream.addTrack(track);
      });
    };

    setPeerConnection(pc);
    return pc;
  };

  // Create offer (initiator)
  const createOffer = async () => {
    try {
      const pc = peerConnection || initializePeerConnection();
      
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      // Wait for ICE gathering to complete
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
        } else {
          const checkState = () => {
            if (pc.iceGatheringState === 'complete') {
              pc.removeEventListener('icegatheringstatechange', checkState);
              resolve();
            }
          };
          pc.addEventListener('icegatheringstatechange', checkState);
        }
      });
      
      // Get the final SDP with ICE candidates
      const finalOffer = pc.localDescription;
      setOfferSDP(JSON.stringify(finalOffer));
      setConnectionStatus('Offer created, share it with the other person');
      
    } catch (error) {
      console.error('Error creating offer:', error);
      setConnectionStatus('Failed to create offer');
    }
  };

  // Accept an offer (receiver)
  const acceptOffer = async () => {
    try {
      if (!offerSDP) {
        setConnectionStatus('Please paste an offer first');
        return;
      }
      
      const pc = peerConnection || initializePeerConnection();
      const offer = JSON.parse(offerSDP);
      
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      // Wait for ICE gathering to complete
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
        } else {
          const checkState = () => {
            if (pc.iceGatheringState === 'complete') {
              pc.removeEventListener('icegatheringstatechange', checkState);
              resolve();
            }
          };
          pc.addEventListener('icegatheringstatechange', checkState);
        }
      });
      
      // Get the final answer with ICE candidates
      const finalAnswer = pc.localDescription;
      setAnswerSDP(JSON.stringify(finalAnswer));
      setConnectionStatus('Answer created, share it with the caller');
      
    } catch (error) {
      console.error('Error accepting offer:', error);
      setConnectionStatus('Failed to accept offer');
    }
  };

  // Accept an answer (initiator)
  const acceptAnswer = async () => {
    try {
      if (!answerSDP) {
        setConnectionStatus('Please paste an answer first');
        return;
      }
      
      if (!peerConnection) {
        setConnectionStatus('No active connection, create an offer first');
        return;
      }
      
      const answer = JSON.parse(answerSDP);
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      setConnectionStatus('Answer accepted, establishing connection...');
      
    } catch (error) {
      console.error('Error accepting answer:', error);
      setConnectionStatus('Failed to accept answer');
    }
  };

  const addIceCandidates = async () => {
    acceptAnswer();

    if (!iceCandidates) {
      setConnectionStatus('Please paste ice candidates first');
      return;
    }

    const candidates = JSON.parse(iceCandidates);
    // candidates.forEach((candidate: RTCIceCandidate) => {
      peerConnection?.addIceCandidate(new RTCIceCandidate(candidates));
    // });

    
  };

  return (
    <div className={styles.container}>
      <h1>WebRTC Video Call</h1>
      
      <div className={styles.statusBar}>
        <p>Status: {connectionStatus}</p>
      </div>
      
      <div className={styles.videoContainer}>
        <div className={styles.videoWrapper}>
          <h2>Local Video</h2>
          <video 
            ref={localVideoRef} 
            autoPlay 
            playsInline 
            muted 
            className={styles.videoElement}
          />
        </div>
        
        <div className={styles.videoWrapper}>
          <h2>Remote Video</h2>
          <video 
            ref={remoteVideoRef} 
            autoPlay 
            playsInline 
            className={styles.videoElement}
          />
        </div>
      </div>
      
      <div className={styles.controls}>
        <div className={styles.buttonGroup}>
          <button onClick={createOffer} className={styles.button}>
            Create Offer
          </button>
          <button onClick={acceptOffer} className={styles.button}>
            Accept Offer
          </button>
          <button onClick={acceptAnswer} className={styles.button}>
            Accept Answer
          </button>
          <button onClick={addIceCandidates} className={styles.button}>
            Add ICE Candidates
          </button>
        </div>
      </div>
      
      <div className={styles.sdpContainer}>
        <div className={styles.sdpBox}>
          <h3>Offer SDP</h3>
          <textarea
            value={offerSDP}
            onChange={(e) => setOfferSDP(e.target.value)}
            placeholder="Paste offer SDP here to accept it, or generate one with 'Create Offer'"
            className={styles.sdpTextarea}
          />
        </div>
        
        <div className={styles.sdpBox}>
          <h3>Answer SDP</h3>
          <textarea
            value={answerSDP}
            onChange={(e) => setAnswerSDP(e.target.value)}
            placeholder="Paste answer SDP here to accept it, or generate one with 'Accept Offer'"
            className={styles.sdpTextarea}
          />
        </div>

        {/* add iceCandidates */}
        <div className={styles.sdpBox}>
          <h3>ICE Candidates</h3>
          <textarea
            value={iceCandidates}
            onChange={(e) => setIceCandidates(e.target.value)}
            placeholder="Paste ice candidates here"
            className={styles.sdpTextarea}
          />
        </div>

        {/* list of gathered candidates */}
        <div className={styles.sdpBox}>
          <h3>Gathered Candidates</h3>
          <textarea
            value={gatheredCandidates}
            className={styles.sdpTextarea}
          />
        </div>
      </div>
    </div>
  );
}