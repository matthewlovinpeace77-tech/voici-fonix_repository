const $ = (s) => document.querySelector(s);
const chat = $("#chat");
function addMessage(text, kind) { const p = document.createElement("p"); p.className = `bubble ${kind}`; p.textContent = text; chat.append(p); chat.scrollTop = chat.scrollHeight; return p; }
$("#chat-form").addEventListener("submit", async (e) => {
  e.preventDefault(); const input = $("#question"); const message = input.value.trim(); if (!message) return;
  addMessage(message, "student"); input.value = ""; $("#send").disabled = true; $("#mode").textContent = "Thinking…";
  const answer = addMessage("Let me think that through…", "tutor");
  try { const r = await fetch("/api/chat", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({message})}); const d = await r.json(); if (!r.ok) throw new Error(d.detail || "Tutor unavailable."); answer.textContent = d.reply; $("#mode").textContent = d.mode === "gemini" ? "Gemini tutor" : "Demo lessons"; }
  catch (err) { answer.textContent = err.message || "Connection problem. Please try again."; $("#mode").textContent = "Ready"; }
  finally { $("#send").disabled = false; input.focus(); }
});
async function loadLessons() {
  try { const r = await fetch("/api/lessons"); const d = await r.json(); if (!r.ok || !Array.isArray(d.lessons)) throw new Error(); $("#lesson-source").textContent = d.source === "supabase" ? "From Supabase" : "Built-in lessons";
    $("#lessons").replaceChildren(...d.lessons.map((lesson) => { const article = document.createElement("article"); const cat = document.createElement("span"); cat.className="eyebrow"; cat.textContent=lesson.category; const title=document.createElement("h3"); title.textContent=lesson.title; const text=document.createElement("p"); text.textContent=lesson.content; article.append(cat,title,text); return article; }));
  } catch { $("#lessons").textContent = "Lessons are temporarily unavailable."; }
}
loadLessons();
const quizzes = [
  {q:"In treble clef, what note is on the bottom line of the staff?", a:"E", opts:["C","E","G","F"], tip:"Treble clef lines from bottom to top spell E–G–B–D–F."},
  {q:"How many beats does a quarter note usually get in 4/4 time?", a:"1", opts:["1","2","3","4"], tip:"Count one steady pulse for each quarter note in common time."},
  {q:"Which two notes make up an octave?", a:"Same", opts:["Adjacent","Same","Unrelated","Silent"], tip:"An octave arrives at the same note name, higher or lower."},
]; let quizIndex=0, quizAnswered=false;
function renderQuiz(){const x=quizzes[quizIndex]; $("#quiz-title").textContent=quizIndex===0?"Note-reading warm-up":"Music theory warm-up"; $("#quiz-question").textContent=x.q; $("#quiz-options").replaceChildren(...x.opts.map((o)=>{const b=document.createElement("button");b.type="button";b.dataset.answer=o;b.textContent=o;return b;})); $("#quiz-feedback").textContent="Choose an answer to check yourself."; $("#quiz-feedback").className="muted";quizAnswered=false;}
$("#quiz-options").addEventListener("click",(e)=>{const b=e.target.closest("button[data-answer]");if(!b||quizAnswered)return;quizAnswered=true;const x=quizzes[quizIndex],ok=b.dataset.answer===x.a;$("#quiz-feedback").textContent=`${ok?"That's right! ":"Not quite. "}${x.tip}`;$("#quiz-feedback").className=ok?"correct":"incorrect";});
$("#next-quiz").addEventListener("click",()=>{quizIndex=(quizIndex+1)%quizzes.length;renderQuiz();});
const names=["C","C♯","D","D♯","E","F","F♯","G","G♯","A","A♯","B"];let audioContext,stream,analyser,data,frame;
function detectPitch(buf,rate){let rms=0;for(const x of buf)rms+=x*x;rms=Math.sqrt(rms/buf.length);if(rms<.015)return null;let best=-1,corrBest=0;for(let off=Math.floor(rate/1000);off<=Math.min(Math.floor(rate/65),buf.length-1);off++){let corr=0;for(let i=0;i<buf.length-off;i++)corr+=buf[i]*buf[i+off];corr/=buf.length-off;if(corr>corrBest){corrBest=corr;best=off;}}return best<0||corrBest<.01?null:rate/best;}
function updatePitch(){analyser.getFloatTimeDomainData(data);const f=detectPitch(data,audioContext.sampleRate);if(!f){$("#pitch-note").textContent="—";$("#pitch-frequency").textContent="Listening…";$("#meter").style.width="0%";}else{const midi=Math.round(69+12*Math.log2(f/440)),target=440*2**((midi-69)/12),cents=Math.round(1200*Math.log2(f/target));$("#pitch-note").textContent=`${names[(midi%12+12)%12]}${Math.floor(midi/12)-1}`;$("#pitch-frequency").textContent=`${f.toFixed(1)} Hz · ${cents===0?"in tune":`${Math.abs(cents)} cents ${cents<0?"flat":"sharp"}`}`;$("#meter").style.width=`${Math.max(3,Math.min(100,50+cents*1.2))}%`;$("#pitch-hint").textContent=Math.abs(cents)<8?"Nice and centered—hold that note!":cents<0?"A little sharp—try relaxing the pitch down.":"A little flat—try nudging the pitch up.";}frame=requestAnimationFrame(updatePitch);}
$("#mic").addEventListener("click",async(e)=>{const b=e.currentTarget,err=$("#mic-error");if(stream){cancelAnimationFrame(frame);stream.getTracks().forEach(t=>t.stop());stream=null;await audioContext.close();b.textContent="Enable microphone";$("#pitch-note").textContent="—";$("#pitch-frequency").textContent="Start when ready";err.textContent="";return;}if(!navigator.mediaDevices?.getUserMedia){err.textContent="Microphone access requires HTTPS or localhost.";return;}try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});audioContext=new(window.AudioContext||window.webkitAudioContext)();analyser=audioContext.createAnalyser();analyser.fftSize=4096;data=new Float32Array(analyser.fftSize);audioContext.createMediaStreamSource(stream).connect(analyser);err.textContent="";b.textContent="Stop listening";updatePitch();}catch{stream?.getTracks().forEach(t=>t.stop());stream=null;err.textContent="Microphone permission was denied or unavailable.";}});
