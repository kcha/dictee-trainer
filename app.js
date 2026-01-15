const statusEl = document.getElementById("status");
const wordEl = document.getElementById("word");
const speakBtn = document.getElementById("speakBtn");
const speakSlowBtn = document.getElementById("speakSlowBtn");
const revealBtn = document.getElementById("revealBtn");
const nextBtn = document.getElementById("nextBtn");
const voiceSelect = document.getElementById("voiceSelect");

const state = {
  words: [],
  index: 0,
  revealed: false,
  lastSpoken: "",
  voice: null,
  voiceId: "",
};

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function setStatus(text) {
  statusEl.textContent = text;
}

function setWord(text, hidden = true) {
  wordEl.textContent = text;
  wordEl.classList.toggle("hidden", hidden);
}

function currentWord() {
  return state.words[state.index];
}

function updateProgress() {
  setStatus(`Mot ${state.index + 1} sur ${state.words.length}`);
}

function pickVoice() {
  syncVoices();
}

function voiceIdFor(voice) {
  return voice.voiceURI || voice.name;
}

function getAvailableVoices() {
  const voices = speechSynthesis.getVoices();
  if (!voices.length) {
    return [];
  }
  const frenchVoices = voices.filter(
    (voice) => voice.lang && voice.lang.toLowerCase().startsWith("fr"),
  );
  return frenchVoices.length ? frenchVoices : voices;
}

function syncVoices() {
  if (!(voiceSelect instanceof HTMLSelectElement)) {
    return;
  }
  const voices = getAvailableVoices();
  voiceSelect.innerHTML = "";

  voices.forEach((voice) => {
    const option = document.createElement("option");
    option.value = voiceIdFor(voice);
    option.textContent = `${voice.name} (${voice.lang || "unknown"})`;
    voiceSelect.appendChild(option);
  });

  if (!voices.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Default voice";
    voiceSelect.appendChild(option);
    voiceSelect.disabled = true;
    state.voice = null;
    state.voiceId = "";
    return;
  }

  voiceSelect.disabled = false;
  const currentId = state.voiceId;
  const match =
    currentId &&
    voices.find((voice) => voiceIdFor(voice) === currentId);

  const nextVoice =
    match ||
    voices.find((voice) => voice.name === "Amélie" && voice.lang === "fr-CA") ||
    voices.find((voice) => /french/i.test(voice.name)) ||
    voices[0];

  state.voice = nextVoice;
  state.voiceId = voiceIdFor(nextVoice);
  voiceSelect.value = state.voiceId;
}

function speakWord(word, rate = 0.45) {
  if (!word) {
    return;
  }
  if (!("speechSynthesis" in window)) {
    setStatus("Speech not supported in this browser.");
    return;
  }

  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = "fr-FR";
  utterance.rate = rate;
  if (state.voice) {
    utterance.voice = state.voice;
  }

  state.lastSpoken = word;
  speechSynthesis.speak(utterance);
}

function startWord(placeholder = "Écoutez...") {
  state.revealed = false;
  setWord(placeholder, true);
  updateProgress();
  speakWord(currentWord());
}

function nextWord() {
  if (!state.words.length) {
    return;
  }
  state.index += 1;
  if (state.index >= state.words.length) {
    shuffle(state.words);
    state.index = -1;
    setStatus("Restarting with a new shuffle.");
    startWord("🎉", false);
    return;
  }
  startWord();
}

function revealWord() {
  state.revealed = true;
  setWord(currentWord(), false);
}

function initControls(enabled) {
  speakBtn.disabled = !enabled;
  revealBtn.disabled = !enabled;
  nextBtn.disabled = !enabled;
}

speakBtn.addEventListener("click", () => {
  const word = state.lastSpoken || currentWord();
  speakWord(word);
});

voiceSelect.addEventListener("change", () => {
  const voices = getAvailableVoices();
  const selected = voices.find((voice) => voiceIdFor(voice) === voiceSelect.value);
  state.voice = selected || null;
  state.voiceId = selected ? voiceIdFor(selected) : "";
});

revealBtn.addEventListener("click", () => {
  if (!state.revealed) {
    revealWord();
  }
});

nextBtn.addEventListener("click", () => {
  nextWord();
});

speechSynthesis.addEventListener("voiceschanged", () => {
  pickVoice();
});

async function loadWords() {
  initControls(false);
  try {
    const response = await fetch("data/vocabulary.txt", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load vocabulary list.");
    }
    const text = await response.text();
    const words = text
      .split(/\r?\n/)
      .map((word) => word.trim())
      .filter(Boolean);
    if (!words.length) {
      throw new Error("Vocabulary list is empty.");
    }

    state.words = shuffle(words.slice());
    state.index = 0;
    pickVoice();
    initControls(true);
    startWord();
  } catch (error) {
    setStatus(error.message || "Unable to load words.");
    setWord("--", true);
  }
}

loadWords();
