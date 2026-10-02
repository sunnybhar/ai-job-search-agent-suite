// ─────────────────────────────────────────────────────────────────
// src/lib/json.js
// One JSON recovery path for every agent that asks a model for JSON.
//
// WHY THIS FILE EXISTS
// safeParseJSON existed in five different versions across seven
// agents, at five different levels of robustness:
//
//   ATS Scanner        three passes, control char escaping, stray
//                      quote repair. The good one.
//   Behavioral Coach   two passes, regex based escaping
//   Startup Email      two passes, regex based escaping
//   Follow Up          two passes, regex based escaping
//   Resume Tailors     three passes, strips control chars first
//   Coffee Chat        one bare JSON.parse, no recovery at all
//
// Coffee Chat is why "Bad control character in string literal in
// JSON at position 5723" reaches the user as a raw V8 message: there
// is nothing between the model and JSON.parse. The others recover
// from the same input.
//
// This promotes the Scanner's version, fixes two defects in it, and
// gives every agent the same behaviour.
//
// WHAT CAUSES THE ERROR
// JSON forbids literal control characters inside string values. A
// raw newline in a long free text field is the usual culprit. The
// model is told not to do this. Over a long enough answer it does it
// anyway, which is exactly why the newer agents moved to delimiter
// output instead of JSON.
// ─────────────────────────────────────────────────────────────────

// Defect fixed here: the original tracked `prev !== "\\"` to decide
// whether a quote was escaped. That misreads a literal backslash
// before a closing quote, so a value ending in a backslash flipped
// the in-string state and corrupted everything after it. Proper
// escape state is tracked instead.
export function escapeControlsInStrings(s) {
  let out = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const code = c.charCodeAt(0);

    if (escaped) {
      out += c;
      escaped = false;
      continue;
    }
    if (c === "\\") {
      out += c;
      escaped = inString;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      out += c;
      continue;
    }
    if (inString) {
      if (c === "\n") out += "\\n";
      else if (c === "\r") out += "\\r";
      else if (c === "\t") out += "\\t";
      // Preserve rather than drop. A dropped character silently
      // changes the user's content, which is worse than an escape
      // that renders as nothing.
      else if (code < 0x20) out += "\\u" + code.toString(16).padStart(4, "0");
      else out += c;
      continue;
    }
    // Outside strings, control characters are just whitespace noise.
    if (code < 0x20 && c !== "\n" && c !== "\r" && c !== "\t") continue;
    out += c;
  }
  return out;
}

// Best effort stray quote repair. Genuinely ambiguous cases (a stray
// quote immediately followed by a comma) are prevented at the prompt
// level by telling the model to use single quotes inside values.
export function fixStrayQuotes(s) {
  let out = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];

    if (escaped) { out += c; escaped = false; continue; }
    if (c === "\\") { out += c; escaped = inString; continue; }

    if (c === '"') {
      if (!inString) { inString = true; out += c; continue; }
      let j = i + 1;
      while (j < s.length && /\s/.test(s[j])) j++;
      const next = s[j] || "";
      if (next === "" || ":}]".includes(next)) { inString = false; out += c; }
      else if (next === ",") {
        let k = j + 1;
        while (k < s.length && /\s/.test(s[k])) k++;
        if (s[k] === '"') { inString = false; out += c; }
        else out += '\\"';
      } else out += '\\"';
      continue;
    }
    out += c;
  }
  return out;
}

// Turns "Bad control character in string literal in JSON at position
// 5723" into something you can act on, by showing the text around
// that position with the offending character marked.
function describeFailure(message, text) {
  const m = /position (\d+)/.exec(message || "");
  if (!m) return message;
  const pos = parseInt(m[1], 10);
  const from = Math.max(0, pos - 90);
  const to = Math.min(text.length, pos + 90);
  const excerpt = text
    .slice(from, to)
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
  return `${message}\n\nAround that position:\n...${excerpt}...`;
}

/**
 * Parse a model response that is supposed to be JSON.
 * Four passes, most conservative first. Throws a readable error with
 * the surrounding text if all of them fail.
 */
export function safeParseJSON(raw) {
  if (!raw || !String(raw).trim()) throw new Error("Empty response from the model.");

  const text = String(raw)
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error(`No JSON object found. Response began: "${text.slice(0, 120)}"`);
  }
  const slice = text.slice(start, end + 1);

  // Pass 1: as sent.
  try { return JSON.parse(slice); } catch {}

  // Pass 2: escape control characters inside strings, drop trailing commas.
  const p2 = escapeControlsInStrings(slice).replace(/,(\s*[}\]])/g, "$1");
  try { return JSON.parse(p2); } catch {}

  // Pass 3: also repair stray quotes.
  const p3 = fixStrayQuotes(p2).replace(/,(\s*[}\]])/g, "$1");
  try { return JSON.parse(p3); } catch {}

  // Pass 4: strip remaining control characters outright. Last resort,
  // because this changes content rather than encoding it.
  // eslint-disable-next-line no-control-regex
  const p4 = p3.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  try { return JSON.parse(p4); } catch (e) {
    throw new Error(
      `The model returned malformed JSON that could not be repaired. ${describeFailure(e.message, p3)}`
    );
  }
}
