import { Config, Effect, Layer, Schema, Stream } from "effect";
import { LLM, LLMClient, Tool, ToolRuntime, Message } from "@arunaki/llm";
import { OpenAICompatible } from "@arunaki/llm/providers";
import { RequestExecutor, WebSocketExecutor } from "@arunaki/llm/route";
import * as fs from "fs";
import * as path from "path";

// Gunakan API Key yang diberikan oleh user
const apiKey = "kn-55746bd1d06fab51c7ddfd528e1f5c3c0a925be57596fbe9";

// Konfigurasi model menggunakan OpenAICompatible mengarah ke API Kenari
const model = OpenAICompatible.configure({
  baseURL: "https://kenari.id/v1",
  apiKey,
}).model("nemotron-3-ultra-550b-a55b:free");

const tools = {
  read_file: Tool.make({
    description: "Membaca isi file dari dalam workspace",
    parameters: Schema.Struct({ filepath: Schema.String }),
    success: Schema.Struct({ content: Schema.String }),
    execute: (input) => Effect.sync(() => {
      const fullPath = path.resolve(process.cwd(), input.filepath);
      console.log(`\n[SYSTEM] LLM meminta untuk membaca file: ${fullPath}`);
      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        return { content };
      } catch (e: any) {
        return { content: `Error: ${e.message}` };
      }
    }),
  }),
};

const requestExecutorLayer = RequestExecutor.fetchLayer;
const llmDeps = Layer.mergeAll(requestExecutorLayer, WebSocketExecutor.layer);
const llmClientLayer = LLMClient.layer.pipe(Layer.provide(llmDeps));

const program = Effect.gen(function* () {
  console.log("Mengirim request ke LLM dengan akses tool...");
  const request = LLM.request({
    model,
    system: "Kamu adalah asisten AI. Kamu memiliki akses ke tool read_file.",
    prompt: "Tolong baca file demo-workspace/dokumen-rahasia.txt lalu beri tahu saya apa isinya.",
    generation: { maxTokens: 200, temperature: 0.1 },
    tools: Tool.toDefinitions(tools),
  });

  const events = Array.from(yield* LLM.stream(request).pipe(Stream.runCollect));
  for (const event of events) {
    if (event.type === "tool-call") {
      console.log("\n[LLM ACTION] Memanggil tool:", event.name, "dengan parameter:", event.input);
    }
    
    if (event.type === "text-delta") {
      process.stdout.write(event.text);
    }
    
    if (event.type !== "tool-call" || event.providerExecuted) continue;
    
    // Eksekusi tool
    const dispatched = yield* ToolRuntime.dispatch(tools, event);
    console.log("\n[TOOL RESULT] Berhasil mengeksekusi tool baca file.");
    
    const followUp = LLM.updateRequest(request, {
      messages: [
        ...request.messages,
        Message.assistant([event]),
        Message.tool({ id: event.id, name: event.name, result: dispatched.result }),
      ],
    });
    
    console.log("\n[SYSTEM] Mengirim kembali hasil tool ke LLM...");
    const followUpResponse = yield* LLM.generate(followUp);
    console.log("\n[SUCCESS] Respons Akhir LLM:");
    console.log("--------------------------------------------------");
    console.log(followUpResponse.text);
    console.log("--------------------------------------------------");
  }
}).pipe(Effect.provide(Layer.mergeAll(llmDeps, llmClientLayer)));

Effect.runPromise(program).catch((error) => {
  console.error("\n[ERROR] Gagal berkomunikasi dengan LLM:");
  console.error(error);
});
