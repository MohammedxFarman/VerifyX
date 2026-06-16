import { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, Mic, MicOff, Volume2, Loader2, User, Shield, AlertTriangle, Key } from "lucide-react";

interface ChatMessage {
  role: "user" | "model";
  text: string;
  isAudio?: boolean;
}

export default function BuddyChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "model",
      text: "Hello! I am VerifyX AI Buddy, your digital safety advisor. Pose any questions concerning cyber scams (phishing), reporting routes (like the 1930 helpline), WhatsApp hoaxes, or password security!"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioSupported, setAudioSupported] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Web Speech API interfaces
  const [recognitionObj, setRecognitionObj] = useState<any | null>(null);

  useEffect(() => {
    // Scroll to bottom on new messages
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    // Initialize Web Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-IN"; // Configured for Indian Accent

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInput(transcript);
        }
      };

      recognition.onerror = () => {
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      setRecognitionObj(recognition);
      setAudioSupported(true);
    }
  }, []);

  const handleSend = async (customMessage = input) => {
    if (!customMessage.trim()) return;

    const userMsg: ChatMessage = { role: "user", text: customMessage };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Create body matching Express history endpoint parameters
      const historyPayload = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: customMessage, history: historyPayload })
      });
      const data = await res.json();
      
      const modelMsg: ChatMessage = { role: "model", text: data.reply || "Unable to retrieve support statement." };
      setMessages((prev) => [...prev, modelMsg]);
    } catch (err) {
      console.error(err);
      const errMsg: ChatMessage = { role: "model", text: "Offline Alert: Connected local fallback is loaded. Dial 1930 for regional emergency, or paste links above." };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const startVoiceRecording = () => {
    if (!recognitionObj) return;
    try {
      recognitionObj.start();
    } catch (e) {
      recognitionObj.stop();
    }
  };

  const triggerTextToSpeech = (textToRead: string) => {
    if ('speechSynthesis' in window) {
      // Cancel active voice playbacks
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToRead.replace(/[#*`]/g, ""));
      utterance.lang = "en-IN"; // English with Indian Accent
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden h-[540px] flex flex-col text-left">
      {/* Header bar */}
      <div className="bg-slate-50/50 border-b border-slate-100 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl trust-gradient text-white flex items-center justify-center shadow-sm">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight leading-none">VerifyX AI Support Buddy</h3>
            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-0.5 uppercase tracking-wider">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Always online / Certified Safety Agent
            </span>
          </div>
        </div>

        {audioSupported && (
          <span className="text-[10px] bg-blue-50 text-blue-700 font-bold border border-blue-100 px-2.5 py-1 rounded-full uppercase tracking-wider">
            Voice Sync Enabled
          </span>
        )}
      </div>

      {/* Messages layout */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/40">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex items-start gap-2.5 max-w-[85%] ${
              msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
            }`}
          >
            {/* Avatar */}
            <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-xs flex-shrink-0 ${
              msg.role === "user" 
                ? "bg-slate-150 text-slate-700" 
                : "trust-gradient text-white shadow-sm"
            }`}>
              {msg.role === "user" ? <User className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
            </div>

            {/* Bubble */}
            <div className={`rounded-2xl p-3.5 text-xs md:text-sm leading-relaxed shadow-xs relative group ${
              msg.role === "user"
                ? "trust-gradient text-white rounded-tr-none"
                : "bg-white border border-slate-100 text-slate-800 rounded-tl-none whitespace-pre-wrap"
            }`}>
              <p>{msg.text}</p>
              
              {msg.role === "model" && (
                <button
                  onClick={() => triggerTextToSpeech(msg.text)}
                  className="absolute right-2 bottom-1.5 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600 p-1 bg-white rounded-md border border-slate-100 transition-all hover:shadow-xs"
                  title="Read Aloud"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-2.5 mr-auto max-w-[85%] animate-pulse">
            <div className="h-8 w-8 rounded-xl trust-gradient text-white flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
            <div className="bg-white border border-slate-150 rounded-2xl rounded-tl-none p-3.5 text-xs text-slate-400">
              AI Buddy is researching answers on national crime cells...
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input controls footer */}
      <div className="bg-white border-t border-slate-100 p-3.5 flex items-center gap-2">
        {audioSupported && (
          <button
            id="voice-mic-trigger-btn"
            onClick={startVoiceRecording}
            className={`p-2.5 rounded-xl border transition-all ${
              isRecording 
                ? "bg-red-50 border-red-200 text-red-600 animate-pulse" 
                : "bg-slate-50 border-slate-150 hover:bg-slate-100 text-slate-500"
            }`}
            title={isRecording ? "Listening... Click to stop" : "Speak to input"}
          >
            {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
        )}

        <input
          id="chat-input-textbox"
          type="text"
          className="flex-1 bg-slate-50 border border-slate-150 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={isRecording ? "Listening to voice input..." : "Type your safety concerns..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          disabled={loading}
        />

        <button
          id="chat-send-btn"
          onClick={() => handleSend()}
          disabled={loading || !input.trim()}
          className="trust-gradient hover:opacity-95 disabled:opacity-40 text-white p-2.5 rounded-xl transition-all shadow-md shadow-blue-200/50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
