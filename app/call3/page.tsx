"use client";

import { useEffect, useRef, useState } from "react";

export default function WebRTCApp() {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);

  useEffect(() => {
    const pcConfig = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        // {
        //     urls: "turn:global.turn.twilio.com:3478",
        //     username:
        //       "f4b4035eaa76f4a55de5f4351567653ee4ff6fa97b50b6b334fcc1be9c27212d",
        //     credential: "w1WpauEsFLlf91PdVRMDFyNMQVX3i7EMCsIYdjsY0fA=",
        //   },
      ],
    };
    const pc = new RTCPeerConnection(pcConfig);

    pc.onicecandidate = (event) => {
      if (event.candidate) console.log(JSON.stringify(event.candidate));
    };

    pc.oniceconnectionstatechange = (event) => {
      console.log(event);
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    const constraints = { audio: false, video: true };

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((stream) => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        pc.addTrack(stream.getTracks()[0], stream);
      })
      .catch((error) => console.error("getUserMedia Error:", error));

    setPeerConnection(pc);

    return () => pc.close();
  }, []);

  const createOffer = async () => {
    console.log("createOffer");
    if (!peerConnection) return;
    const offer = await peerConnection.createOffer({ offerToReceiveVideo: true });
    await peerConnection.setLocalDescription(offer);
    console.log(JSON.stringify(offer));
  };

  const createAnswer = async () => {
    console.log("createAnswer");
    if (!peerConnection) return;
    const answer = await peerConnection.createAnswer({
      offerToReceiveVideo: true,
    });
    await peerConnection.setLocalDescription(answer);
    console.log(JSON.stringify(answer));
  };

  const setRemoteDescription = () => {
    console.log("setRemoteDescription");
    if (!peerConnection || !textRef.current) return;
    const desc = JSON.parse(textRef.current.value);
    peerConnection.setRemoteDescription(new RTCSessionDescription(desc));
  };

  const addCandidate = () => {
    console.log("addCandidate");
    if (!peerConnection || !textRef.current) return;
    const candidate = JSON.parse(textRef.current.value);
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  };

  return (
    <div>
      <video
        ref={localVideoRef}
        autoPlay
        style={{ width: 240, height: 240, margin: 5, backgroundColor: "black" }}
      />
      <video
        ref={remoteVideoRef}
        autoPlay
        style={{ width: 240, height: 240, margin: 5, backgroundColor: "black" }}
      />
      <br />
      <button className="bg-blue-500 text-white px-4 py-2 rounded-md mr-2" onClick={createOffer}>Offer</button>
      <button className="bg-blue-500 text-white px-4 py-2 rounded-md mr-2" onClick={createAnswer}>Answer</button>
      <br />
      <textarea ref={textRef} />
      <br />
      <button className="bg-blue-500 text-white px-4 py-2 rounded-md mr-2" onClick={setRemoteDescription}>Set Remote Desc</button>
      <button className="bg-blue-500 text-white px-4 py-2 rounded-md mr-2" onClick={addCandidate}>Add Candidate</button>
    </div>
  );
}
