import { createFileRoute } from "@tanstack/react-router";
import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { ChatGroupBlock, ToolAccordion, type ChatMessageData, type ChatGroup, type ToolStepData } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { chatWithOllama, chatWithOllamaStream, OLLAMA_MODELS, type OllamaMessage } from "@/lib/ollama-stream";
import { executeAllTools, reflect, summarize, type ToolResult } from "@/lib/tools-client";
import { Loader2, Command } from "lucide-react";

export const Route = createFileRoute("/")({
  component: ChatPage,
});

const TOOL_CATALOG = [
  "search(query): broad semantic retrieval from regulatory knowledge base",
  "lookup(keyword): focused retrieval for exact policy terms",
  "reflect(result): quality-check each tool output for query fit",
  "summarize(results): final evidence digest before response synthesis",
].join("\n");

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickRandom<T>(options: T[]) {
  return options[Math.floor(Math.random() * options.length)];
}

function pickRandomDifferent(options: string[], previous: string) {
  if (options.length <= 1) return options[0] ?? "";
  let next = pickRandom(options);
  while (next === previous) {
    next = pickRandom(options);
  }
  return next;
}

function trimQuery(text: string) {
  const value = text.trim();
  return value.length <= 54 ? value : `${value.slice(0, 54)}...`;
}

function summarizeForThinking(text: string) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "No matching evidence yet.";

  const compact = cleaned
    .replace(/\[[^\]]+\]/g, "")
    .replace(/[\n\r]+/g, " ")
    .replace(/\s+/g, " ");

  const snippets = compact
    .split("→")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => (item.length > 110 ? `${item.slice(0, 110)}...` : item));

  if (snippets.length === 0) {
    return compact.length > 120 ? `${compact.slice(0, 120)}...` : compact;
  }

  return snippets.join(" | ");
}

function dedupeToolResults(results: ToolResult[]) {
  const map = new Map<string, ToolResult>();
  for (const result of results) {
    const key = `${result.toolName}|${result.output}`;
    if (!map.has(key)) {
      map.set(key, result);
    }
  }
  return Array.from(map.values());
}

function summarizeEvidence(results: ToolResult[]) {
  return dedupeToolResults(results)
    .slice(0, 6)
    .map((item) => `[${item.toolName}] ${summarizeForThinking(item.output)}`)
    .join("\n");
}

function parseReflectionFocus(text: string) {
  const normalized = text.trim();
  if (!normalized) return null;

  if (/\bstop\b/i.test(normalized) || /\benough\b/i.test(normalized)) {
    return null;
  }

  const firstLine = normalized
    .split("\n")
    .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
    .find(Boolean);

  if (!firstLine) return null;
  return firstLine.length > 70 ? `${firstLine.slice(0, 70)}...` : firstLine;
}

function parseToolDecision(text: string) {
  const cleaned = text.trim();
  const isTool = /^tool\s*:/i.test(cleaned);
  const thought = cleaned
    .replace(/^(tool|direct)\s*:/i, "")
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  return {
    useTools: isTool,
    thought: thought || (isTool ? "I should gather evidence before answering." : "A direct conversational reply is enough."),
  };
}

function isCasualMessage(text: string) {
  const query = text.trim();
  return /^(hi|hello|hey|yo|sup|thanks|thank you|ok|okay)[!.\s]*$/i.test(query)
    || /\bhow are you\b/i.test(query);
}

function detectPreferredLanguage(text: string) {
  if (/\b(hindi|hinglish|tamil|telugu|kannada|malayalam|marathi|bengali)\b/i.test(text)) {
    return "the same language the user used";
  }
  return "English";
}

function latestReasoningLine(thinking: string) {
  return thinking
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1) ?? "Thinking through the response...";
}

function sanitizeAssistantOutput(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  const rigidPattern = /(cannot assist with this request|current capabilities are limited|cannot generate creative content)/i;
  if (!rigidPattern.test(trimmed)) {
    return trimmed;
  }

  return "Hey! I am doing well — happy to help. Tell me what you want to explore and I will get you a clear answer.";
}

function buildSystemPrompt({
  preferredLanguage,
  contextInfo,
  forceToolGrounding,
}: {
  preferredLanguage: string;
  contextInfo: string;
  forceToolGrounding: boolean;
}) {
  const base = [
    "You are Cognizant Agent, a precise and friendly assistant for both casual chat and compliance tasks.",
    `Respond in ${preferredLanguage}.`,
    "Be concise for casual chat. Be structured for policy questions.",
    "Do not use refusal-style boilerplate for normal user prompts.",
    "Do not mention internal routing, tool names, retrieval steps, or hidden reasoning.",
    "Available helper tools in this system:",
    TOOL_CATALOG,
    "Tools are optional and only used when they improve factual accuracy.",
  ].join("\n");

  if (!contextInfo) {
    return forceToolGrounding
      ? `${base}\n\nWhen evidence is unavailable, never expose internal fallback or retrieval status. Ask one concise clarification question only if needed.`
      : `${base}\n\nIf no retrieval evidence is provided, answer from general knowledge and keep uncertainty explicit.`;
  }

  return `${base}\n\nRetrieved evidence (internal grounding):\n${contextInfo}\n\nUse this evidence to improve factual accuracy.`;
}

function shouldUseTools(text: string) {
  const query = text.trim();
  if (!query) return false;

  const tooShort = query.length < 12;
  const greetingOnly = /^(hi|hello|hey|yo|sup|thanks|thank you|ok|okay)[!.\s]*$/i.test(query)
    || /\bhow are you\b/i.test(query);
  const policyIntent = /(rbi|regulation|guideline|rule|compliance|loan|lending|fldg|kfs|apr|cooling|grievance|recovery|interest|consent|timeline|penalty|india)/i.test(query);
  const questionLike = /\?|what|how|why|when|which|can|is|are|should/i.test(query);

  if (greetingOnly) return false;
  if (tooShort && !policyIntent) return false;
  return policyIntent || questionLike;
}

function isTaskQuery(text: string) {
  const query = text.toLowerCase();
  return /(explain|compare|analyze|check|verify|summarize|list|find|show|calculate|derive|evaluate|review|draft|prepare|give me|help me)/i.test(query);
}

function extractPlannedTools(text: string) {
  const allowed = ["search", "lookup"];
  const lower = text.toLowerCase();
  const matched = allowed.filter((tool) => lower.includes(tool));
  return matched.length > 0 ? matched : ["search"];
}

function groupMessages(messages: ChatMessageData[]): ChatGroup[] {
  const groups: ChatGroup[] = [];
  let i = 0;
  while (i < messages.length) {
    if (messages[i].role === "user") {
      const group: ChatGroup = {
        id: messages[i].id,
        userMessage: messages[i],
      };
      if (i + 1 < messages.length && messages[i + 1].role === "assistant") {
        group.assistantMessage = messages[i + 1];
        i += 2;
      } else {
        i += 1;
      }
      groups.push(group);
    } else {
      groups.push({
        id: messages[i].id,
        userMessage: { id: messages[i].id + "-empty", role: "user", content: "", timestamp: "" },
        assistantMessage: messages[i],
      });
      i += 1;
    }
  }
  return groups;
}

function ChatPage() {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [activeTools, setActiveTools] = useState<ToolStepData[]>([]);
  const [reflectionSteps, setReflectionSteps] = useState<ToolStepData[]>([]);
  const [reasoningSteps, setReasoningSteps] = useState<ToolStepData[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [cursorThinking, setCursorThinking] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastPlanningLine = useRef("");
  const lastToolLine = useRef("");
  const lastSynthesisLine = useRef("");
  const isWarmRef = useRef(false);

  const groups = useMemo(() => groupMessages(messages), [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking, cursorThinking]);

  useEffect(() => {
    if (isWarmRef.current) return;
    isWarmRef.current = true;

    void (async () => {
      try {
        await chatWithOllama(
          [
            {
              role: "system",
              content: "Warmup ping. Reply with OK.",
            },
            {
              role: "user",
              content: "OK",
            },
          ],
          OLLAMA_MODELS.reasoning,
        );
      } catch {
        // ignore warmup failures
      }
    })();
  }, []);

  const handleSend = useCallback(async (text: string) => {
    const query = trimQuery(text);

    const planningLines = [
      `Checking policy corpus for: "${query}"`,
      `Scanning guidance notes linked to "${query}"`,
      `Mapping your question to relevant RBI clauses`,
      `Finding exact rule text before answering`,
    ];

    const toolRunLines = [
      (toolName: string) => `Running ${toolName} to fetch direct evidence...`,
      (toolName: string) => `Evaluating ${toolName} results for grounded context...`,
      (toolName: string) => `Pulling citation snippets from ${toolName}...`,
      (toolName: string) => `Cross-checking ${toolName} output with your question...`,
    ];

    const synthesisLines: Array<(count: number) => string> = [
      (count: number) => `Synthesizing ${count} tool result${count > 1 ? "s" : ""} into one clear response...`,
      (count: number) => `Drafting answer from ${count} evidence block${count > 1 ? "s" : ""}...`,
      (_count: number) => "Finalizing structured response with cited points...",
      (_count: number) => "Preparing concise answer and compliance notes...",
    ];

    const userMsg: ChatMessageData = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsThinking(true);
    setActiveTools([]);
    setReflectionSteps([]);
    setReasoningSteps([]);
    setStreamingContent("");
    setCursorThinking("");

    try {
      const casualMessage = isCasualMessage(text);
      const responseModel = OLLAMA_MODELS.reasoning;
      const preferredLanguage = detectPreferredLanguage(text);

      if (casualMessage) {
        const directHistory: OllamaMessage[] = [
          {
            role: "system",
            content: `You are Cognizant Agent. Reply in ${preferredLanguage}. Keep it friendly, natural, and very short. Never say you are limited to a specific task. Do not mention tools, retrieval, evidence, or internal process.`,
          },
          {
            role: "user",
            content: text,
          },
        ];

        setCursorThinking("Preparing response...");

        let fullContent = "";
        for await (const chunk of chatWithOllamaStream(directHistory, OLLAMA_MODELS.reasoning)) {
          fullContent = chunk.content;
          setStreamingContent(fullContent);
        }

        const assistantMsg: ChatMessageData = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: sanitizeAssistantOutput(fullContent),
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setStreamingContent("");
        return;
      }

      const heuristicToolNeed = shouldUseTools(text);
      const taskLikeQuery = isTaskQuery(text);
      let useTools = false;
      let decisionThought = "A direct conversational reply is enough.";

      if (!casualMessage) {
        const decisionHistory: OllamaMessage[] = [
          {
            role: "system",
            content:
              "You are an intent router. Decide if the assistant should call retrieval tools or answer directly. Reply in exactly one line starting with TOOL: or DIRECT:, then a short thought. Choose DIRECT for greetings/chitchat. Choose TOOL for factual/regulatory questions.",
          },
          {
            role: "user",
            content: text,
          },
        ];

        const decisionText = await chatWithOllama(decisionHistory, OLLAMA_MODELS.fast);
        const decision = parseToolDecision(decisionText);
        useTools = heuristicToolNeed || taskLikeQuery;
        decisionThought = decision.thought;
      }

      if (!casualMessage && (heuristicToolNeed || taskLikeQuery)) {
        useTools = true;
      }

      const nextPlanning = pickRandomDifferent(planningLines, lastPlanningLine.current);
      lastPlanningLine.current = nextPlanning;
      setCursorThinking(useTools ? nextPlanning : decisionThought);
      await sleep(280 + Math.round(Math.random() * 320));

      let collectedResults: ToolResult[] = [];
      let currentToolSteps: ToolStepData[] = [];
      let currentThinkingSteps: ToolStepData[] = [];
      let currentReasoningSteps: ToolStepData[] = [];

      const addThinkingStep = (step: ToolStepData) => {
        currentThinkingSteps = [...currentThinkingSteps, step];
        setReflectionSteps((prev) => [...prev, step]);
      };

      if (useTools) {
        const plannerHistory: OllamaMessage[] = [
          {
            role: "system",
            content:
              "You are a planning assistant. Decide which tools to run before answering. Available tools: search, lookup. Return only a comma-separated list using these tool names. If unsure, return search.",
          },
          {
            role: "user",
            content: `Question: ${text}`,
          },
        ];

        const planText = await chatWithOllama(plannerHistory);
        const plannedTools = extractPlannedTools(planText);
        setCursorThinking("Gathering the most relevant rules before responding...");
        await sleep(180 + Math.round(Math.random() * 220));

        const maxReflectionRounds = 3;

        for (let round = 1; round <= maxReflectionRounds; round++) {
          const evidenceSummary = summarizeEvidence(collectedResults);
          const reflectionHistory: OllamaMessage[] = [
            {
              role: "system",
              content:
                "You are a retrieval reflection agent. Propose ONE short next focus phrase to improve factual coverage for the user question. If evidence is already sufficient, return STOP. Keep response to a single line.",
            },
            {
              role: "user",
              content: `Question: ${text}\nCurrent evidence:\n${evidenceSummary || "none"}`,
            },
          ];

          const reflectionStart: ToolStepData = {
            id: crypto.randomUUID(),
            toolName: "thinking",
            status: "completed",
            description: "Evaluating evidence coverage",
            detail: "Evaluating whether more retrieval is needed",
            durationMs: 1,
          };
          addThinkingStep(reflectionStart);
          setCursorThinking("Checking if the current evidence is enough...");
          await sleep(150 + Math.round(Math.random() * 160));

          const reflection = await chatWithOllama(reflectionHistory);
          const focus = parseReflectionFocus(reflection);
          if (!focus && round > 1) {
            addThinkingStep({
              id: crypto.randomUUID(),
              toolName: "thinking",
              status: "completed",
              description: "Coverage sufficient. No additional retrieval needed.",
              detail: "Evidence looks complete for this question",
              durationMs: 1,
            });
            setCursorThinking("Coverage looks sufficient. Moving to synthesis...");
            await sleep(140 + Math.round(Math.random() * 160));
            break;
          }

          const effectiveFocus = focus ?? "core policy constraints";
          addThinkingStep({
            id: crypto.randomUUID(),
            toolName: "thinking",
            status: "completed",
            description: `Focus selected: ${effectiveFocus}`,
            detail: `Exploring this angle: ${effectiveFocus}`,
            durationMs: 1,
          });
          setCursorThinking(`Exploring: ${effectiveFocus}`);
          await sleep(170 + Math.round(Math.random() * 220));

          const roundQuery = `${text}\nFocus: ${effectiveFocus}`;
          const roundResults = await executeAllTools(roundQuery);
          const uniqueRound = dedupeToolResults(roundResults).filter((candidate) => {
            return !collectedResults.some(
              (existing) => existing.toolName === candidate.toolName && existing.output === candidate.output,
            );
          });

          if (uniqueRound.length === 0) {
            addThinkingStep({
              id: crypto.randomUUID(),
              toolName: "thinking",
              status: "failed",
              description: "No new evidence discovered this round",
              detail: `No new evidence for focus: ${effectiveFocus}`,
              durationMs: 1,
            });
            setCursorThinking("No new evidence found in this pass. Trying alternate angle...");
            await sleep(140 + Math.round(Math.random() * 180));
            continue;
          }

          for (const result of uniqueRound) {
            const reflectionResult = await reflect(text, result);
            const reflectionStep: ToolStepData = {
              id: crypto.randomUUID(),
              toolName: reflectionResult.toolName,
              status: reflectionResult.status,
              description: summarizeForThinking(reflectionResult.output),
              detail: reflectionResult.output,
              durationMs: reflectionResult.durationMs,
            };
            addThinkingStep(reflectionStep);

            const step: ToolStepData = {
              id: crypto.randomUUID(),
              toolName: result.toolName,
              status: result.status,
              description: summarizeForThinking(result.output),
              detail: result.output,
              durationMs: result.durationMs,
            };
            currentToolSteps.push(step);

            const toolLineOptions = toolRunLines.map((lineFactory) => lineFactory(step.toolName));
            const line = pickRandomDifferent(toolLineOptions, lastToolLine.current);
            lastToolLine.current = line;
            setCursorThinking(line);
            setActiveTools((prev) => [...prev, step]);
            await sleep(170 + Math.round(Math.random() * 230));

            const seenLine = `Observed: ${step.description}`;
            setCursorThinking(seenLine);
            await sleep(170 + Math.round(Math.random() * 210));
          }

          collectedResults = dedupeToolResults([...collectedResults, ...uniqueRound]);

          const roundSummary = await summarize(text, collectedResults);
          if (roundSummary.status === "completed") {
            const summaryStep: ToolStepData = {
              id: crypto.randomUUID(),
              toolName: roundSummary.toolName,
              status: roundSummary.status,
              description: summarizeForThinking(roundSummary.output),
              detail: roundSummary.output,
              durationMs: roundSummary.durationMs,
            };
            currentToolSteps.push(summaryStep);
            setActiveTools((prev) => [...prev, summaryStep]);
          }
        }

        if (currentToolSteps.length === 0) {
          const fallbackResult = await executeAllTools(text);
          const fallbackSteps = dedupeToolResults(fallbackResult).map((result): ToolStepData => ({
            id: crypto.randomUUID(),
            toolName: result.toolName,
            status: result.status,
            description: summarizeForThinking(result.output),
            detail: result.output,
            durationMs: result.durationMs,
          }));
          currentToolSteps = fallbackSteps;
          setActiveTools(fallbackSteps);
          collectedResults = dedupeToolResults([...collectedResults, ...fallbackResult]);

          for (const result of fallbackResult) {
            const reflectionResult = await reflect(text, result);
            const reflectionStep: ToolStepData = {
              id: crypto.randomUUID(),
              toolName: reflectionResult.toolName,
              status: reflectionResult.status,
              description: summarizeForThinking(reflectionResult.output),
              detail: reflectionResult.output,
              durationMs: reflectionResult.durationMs,
            };
            addThinkingStep(reflectionStep);
          }
        }

        if (collectedResults.length === 0) {
          const emergencySearch = await executeAllTools(`regulation policy compliance ${text}`);
          const emergencyUnique = dedupeToolResults(emergencySearch);
          for (const result of emergencyUnique) {
            const step: ToolStepData = {
              id: crypto.randomUUID(),
              toolName: result.toolName,
              status: result.status,
              description: summarizeForThinking(result.output),
              detail: result.output,
              durationMs: result.durationMs,
            };
            currentToolSteps.push(step);
          }
          collectedResults = dedupeToolResults([...collectedResults, ...emergencyUnique]);
        }
      } else {
        setCursorThinking("Preparing response...");
        await sleep(180 + Math.round(Math.random() * 180));
      }

      if (collectedResults.length > 0) {
        const summaryResult = await summarize(text, collectedResults);
        if (summaryResult.status === "completed") {
          const summaryStep: ToolStepData = {
            id: crypto.randomUUID(),
            toolName: summaryResult.toolName,
            status: summaryResult.status,
            description: summarizeForThinking(summaryResult.output),
            detail: summaryResult.output,
            durationMs: summaryResult.durationMs,
          };
          currentToolSteps = [...currentToolSteps, summaryStep];
          setActiveTools((prev) => [...prev, summaryStep]);
        }
      }

      const synthesisOptions = synthesisLines.map((lineFactory) => lineFactory(currentToolSteps.length));
      const nextSynthesis = pickRandomDifferent(synthesisOptions, lastSynthesisLine.current);
      lastSynthesisLine.current = nextSynthesis;
      setCursorThinking(nextSynthesis);
      await sleep(220 + Math.round(Math.random() * 260));

      const contextInfo = collectedResults
        .filter(t => t.status === "completed")
        .map(t => t.output)
        .join("\n\n");

      const systemPrompt = buildSystemPrompt({
        preferredLanguage,
        contextInfo,
        forceToolGrounding: useTools,
      });

      const currentHistory: OllamaMessage[] = messages
        .slice(-10)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
      
      if (systemPrompt) {
        currentHistory.unshift({ role: "system", content: systemPrompt });
      }
      currentHistory.push({ role: "user", content: text });

      setCursorThinking("");

      if (useTools && (currentToolSteps.length > 0 || currentThinkingSteps.length > 0)) {
        const workflowMsg: ChatMessageData = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "",
          toolSteps: currentToolSteps,
          thinkingSteps: currentThinkingSteps,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, workflowMsg]);
      }

      let fullContent = "";
      let fullReasoning = "";
      for await (const chunk of chatWithOllamaStream(currentHistory, responseModel)) {
        fullContent = chunk.content;
        fullReasoning = chunk.thinking;
        setStreamingContent(fullContent);
        if (!casualMessage && fullReasoning.trim().length > 0) {
          const line = latestReasoningLine(fullReasoning);
          const reasoningStep: ToolStepData = {
            id: "reasoning-live",
            toolName: "model",
            status: "completed",
            description: line,
            detail: fullReasoning,
            durationMs: 1,
          };
          currentReasoningSteps = [reasoningStep];
          setReasoningSteps(currentReasoningSteps);
        }
      }

      const assistantMsg: ChatMessageData = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: sanitizeAssistantOutput(fullContent),
        toolSteps: currentToolSteps,
        reasoningSteps: !casualMessage && currentReasoningSteps.length > 0 ? currentReasoningSteps : undefined,
        thinkingSteps: currentThinkingSteps.length > 0 ? currentThinkingSteps : undefined,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setStreamingContent("");
      setActiveTools([]);
      setReflectionSteps([]);
      setReasoningSteps([]);
    } catch (error) {
      setCursorThinking("");
      const assistantMsg: ChatMessageData = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : "Connection failed. Ensure Ollama is running on port 11434."}`,
        toolSteps: [{
          id: crypto.randomUUID(),
          toolName: "error",
          status: "failed",
          description: "Connection failed",
          detail: "{}",
          durationMs: 0,
        }],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setIsThinking(false);
      setCursorThinking("");
      setReflectionSteps([]);
      setReasoningSteps([]);
    }
  }, [messages]);

  const isStreaming = streamingContent.length > 0;

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="shrink-0 px-6 py-4 flex items-center justify-between border-b border-border/40 bg-card/60 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-[14px] font-semibold text-foreground">Cognizant Agent</h1>
            <p className="text-[11px] text-foreground/50">Tool-aware compliance copilot</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 rounded-full border border-border/50 bg-background/70 px-2.5 py-1">
          <Command className="h-3 w-3 text-foreground/45" />
          <span className="text-[11px] text-foreground/50">Cursor-style workflow</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6">
          {groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center rounded-3xl border border-border/50 bg-card/70 backdrop-blur-sm px-8">
              <p className="text-[17px] text-foreground/80 mb-2">Ask anything about lending regulations</p>
              <p className="text-[12px] text-foreground/45">Try: "What is the FLDG cap?" or "Cooling-off breach checks"</p>
            </div>
          ) : (
            groups.map((group, i) => (
              <div key={group.id}>
                {i > 0 && <div className="h-px bg-border/20 my-2" />}
                <ChatGroupBlock group={group} isStreaming={isStreaming && i === groups.length - 1} />
              </div>
            ))
          )}

          {isThinking && (
            <>
              <div className="h-px bg-border/20 my-2" />
              <div className="flex items-start gap-3 py-4">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="h-4 w-4 text-primary animate-spin" />
                </div>
                <div className="flex-1">
                  <p className="text-[12px] text-foreground/50 mb-2 text-shimmer">
                    Agent is working through the task...
                  </p>

                  {activeTools.length > 0 && (
                    <div className="mb-3">
                      <ToolAccordion
                        toolSteps={activeTools}
                        title="Tool discovery"
                      />
                    </div>
                  )}

                  {reflectionSteps.length > 0 && (
                    <div className="mb-3">
                      <ToolAccordion
                        toolSteps={reflectionSteps}
                        defaultOpen={false}
                        title="Thinking"
                      />
                    </div>
                  )}

                  {reasoningSteps.length > 0 && (
                    <div className="mb-3">
                      <ToolAccordion
                        toolSteps={reasoningSteps}
                        title="Reasoning"
                      />
                    </div>
                  )}

                  {streamingContent && (
                    <div className="text-[14px] text-foreground/75 leading-relaxed whitespace-pre-wrap rounded-xl border border-border/40 bg-card/80 px-4 py-3 shadow-sm">
                      {streamingContent}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      <footer className="shrink-0 px-6 py-4 border-t border-border/40 bg-card/60 backdrop-blur-xl">
        <ChatInput onSend={handleSend} disabled={isThinking} />
      </footer>
    </div>
  );
}
