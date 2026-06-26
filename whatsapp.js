const INVISIBLE_CHARS_RE = /[\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
const AUDIO_FILE_RE = /([^/\\\n]+\.opus)\b/i;
const IGNORED_MEDIA_ONLY_RE = /^<\s*(?:mídia|midia|media)\s+ocult[ao]\s*>$/i;
const IGNORED_FILE_LINE_RE = /^[^\n]+\.(?:jpe?g|png|gif|webp|heic|mp4|mov|avi|mkv|pdf|docx?|xlsx?|pptx?|vcf|sticker|webm)(?:\s*\([^)]*\))?$/i;
const ATTACHMENT_SUFFIX_RE = /\s*\((?:arquivo anexado|file attached|adjunto)\)\s*$/i;

export function cleanInvisible(value) {
  return String(value ?? "").replace(INVISIBLE_CHARS_RE, "").replace(/\r/g, "");
}

function parseStartLine(line) {
  const value = cleanInvisible(line);
  const messagePatterns = [
    /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2})(?::\d{2})?\s*-\s*(.*?):\s*([\s\S]*)$/,
    /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2})(?::\d{2})?\]\s*(.*?):\s*([\s\S]*)$/
  ];

  for (const pattern of messagePatterns) {
    const match = value.match(pattern);
    if (match) {
      return {
        date: match[1],
        time: match[2],
        author: cleanInvisible(match[3]).trim(),
        text: cleanInvisible(match[4]),
        system: false
      };
    }
  }

  const systemPatterns = [
    /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2})(?::\d{2})?\s*-\s*([\s\S]*)$/,
    /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2})(?::\d{2})?\]\s*([\s\S]*)$/
  ];

  for (const pattern of systemPatterns) {
    const match = value.match(pattern);
    if (match) {
      return {
        date: match[1],
        time: match[2],
        author: "Sistema",
        text: cleanInvisible(match[3]),
        system: true
      };
    }
  }

  return null;
}

export function toIso(dateValue, timeValue) {
  const [day, month, rawYear] = String(dateValue).split("/").map(Number);
  const [hour, minute] = String(timeValue).split(":").map(Number);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);
  if ([day, month, year, hour, minute].some(Number.isNaN) || Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

function basename(value) {
  return String(value || "").split(/[\\/]/).pop() || "";
}

function cleanMessageParts(rawText) {
  const textLines = [];
  const audioFiles = [];

  for (const rawLine of cleanInvisible(rawText).split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      if (textLines.length && textLines[textLines.length - 1] !== "") textLines.push("");
      continue;
    }

    if (IGNORED_MEDIA_ONLY_RE.test(line)) continue;

    const audioMatch = line.match(AUDIO_FILE_RE);
    if (audioMatch) {
      audioFiles.push(basename(audioMatch[1]));
      continue;
    }

    const withoutAttachmentSuffix = line.replace(ATTACHMENT_SUFFIX_RE, "").trim();
    if (IGNORED_FILE_LINE_RE.test(withoutAttachmentSuffix)) continue;

    textLines.push(line);
  }

  while (textLines[0] === "") textLines.shift();
  while (textLines[textLines.length - 1] === "") textLines.pop();

  return {
    text: textLines.join("\n").trim(),
    audioFiles: [...new Set(audioFiles)]
  };
}

function simpleHash(value) {
  let hash = 0x811c9dc5;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function assignFingerprints(items) {
  const occurrences = new Map();
  return items.map(item => {
    const payload = item.type === "audio" ? item.audioFile : item.text;
    const base = [item.date, item.time, item.author, item.type, payload].join("|");
    const occurrence = (occurrences.get(base) || 0) + 1;
    occurrences.set(base, occurrence);
    return {
      ...item,
      fingerprint: `${simpleHash(base)}-${occurrence}`
    };
  });
}

export function parseWhatsappTxt(source) {
  const lines = cleanInvisible(source).split("\n");
  const rawMessages = [];
  let current = null;

  function flush() {
    if (!current) return;
    rawMessages.push(current);
    current = null;
  }

  for (const line of lines) {
    const parsed = parseStartLine(line);
    if (parsed) {
      flush();
      current = parsed;
      continue;
    }

    if (current) {
      current.text += `\n${cleanInvisible(line)}`;
    }
  }
  flush();

  const timeline = [];
  let sourceOrder = 0;

  for (const raw of rawMessages) {
    if (raw.system) continue;
    const timestamp = toIso(raw.date, raw.time);
    const parts = cleanMessageParts(raw.text);

    if (parts.text) {
      timeline.push({
        date: raw.date,
        time: raw.time,
        timestamp,
        author: raw.author || "Sem identificação",
        type: "text",
        text: parts.text,
        sourceOrder: sourceOrder += 1
      });
    }

    for (const audioFile of parts.audioFiles) {
      timeline.push({
        date: raw.date,
        time: raw.time,
        timestamp,
        author: raw.author || "Sem identificação",
        type: "audio",
        text: "",
        audioFile,
        transcriptionStatus: "pending",
        sourceOrder: sourceOrder += 1
      });
    }
  }

  return assignFingerprints(timeline);
}

export function inferLeadName(fileName) {
  let value = basename(cleanInvisible(fileName));
  value = value.replace(/\.zip$/i, "");
  value = value.replace(/^Conversa\s+do\s+WhatsApp\s+com\s+/i, "");
  value = value.replace(/\s*\(\d+\)\s*$/i, "");
  value = value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return value || "Atendimento sem nome";
}

export function makeConversationKey(leadName) {
  const normalized = String(leadName || "atendimento")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
  return normalized || `atendimento-${Date.now()}`;
}

export function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "CP";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function normalizeFileName(value) {
  return basename(cleanInvisible(value)).toLowerCase();
}
