'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, RotateCcw, Copy, Check } from 'lucide-react';
import MessageContent from '@/components/message-content';
import { profile } from '@/lib/profile';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    suggestedQuestions?: string[];
    notice?: string;
}

const DEFAULT_ERROR_MESSAGE = "Poof! 🪄 Well, that wasn't supposed to happen. Our latest magic trick backfired and caused a tiny error. We're resetting the stage, so please try again!";

export default function Twin() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string>('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    const sendMessage = async (textOverride?: string) => {
        const messageText = (textOverride ?? input).trim();
        if (!messageText || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: messageText,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        if (!textOverride) {
            setInput('');
        }
        setIsLoading(true);

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: messageText,
                    session_id: sessionId || undefined,
                }),
            });

            if (!response.ok) {
                let errorDetail = DEFAULT_ERROR_MESSAGE;
                try {
                    const errorData = await response.json();
                    if (typeof errorData.detail === 'string' && errorData.detail.trim()) {
                        errorDetail = errorData.detail;
                    }
                } catch {
                    // Keep default error message when response body is not JSON.
                }
                throw new Error(errorDetail);
            }

            const data = await response.json();

            if (!sessionId) {
                setSessionId(data.session_id);
            }

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data.response,
                timestamp: new Date(),
                suggestedQuestions: data.suggested_questions ?? [],
                notice: data.notice ?? undefined,
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Error:', error);
            const errorText =
                error instanceof Error && error.message.trim()
                    ? error.message
                    : DEFAULT_ERROR_MESSAGE;
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: errorText,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

    const copyMessage = async (messageId: string, content: string) => {
        try {
            await navigator.clipboard.writeText(content);
            setCopiedMessageId(messageId);
            setTimeout(() => setCopiedMessageId(null), 2000);
        } catch (error) {
            console.error('Failed to copy message:', error);
        }
    };

    const startNewConversation = () => {
        setMessages([]);
        setSessionId('');
        setInput('');
        inputRef.current?.focus();
    };

    const lastAssistantMessageId = [...messages]
        .reverse()
        .find(message => message.role === 'assistant')?.id;

    const assistantIcon = (
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-900 shadow-sm dark:bg-blue-700">
            <Bot className="h-5 w-5 text-white" />
        </div>
    );

    return (
        <div className="flex h-full w-full flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-6 md:py-6">
                <div className="mx-auto max-w-3xl space-y-4">
                    {messages.length === 0 && (
                        <div className="animate-fade-in-up flex flex-col items-center px-4 pt-6 pb-4 text-center md:pt-10">
                            <p className="max-w-md text-lg font-medium text-gray-800 dark:text-gray-100 md:text-xl">
                                Hello! You are in Lakshman Yeluri&apos;s Digital World.
                            </p>
                            <p className="mt-3 max-w-md text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
                                {profile.tagline}
                            </p>
                            <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-lg">
                                {profile.starterQuestions.map((question) => (
                                    <button
                                        key={question}
                                        type="button"
                                        onClick={() => sendMessage(question)}
                                        disabled={isLoading}
                                        className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm text-blue-900 shadow-sm transition-all hover:border-blue-300 hover:bg-blue-50 hover:shadow disabled:opacity-50 dark:border-blue-800 dark:bg-gray-800 dark:text-blue-200 dark:hover:bg-gray-700"
                                    >
                                        {question}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((message) => {
                        if (message.role === 'user') {
                            return (
                                <div
                                    key={message.id}
                                    className="animate-fade-in-up flex gap-3 justify-end"
                                >
                                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-blue-900 p-4 text-white shadow-md md:max-w-[75%] dark:bg-blue-800">
                                        <p className="whitespace-pre-wrap leading-relaxed">
                                            {message.content}
                                        </p>
                                        <p className="mt-2 text-xs text-blue-200">
                                            {message.timestamp.toLocaleTimeString()}
                                        </p>
                                    </div>
                                    <div className="flex-shrink-0">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-600 shadow-sm">
                                            <User className="h-5 w-5 text-white" />
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        const showSuggestions =
                            !isLoading &&
                            message.id === lastAssistantMessageId &&
                            (message.suggestedQuestions?.length ?? 0) > 0;

                        return (
                            <div
                                key={message.id}
                                className="animate-fade-in-up flex gap-3 justify-start"
                            >
                                <div className="flex-shrink-0 pt-1">{assistantIcon}</div>
                                <div className="flex max-w-[85%] flex-col gap-2 md:max-w-[75%]">
                                    {message.notice && (
                                        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                                            {message.notice}
                                        </p>
                                    )}
                                    <div className="rounded-2xl rounded-bl-md border border-gray-100 bg-white p-4 text-gray-800 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                                        <MessageContent content={message.content} />
                                        <div className="mt-2 flex items-center justify-between gap-2">
                                            <p className="text-xs text-gray-400 dark:text-gray-500">
                                                {message.timestamp.toLocaleTimeString()}
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => copyMessage(message.id, message.content)}
                                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                                                aria-label="Copy response"
                                            >
                                                {copiedMessageId === message.id ? (
                                                    <>
                                                        <Check className="h-3.5 w-3.5" />
                                                        Copied
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy className="h-3.5 w-3.5" />
                                                        Copy
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {showSuggestions && (
                                        <div className="flex flex-col gap-2 pl-1">
                                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                                Suggested follow-up questions
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {message.suggestedQuestions!.map((question) => (
                                                    <button
                                                        key={question}
                                                        type="button"
                                                        onClick={() => sendMessage(question)}
                                                        disabled={isLoading}
                                                        className="rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-left text-sm text-blue-900 transition-colors hover:border-blue-300 hover:bg-blue-100 disabled:opacity-50 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200 dark:hover:bg-blue-900"
                                                    >
                                                        {question}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {isLoading && (
                        <div className="animate-fade-in-up flex gap-3 justify-start">
                            <div className="flex-shrink-0 pt-1">
                                <div className="animate-pulse">{assistantIcon}</div>
                            </div>
                            <div className="rounded-2xl rounded-bl-md border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                                <p className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                                    Lakshman is typing...
                                </p>
                                <div className="flex space-x-2">
                                    <div className="h-2 w-2 animate-bounce rounded-full bg-blue-400" />
                                    <div className="h-2 w-2 animate-bounce rounded-full bg-blue-400 delay-100" />
                                    <div className="h-2 w-2 animate-bounce rounded-full bg-blue-400 delay-200" />
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>
            </div>

            <div className="shrink-0 px-3 pb-4 pt-2 md:px-6 md:pb-6">
                <div className="mx-auto max-w-3xl space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                            Press Enter to send
                        </p>
                        <button
                            type="button"
                            onClick={startNewConversation}
                            disabled={isLoading || messages.length === 0}
                            className="inline-flex shrink-0 items-center gap-2 rounded-full border-2 border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-900 shadow-sm transition-all hover:border-blue-400 hover:bg-blue-100 hover:shadow-md disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200 dark:hover:bg-blue-900 dark:disabled:border-gray-700 dark:disabled:bg-gray-800 dark:disabled:text-gray-500"
                        >
                            <RotateCcw className="h-4 w-4" />
                            New conversation
                        </button>
                    </div>
                    <div className="relative flex items-center rounded-full border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyPress}
                            placeholder="Ask about Lakshman's experience..."
                            className="w-full rounded-full bg-transparent py-3.5 pl-5 pr-14 text-gray-800 focus:outline-none disabled:opacity-50 dark:text-gray-100 dark:placeholder:text-gray-500"
                            disabled={isLoading}
                            autoFocus
                        />
                        <button
                            onClick={() => sendMessage()}
                            disabled={!input.trim() || isLoading}
                            className="absolute right-2 rounded-full bg-blue-900 p-2.5 text-white transition-colors hover:bg-blue-950 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-700 dark:hover:bg-blue-600"
                            aria-label="Send message"
                        >
                            <Send className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
