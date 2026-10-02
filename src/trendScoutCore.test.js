import { runTrendScout, normalizeUrl, parseScan, summarizePerformance, briefToMarkdown } from "./trendScoutCore";

const topicBlock = (title, pillar, traction, fit) => `<<<TOPIC>>>
TITLE: ${title}
PILLAR: ${pillar}
TRACTION: ${traction}
FIT: ${fit}
WHY_NOW: Something happened this week.
SIGNALS: HN front page ;; 3 YouTube explainers
LEADS: query one ;; query two
`;

const SCAN_TEXT = `<<<PULSE>>>
Agents everywhere.
${topicBlock("Low priority", "AI", 3, 3)}${topicBlock("Top priority", "Product Management", 9, 9)}${topicBlock("Middle", "Tech & Industry", 7, 5)}${topicBlock("Career one", "Career & Leadership", 6, 8)}${topicBlock("AI two", "AI", 8, 4)}<<<END>>>`;

const DIVE_TEXT = `<<<PLAN>>>
ANGLE: Operators see this first.
HOOK: Everyone is talking about X. Nobody is talking about Y.
OUTLINE:
- beat one
- beat two
FORMAT: Text post — fastest to ship
CTA: What would you do?
HASHTAGS: #ProductManagement #AI
BEST_TIME: Tue 8am ET
RISK: Could read as hype.
<<<ARTICLES>>>
- Real article || The Verge || https://www.theverge.com/real-article?utm_source=x || Key takeaway
- Invented article || Nowhere || https://made-up.example.com/fake || Should be dropped
<<<VIDEOS>>>
- Real talk || YouTube || https://youtu.be/abc123 || 12 min
<<<END>>>`;

function mockTransport() {
  const calls = [];
  const transport = async (body) => {
    calls.push(JSON.parse(JSON.stringify(body)));
    const isScan = body.system.includes("Each morning");
    if (isScan) {
      return {
        stop_reason: "end_turn",
        content: [{ type: "text", text: SCAN_TEXT }],
        usage: { input_tokens: 100, output_tokens: 50, server_tool_use: { web_search_requests: 4 } },
      };
    }
    // First dive call pauses mid-search; continuation finishes
    const isContinuation = body.messages.length > 1;
    if (!isContinuation) {
      return {
        stop_reason: "pause_turn",
        content: [
          { type: "server_tool_use", id: "s1", name: "web_search", input: { query: "x" } },
          {
            type: "web_search_tool_result",
            tool_use_id: "s1",
            content: [
              { type: "web_search_result", url: "https://theverge.com/real-article", title: "Real" },
              { type: "web_search_result", url: "https://www.youtube.com/watch?v=abc123", title: "Talk" },
            ],
          },
        ],
        usage: { input_tokens: 10, output_tokens: 5, server_tool_use: { web_search_requests: 1 } },
      };
    }
    return { stop_reason: "end_turn", content: [{ type: "text", text: DIVE_TEXT }], usage: { input_tokens: 10, output_tokens: 5 } };
  };
  return { transport, calls };
}

test("ranks by traction x fit, resumes pause_turn, and drops unverified links", async () => {
  const { transport, calls } = mockTransport();
  const brief = await runTrendScout({ transport, date: "2026-10-01" });

  expect(brief.topics.map((t) => t.title)).toEqual(["Top priority", "Career one", "AI two", "Middle", "Low priority"]);
  expect(brief.topics[0].priority).toBe(9);

  const t = brief.topics[0];
  expect(t.hook).toMatch(/Nobody is talking about Y/);
  expect(t.outline).toEqual(["beat one", "beat two"]);
  expect(t.hashtags).toEqual(["#ProductManagement", "#AI"]);
  expect(t.articles.map((a) => a.title)).toEqual(["Real article"]);
  expect(t.articles[0].verified).toBe(true);
  expect(t.videos.map((v) => v.title)).toEqual(["Real talk"]);
  expect(t.dropped).toBe(1);

  // 1 scan + 5 dives × 2 calls (pause + resume)
  expect(calls).toHaveLength(11);
  const resume = calls.find((c) => c.messages.length > 1);
  expect(resume.messages[1].role).toBe("assistant");
  expect(resume.fallbacks).toBe("default");
  expect(resume.tools[0].type).toBe("web_search_20260209");

  expect(brief.stats.searches).toBe(4 + 5);
  expect(briefToMarkdown(brief)).toContain("## 1. Top priority");
});

test("normalizeUrl unifies YouTube shapes and strips tracking", () => {
  expect(normalizeUrl("https://youtu.be/abc123")).toBe("youtube:abc123");
  expect(normalizeUrl("https://m.youtube.com/watch?v=abc123&t=30")).toBe("youtube:abc123");
  expect(normalizeUrl("https://www.example.com/a/?utm_source=li&id=2")).toBe("example.com/a?id=2");
  expect(normalizeUrl("javascript:alert(1)")).toBeNull();
});

test("parseScan rejects malformed output", () => {
  expect(() => parseScan("nothing useful")).toThrow(/unexpected format/);
});

test("summarizePerformance ranks pillars by followers per post", () => {
  const s = summarizePerformance([
    { title: "A", pillar: "AI", followers: 2, impressions: 500 },
    { title: "B", pillar: "Product Management", followers: 20, impressions: 3000 },
  ]);
  expect(s.split("\n")[0]).toMatch(/^- Product Management/);
  expect(s).toContain('Best single post so far: "B"');
});
