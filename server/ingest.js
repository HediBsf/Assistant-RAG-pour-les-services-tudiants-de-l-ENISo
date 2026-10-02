import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OllamaEmbeddings } from "@langchain/ollama";

const getEmbeddings = () =>
  new OllamaEmbeddings({
    model: process.env.EMBED_MODEL || "nomic-embed-text",
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  });

/**
 * ChromaDB n'accepte que des valeurs scalaires dans les métadonnées
 * (string, number, boolean, null). Le PDFLoader de LangChain produit
 * des objets imbriqués comme { pdf: { info: {...}, metadata: {...} } }
 * qu'il faut aplatir avant le stockage.
 */
function flattenMetadata(metadata) {
  const flat = {};

  const recurse = (obj, prefix = "") => {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}_${key}` : key;

      if (value === null || value === undefined) {
        flat[fullKey] = null;
      } else if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        flat[fullKey] = value;
      } else if (typeof value === "object" && !Array.isArray(value)) {
        // Objet imbriqué → on descend récursivement
        recurse(value, fullKey);
      } else if (Array.isArray(value)) {
        // Tableau → on le sérialise en string JSON
        flat[fullKey] = JSON.stringify(value);
      } else {
        // Tout autre type → on le convertit en string
        flat[fullKey] = String(value);
      }
    }
  };

  recurse(metadata);
  return flat;
}

export const ingestData = async (filePath) => {
  // 1. Convertir le PDF en texte
  const loader = new PDFLoader(filePath);
  const docs = await loader.load();

  // 2. Découper en chunks
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const chunks = await splitter.splitDocuments(docs);
  console.log(`📄 Split into ${chunks.length} chunks`);

  // 3. Aplatir les métadonnées de chaque chunk pour ChromaDB
  const sanitizedChunks = chunks.map((chunk) => ({
    ...chunk,
    metadata: flattenMetadata(chunk.metadata),
  }));

  // 4. Créer les embeddings avec Ollama et stocker dans ChromaDB
  const embeddings = getEmbeddings();

  await Chroma.fromDocuments(sanitizedChunks, embeddings, {
    collectionName: process.env.CHROMA_COLLECTION || "knowledge_base",
    url: process.env.CHROMA_URL || "http://localhost:8000",
  });

  console.log(`✅ Ingestion Complete! ${chunks.length} chunks stored in ChromaDB.`);
};