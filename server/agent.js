import { ChatOllama } from "@langchain/ollama";
import { createAgent } from "langchain";
import { MemorySaver } from "@langchain/langgraph-checkpoint";
import { searchKnowledgeBase, createChart, getAndClearChart } from "./tools.js";

// Persist conversation history per session
const checkpointer = new MemorySaver();

export async function runAgent({ sessionId = "default", message }) {
  try {
    const model = new ChatOllama({
      model: "qwen3.5:2b",
      temperature: 0,
      think: false,
    });

    const agent = createAgent({
      model,
      tools: [searchKnowledgeBase, createChart], // ← added createChart
      checkpointer,
      systemPrompt: `You are a helpful AI assistant with access to a knowledge base.

When users ask questions:
1. Search the knowledge base using search_knowledge_base.
2. If the answer contains numerical data, statistics, comparisons, or trends — ALSO call create_chart to visualize the data. Choose the best chart type:
   - bar  → compare values across categories
   - line → show evolution / trends
   - pie  → show proportions / percentages
3. Give a concise, accurate text answer.

Always prioritize information from the knowledge base. Be precise.`,
    });

    console.log(`🤖 Running agent for: "${message}"`);

    const response = await agent.invoke(
      { messages: [{ role: "user", content: message }] },
      { configurable: { thread_id: sessionId } }
    );

    // Extract last text message
    const lastMessage = response.messages[response.messages.length - 1];
    const output = lastMessage?.content || "";

    // Pick up any chart the createChart tool generated
    const chart = getAndClearChart();

    console.log(`✅ Agent response: ${output.slice(0, 100)}...`);
    if (chart) console.log(`📊 Chart attached: ${chart.title}`);

    return { output, chart }; // chart is null if no chart was created
  } catch (error) {
    console.error("❌ Error in runAgent:", error);
    throw error;
  }
}