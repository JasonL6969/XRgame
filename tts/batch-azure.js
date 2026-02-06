import fs from "fs/promises";
import fetch from "node-fetch";

const key = process.env.SPEECH_KEY;
const region = process.env.SPEECH_REGION;
if (!key || !region) throw new Error("Please set SPEECH_KEY and SPEECH_REGION env vars.");

// 粵語女聲，可改：zh-HK-LokKaiNeural (男)
const voice = "zh-HK-HiuGaaiNeural";
const rate = "+2%";
const pitch = "+0%";

const ssml = (text) => `
<speak version="1.0" xml:lang="zh-HK">
  <voice name="${voice}">
    <prosody rate="${rate}" pitch="${pitch}">${text}</prosody>
  </voice>
</speak>`;

const texts = JSON.parse(await fs.readFile("tts/texts.json", "utf8"));
await fs.mkdir("audio", { recursive: true });

for (const { id, text } of texts) {
  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
    },
    body: ssml(text)
  });
  if (!res.ok) throw new Error(`TTS failed for ${id}: ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(`audio/${id}.mp3`, buf);
  console.log(`✅ ${id}.mp3`);
}
console.log("All done!");
