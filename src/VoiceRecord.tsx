import React, { useState, useRef, useEffect } from "react";
import { FaMicrophone } from "react-icons/fa";
import Spinner from "./components/Spinner";
// import lamejs from "lamejs";

const VoiceRecorder: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [soapNote, setSoapNote] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationIdRef = useRef<number | null>(null);

  // const drawVisualizer = () => {
  //   const canvas = canvasRef.current;
  //   const canvasCtx = canvas?.getContext("2d");
  //   if (!canvas || !canvasCtx || !analyserRef.current) return;

  //   const bufferLength = analyserRef.current.frequencyBinCount;
  //   const dataArray = new Uint8Array(bufferLength);

  //   const draw = () => {
  //     analyserRef.current?.getByteTimeDomainData(dataArray);

  //     canvasCtx.fillStyle = "#000";
  //     canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

  //     canvasCtx.lineWidth = 2;
  //     canvasCtx.strokeStyle = "#00ff88";

  //     canvasCtx.beginPath();
  //     const sliceWidth = (canvas.width * 1.0) / bufferLength;
  //     let x = 0;

  //     for (let i = 0; i < bufferLength; i++) {
  //       const v = dataArray[i] / 128.0;
  //       const y = (v * canvas.height) / 2;

  //       i === 0 ? canvasCtx.moveTo(x, y) : canvasCtx.lineTo(x, y);
  //       x += sliceWidth;
  //     }

  //     canvasCtx.lineTo(canvas.width, canvas.height / 2);
  //     canvasCtx.stroke();

  //     animationIdRef.current = requestAnimationFrame(draw);
  //   };

  //   draw();
  // };
  const drawVisualizer = () => {
    const canvas = canvasRef.current;
    const canvasCtx = canvas?.getContext("2d");
    if (!canvas || !canvasCtx || !analyserRef.current) return;

    const bufferLength = analyserRef.current.fftSize;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!analyserRef.current) return;

      analyserRef.current.getByteTimeDomainData(dataArray);

      canvasCtx.fillStyle = "rgba(0, 0, 0, 0.2)"; // slight transparency for trailing effect
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = "#00ffcc";
      canvasCtx.shadowColor = "#00ffcc";
      canvasCtx.shadowBlur = 10;

      canvasCtx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          canvasCtx.moveTo(x, y);
        } else {
          canvasCtx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      canvasCtx.lineTo(canvas.width, canvas.height / 2);
      canvasCtx.stroke();

      animationIdRef.current = requestAnimationFrame(draw);
    };

    draw();
  };

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Web Audio setup
    audioContextRef.current = new AudioContext();
    analyserRef.current = audioContextRef.current.createAnalyser();
    sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
    sourceRef.current.connect(analyserRef.current);

    drawVisualizer();

    // MediaRecorder setup
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    audioChunks.current = [];

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.current.push(event.data);
    };

    mediaRecorder.start();
    setIsRecording(true);
    setIsPaused(false);
  };

  const pauseRecording = () => {
    mediaRecorderRef.current?.pause();
    setIsPaused(true);
  };

  const resumeRecording = () => {
    mediaRecorderRef.current?.resume();
    setIsPaused(false);
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current) return;

    // ✅ Set onstop BEFORE stopping the recording
    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(audioChunks.current, { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      setAudioBlob(blob);
    };

    // 🛑 Stop the recorder after setting the event listener
    mediaRecorderRef.current.stop();
    mediaRecorderRef.current.stream
      .getTracks()
      .forEach((track) => track.stop());

    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
    }

    setIsRecording(false);
    setIsPaused(false);

    // 🎧 Clean up audio context
    audioContextRef.current?.close();
    audioContextRef.current = null;
  };
  const uploadAudio = async (blob: Blob) => {
    setLoading(true);
    const formData = new FormData();
    formData.append("file", blob, "recording.wav");

    try {
      const res = await fetch("http://localhost:8000/audio-to-soap", {
        method: "POST",
        body: formData,
        headers: {
          Accept: "application/json",
        },
      });

      console.log("Response status:", res.status);

      const text = await res.text();
      console.log("Raw response text:", text);

      const data = JSON.parse(text);
      console.log("Transcript:", data.transcript);
      console.log("SOAP Note:", data.soap_note);
      // ✅ Set state
      setTranscript(data.transcript);
      setSoapNote(data.soap_note);
      setLoading(false);
    } catch (err) {
      console.error("Upload failed:", err);
    }
  };

  // const convertToMp3 = async (blob: Blob) => {
  //   const arrayBuffer = await blob.arrayBuffer();
  //   const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

  //   const samples = audioBuffer.getChannelData(0); // Mono
  //   const mp3encoder = new lamejs.Mp3Encoder(1, audioBuffer.sampleRate, 128);

  //   const mp3Data = [];
  //   const sampleBlockSize = 1152;

  //   for (let i = 0; i < samples.length; i += sampleBlockSize) {
  //     const sampleChunk = samples.subarray(i, i + sampleBlockSize);
  //     const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
  //     if (mp3buf.length > 0) {
  //       mp3Data.push(mp3buf);
  //     }
  //   }

  //   const endBuf = mp3encoder.flush();
  //   if (endBuf.length > 0) {
  //     mp3Data.push(endBuf);
  //   }

  //   const mp3Blob = new Blob(mp3Data, { type: "audio/mp3" });
  //   const mp3Url = URL.createObjectURL(mp3Blob);
  //   setAudioUrl(mp3Url);
  // };
  useEffect(() => {
    return () => {
      if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
      audioContextRef.current?.close();
    };
  }, []);

  return (
    <div className="p-12 rounded-2xl  bg-white/20 backdrop-blur-md border border-white/30 shadow-xl w-fit mx-auto flex justify-center items-center flex-col">
      <div className="rounded-full bg-gray-200 p-4 border-4 border-gray-400 w-24 h-24 flex items-center justify-center">
        <FaMicrophone size={40} color={isRecording ? "red" : "black"} />
      </div>
      <div>
        {!isRecording && (
          <button
            onClick={startRecording}
            style={{
              margin: "10px",
              padding: "10px 20px",
              backgroundColor: "green",
              color: "white",
            }}
          >
            Start Recording
          </button>
        )}
      </div>
      <div>
        <h2 className="text-xl font-semibold text-center mt-4">
          {isRecording ? "Recording..." : "Click to Record"}
        </h2>
        <p className="text-gray-500 text-center">{isPaused ? "Paused" : ""}</p>
      </div>

      {/* <canvas
        ref={canvasRef}
        width={400}
        height={100}
        style={{ margin: "20px auto", display: "block" }}
      /> */}
      <canvas
        ref={canvasRef}
        width={400}
        height={100}
        style={{
          margin: "20px auto",
          display: "block",
          backgroundColor: "#111",
          borderRadius: "12px",
          border: "1px solid #333",
        }}
      />

      {isRecording && (
        <div>
          {isPaused ? (
            <button
              onClick={resumeRecording}
              style={{
                margin: "10px",
                padding: "10px 20px",
                backgroundColor: "orange",
                color: "white",
              }}
            >
              Resume
            </button>
          ) : (
            <button
              onClick={pauseRecording}
              style={{
                margin: "10px",
                padding: "10px 20px",
                backgroundColor: "orange",
                color: "white",
              }}
            >
              Pause
            </button>
          )}
          <button
            onClick={stopRecording}
            style={{
              margin: "10px",
              padding: "10px 20px",
              backgroundColor: "red",
              color: "white",
            }}
          >
            Finish
          </button>
        </div>
      )}

      {audioUrl && (
        <div style={{ marginTop: "20px" }}>
          <h3>Playback</h3>
          <audio controls src={audioUrl} />
        </div>
      )}
      {audioBlob && (
        <button
          onClick={() => uploadAudio(audioBlob)}
          style={{
            margin: "10px",
            padding: "10px 20px",
            backgroundColor: "green",
            color: "white",
          }}
        >
          Get SOAP
        </button>
      )}

      {loading ? (
        <Spinner />
      ) : (
        <div className="max-w-2xl mx-auto mt-8 p-6 bg-white rounded-2xl shadow-lg space-y-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              📝 Transcript
            </h3>
            <div className="bg-gray-100 p-4 rounded-lg text-gray-700 whitespace-pre-wrap max-h-60 overflow-y-auto border border-gray-200">
              {transcript || "No transcript available."}
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              📄 SOAP Note
            </h3>
            <div className="bg-gray-100 p-4 rounded-lg text-gray-700 whitespace-pre-wrap max-h-60 overflow-y-auto border border-gray-200">
              {soapNote || "No SOAP note generated yet."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceRecorder;
