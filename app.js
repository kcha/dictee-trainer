const statusEl = document.getElementById("status");
const wordEl = document.getElementById("word");
const speakBtn = document.getElementById("speakBtn");
const revealBtn = document.getElementById("revealBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const voiceSelect = document.getElementById("voiceSelect");
const vocabSection = document.getElementById("vocabSection");
const vocabList = document.getElementById("vocabList");

const state = {
  words: [],
  index: 0,
  revealed: false,
  lastSpoken: "",
  voice: null,
  voiceId: "",
  showingList: false,
  started: false,
};

const controls = [speakBtn, revealBtn, prevBtn, nextBtn];

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

function renderVocabList() {
  if (!(vocabList instanceof HTMLOListElement)) {
    return;
  }
  vocabList.innerHTML = "";
  state.words.forEach((word) => {
    const item = document.createElement("li");
    item.textContent = word;
    vocabList.appendChild(item);
  });
}

function setListVisible(visible) {
  state.showingList = visible;
  if (vocabSection) {
    vocabSection.classList.toggle("is-hidden", !visible);
  }
}

function currentWord() {
  return state.words[state.index];
}

function updateProgress() {
  setStatus(`${state.index + 1}/${state.words.length}`);
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

function setSelectedVoice(voice) {
  state.voice = voice || null;
  state.voiceId = voice ? voiceIdFor(voice) : "";
  if (voiceSelect) {
    voiceSelect.value = state.voiceId;
  }
}

function chooseVoice(voices) {
  const currentId = state.voiceId;
  if (currentId) {
    const match = voices.find((voice) => voiceIdFor(voice) === currentId);
    if (match) {
      return match;
    }
  }

  return (
    voices.find((voice) => voice.name === "Amélie" && voice.lang === "fr-CA") ||
    voices.find((voice) => /french/i.test(voice.name)) ||
    voices[0]
  );
}

function syncVoices() {
  if (!(voiceSelect instanceof HTMLSelectElement)) {
    return 0;
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
    setSelectedVoice(null);
    return 0;
  }

  voiceSelect.disabled = false;
  setSelectedVoice(chooseVoice(voices));
  return voices.length;
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

function startWord(placeholder = "Écoutez...", keepListVisible = false, speak = true) {
  if (state.showingList && !keepListVisible) {
    setListVisible(false);
  }
  state.revealed = false;
  setWord(placeholder, true);
  updateProgress();
  if (speak) {
    speakWord(currentWord());
  }
}

function nextWord() {
  if (!state.words.length) {
    return;
  }
  if (state.showingList) {
    setListVisible(false);
    shuffle(state.words);
    renderVocabList();
    state.index = -1;
    setStatus("Restarting with a new shuffle.");
  }
  state.index += 1;
  if (state.index >= state.words.length) {
    // state.index = state.words.length - 1;
    setListVisible(true);
    startWord("🎉", true, false);
    setStatus("Liste terminée. Cliquez 'Mot suivant' pour recommencer.");
    return;
  }
  startWord();
}

function prevWord() {
  if (!state.words.length) {
    return;
  }
  if (state.showingList) {
    setListVisible(false);
  }
  if (state.index > 0) {
    state.index -= 1;
  }
  startWord();
}

function revealWord() {
  state.revealed = true;
  setWord(currentWord(), false);
}

function initControls(enabled) {
  controls.forEach((button) => {
    if (button) {
      button.disabled = !enabled;
    }
  });
}

speakBtn.addEventListener("click", () => {
  const word = state.lastSpoken || currentWord();
  speakWord(word);
});

voiceSelect.addEventListener("change", () => {
  const voices = getAvailableVoices();
  const selected = voices.find((voice) => voiceIdFor(voice) === voiceSelect.value);
  setSelectedVoice(selected);
});

revealBtn.addEventListener("click", () => {
  if (!state.revealed) {
    revealWord();
  }
});

nextBtn.addEventListener("click", () => {
  nextWord();
});

prevBtn.addEventListener("click", () => {
  prevWord();
});

speechSynthesis.addEventListener("voiceschanged", () => {
  const count = syncVoices();
  if (!state.started && count > 0 && state.words.length) {
    state.started = true;
    startWord();
  }
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
    setListVisible(false);
    renderVocabList();
    const voiceCount = syncVoices();
    initControls(true);
    if (voiceCount > 0) {
      state.started = true;
      startWord();
    } else {
      setStatus("Loading voices...");
    }
  } catch (error) {
    setStatus(error.message || "Unable to load words.");
    setWord("--", true);
  }
}

loadWords();
