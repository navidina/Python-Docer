
import { useState } from 'react';
import { OllamaConfig, ProcessingLog, ProcessedFile, CodeSymbol, BusinessRule, ArchViolation, ManualOverride } from '../types';

// Python Backend URL
const API_URL = 'http://localhost:8000/generate-docs';

interface UseRepoProcessorProps {
  config: OllamaConfig;
  inputType: 'local' | 'github';
  files?: FileList | null;
  githubUrl: string;
  docLevels: any;
  repoPath?: string;
  vectorStoreRef: any;
}

export const useRepoProcessor = () => {
  const [logs, setLogs] = useState<ProcessingLog[]>([]);
  const [generatedDoc, setGeneratedDoc] = useState<string>('');
  const [docParts, setDocParts] = useState<Record<string, string>>({}); 
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null); 
  const [progress, setProgress] = useState(0);
  const [hasContext, setHasContext] = useState(false);
  
  // Data from Python
  const [stats, setStats] = useState<any[]>([]);
  const [knowledgeGraph, setKnowledgeGraph] = useState<Record<string, CodeSymbol>>({});
  const [codeHealth, setCodeHealth] = useState<any[]>([]);
  
  // Legacy/Unused states kept for compatibility
  const [businessRules, setBusinessRules] = useState<BusinessRule[]>([]); 
  const [archViolations, setArchViolations] = useState<ArchViolation[]>([]); 
  const [zombieFiles, setZombieFiles] = useState<string[]>([]); 
  const [currentFile, setCurrentFile] = useState<string>('');
  const [fileMap, setFileMap] = useState<Record<string, ProcessedFile>>({});
  const [manualOverrides, setManualOverrides] = useState<Record<string, ManualOverride>>({});

  const addLog = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setLogs(prev => [...prev, { timestamp: new Date().toISOString(), message, type }]);
  };

  const dismissError = () => setError(null);

  const saveManualOverride = (sectionId: string, content: string) => {
      const newOverrides = { ...manualOverrides, [sectionId]: { sectionId, content, updatedAt: Date.now() } };
      setManualOverrides(newOverrides);
      setDocParts(prev => ({ ...prev, [sectionId]: content }));
      addLog(`Manual edit saved for section: ${sectionId}`, 'success');
  };

  const importSession = (data: any) => {
      console.log("Import not fully implemented for Python backend mode yet");
  };
  
  const reanalyzeFile = async (config: any, path: string) => {
      addLog(`Re-analyzing file: ${path}...`, 'info');
      try {
          const response = await fetch('http://localhost:8000/reanalyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ file_path: path })
          });
          
          if (!response.ok) {
              const err = await response.text();
              throw new Error(err || "Failed to re-analyze");
          }
          
          const data = await response.json();
          // Update graph and stats with new data
          if (data.graph) setKnowledgeGraph(data.graph);
          if (data.stats) setStats(data.stats);
          if (data.codeHealth) setCodeHealth(data.codeHealth);
          
          addLog(`File updated: ${path}`, 'success');
      } catch (e: any) {
          console.error(e);
          addLog(`Re-analysis failed: ${e.message}`, 'error');
      }
  }

  const processRepository = async ({ config, inputType, repoPath, githubUrl, docLevels }: UseRepoProcessorProps) => {
    setIsProcessing(true);
    setProgress(10);
    setLogs([]);
    setError(null);
    setDocParts({});
    setGeneratedDoc('');
    setStats([]);
    setKnowledgeGraph({});
    setCodeHealth([]);

    // Determine effective path based on input type
    const effectivePath = inputType === 'local' ? repoPath : githubUrl;

    if (!effectivePath) {
        setError(inputType === 'local' 
            ? "Please provide the absolute local path." 
            : "Please provide a valid GitHub URL.");
        setIsProcessing(false);
        return;
    }

    addLog(`Connecting to Python Backend at ${API_URL}...`, 'info');
    addLog(`Target: ${effectivePath} (${inputType})`, 'info');

    try {
      setProgress(30);
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_path: effectivePath,
          selected_modules: docLevels,
          model_name: config.model,
          base_url: config.baseUrl, // Pass the configured URL (LM Studio/Ollama)
          embedding_model: config.embeddingModel
        })
      });

      if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Backend Error (${response.status}): ${errText}`);
      }

      setProgress(60);
      const data = await response.json();
      
      // Update UI with results
      setDocParts(data.docParts || {});
      
      // RESTORED FEATURES: Stats and Graph
      if (data.stats) setStats(data.stats);
      if (data.graph) setKnowledgeGraph(data.graph);
      if (data.codeHealth) setCodeHealth(data.codeHealth);

      setHasContext(true);
      
      // Generate a simple combined doc for download
      let fullMarkdown = "";
      Object.keys(data.docParts || {}).forEach(k => {
          fullMarkdown += `# ${k.toUpperCase()}\n${data.docParts[k]}\n\n`;
      });
      
      setGeneratedDoc(fullMarkdown);
      setProgress(100);
      addLog("Generation Complete via Python Engine!", "success");

    } catch (error: any) {
      console.error(error);
      setError(error.message || "Failed to connect to Python backend.");
      addLog(`Error: ${error.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    logs,
    isProcessing,
    error,
    dismissError,
    progress,
    generatedDoc,
    hasContext,
    stats,
    knowledgeGraph,
    codeHealth,
    docParts,
    businessRules,
    archViolations,
    zombieFiles,
    currentFile,
    manualOverrides,
    fileMap,
    processRepository,
    saveManualOverride,
    reanalyzeFile,
    importSession 
  };
};
