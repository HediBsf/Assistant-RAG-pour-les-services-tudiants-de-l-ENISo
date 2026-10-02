import { tool } from "langchain";
import { z } from "zod";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OllamaEmbeddings } from "@langchain/ollama";

// ─── Vector Store (ChromaDB local) ────────────────────────────────────────────

let vectorStore;

const getVectorStore = async () => {
  if (vectorStore) return vectorStore;

  const embeddings = new OllamaEmbeddings({
    model: process.env.EMBED_MODEL || "nomic-embed-text",
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  });

  vectorStore = await Chroma.fromExistingCollection(embeddings, {
    collectionName: process.env.CHROMA_COLLECTION || "knowledge_base",
    url: process.env.CHROMA_URL || "http://localhost:8000",
  });

  return vectorStore;
};

// ─── Chart state (shared between tool and agent) ───────────────────────────────

let pendingChart = null;

/** Called by agent.js after invoke() to retrieve and clear the generated chart */
export const getAndClearChart = () => {
  const chart = pendingChart;
  pendingChart = null;
  return chart;
};

// ─── Tool 1 : Search Knowledge Base ───────────────────────────────────────────

export const searchKnowledgeBase = tool(
  async ({ query }) => {
    console.log(`🔍 Agent is searching ChromaDB for: "${query}"`);

    const store = await getVectorStore();
    const results = await store.similaritySearch(query, 10);

    results.forEach((r, i) => {
      console.log(`Result ${i + 1}:`, r.pageContent.slice(0, 200));
    });

    if (results.length === 0) {
      return "No relevant information found in the knowledge base.";
    }

    return results.map((doc) => doc.pageContent).join("\n\n---\n\n");
  },
  {
    name: "search_knowledge_base",
    description:
      "Searches the internal knowledge base for technical info and documentation. Use this when you need to find information from uploaded PDF documents.",
    schema: z.object({
      query: z
        .string()
        .describe("The search query to look up in the knowledge base"),
    }),
  }
);

// ─── Tool 2 : Create Chart ─────────────────────────────────────────────────────

export const createChart = tool(
  async ({ chartType, title, data }) => {
    // Store chart data — agent.js will pick it up after invoke()
    pendingChart = { type: chartType, title, data };
    console.log(`📊 Chart queued: "${title}" (${chartType}, ${data.length} points)`);
    return `Chart "${title}" has been created as a ${chartType} chart with ${data.length} data points. It will be displayed to the user.`;
  },
  {
    name: "create_chart",
    description:
      "Creates a visual chart (bar, line, or pie) from numerical data extracted from the knowledge base. " +
      "Use this whenever you have quantitative data (numbers, percentages, statistics, comparisons) " +
      "that would be clearer as a chart than plain text.",
    schema: z.object({
      chartType: z
        .enum(["bar", "line", "pie"])
        .describe("bar = comparisons, line = trends over time, pie = proportions/percentages"),
      title: z.string().describe("Clear, concise chart title"),
      data: z
        .array(
          z.object({
            label: z.string().describe("Category or x-axis label"),
            value: z.number().describe("Numeric value"),
          })
        )
        .min(2)
        .describe("Data points for the chart (minimum 2)"),
    }),
  }
);