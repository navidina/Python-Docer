import React, { useState, useEffect } from 'react';
import { ChatMessage, OllamaConfig, CodeSymbol } from '../types';
import { LocalVectorStore } from '../services/vectorStore';

const CHAT_STORAGE_KEY = 'rayan_chat_history';
const DEFAULT_SYSTEM_MSG: ChatMessage = { role: 'system', content: 'You are Rayan, an AI assistant.' };
const BACKEND_CHAT_URL = 'http://localhost:8000/chat';

export const useChat = (
    config: OllamaConfig, 
    vectorStoreRef: React.MutableRefObject<LocalVectorStore | null>, 
    hasContext: boolean,
    knowledgeGraph: Record<string, CodeSymbol>, 
    docParts: Record<string, string>
) => {
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    if (typeof window === 'undefined') return [DEFAULT_SYSTEM_MSG];
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [DEFAULT_SYSTEM_MSG];
    } catch { return [DEFAULT_SYSTEM_MSG]; }
  });

  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isRetrieving, setIsRetrieving] = useState(false);

  useEffect(() => {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chatMessages));
  }, [chatMessages]);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;

    const userText = chatInput;
    const newUserMessage: ChatMessage = { role: 'user', content: userText };
    setChatMessages(prev => [...prev, newUserMessage]);
    setChatInput('');
    setIsChatLoading(true);
    setIsRetrieving(true);

    try {
        // Prepare history for backend
        const historyForBackend = chatMessages.filter(m => m.role !== 'system').map(m => ({
            role: m.role,
            content: m.content
        }));

        const response = await fetch(BACKEND_CHAT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: userText,
                history: historyForBackend,
                model_name: config.model,
                base_url: config.baseUrl
            })
        });

        if (!response.ok) {
            throw new Error(`Backend Error: ${response.status}`);
        }

        const data = await response.json();
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.response }]);

    } catch (error: any) {
        console.error("Chat Error:", error);
        setChatMessages(prev => [...prev, { role: 'assistant', content: `**خطا در ارتباط با سرور پایتون:** ${error.message}` }]);
    } finally {
        setIsChatLoading(false);
        setIsRetrieving(false);
    }
  };

  return { chatMessages, chatInput, setChatInput, isChatLoading, isRetrieving, handleSendMessage };
};
