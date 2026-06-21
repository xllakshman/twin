'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User } from 'lucide-react';
import MessageContent from '@/components/message-content';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    suggestedQuestions?: string[];
}

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

            if (!response.ok) throw new Error('Failed to send message');

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
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Error:', error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
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

    const [hasAvatar, setHasAvatar] = useState(false);
    useEffect(() => {
        fetch('/avatar.jpg', { method: 'HEAD' })
            .then(res => setHasAvatar(res.ok))
            .catch(() => setHasAvatar(false));
    }, []);

    const lastAssistantMessageId = [...messages]
        .reverse()
        .find(message => message.role === 'assistant')?.id;

    const renderAvatar = (size: 'sm' | 'lg') => {
        const sizeClass = size === 'lg' ? 'w-20 h-20' : 'w-8 h-8';
        const iconSize = size === 'lg' ? 'w-12 h-12' : 'w-5 h-5';

        if (hasAvatar) {
            return (
                <img
                    src="/avatar.jpg"
                    alt="Lakshman Digital Avatar"
                    className={`${sizeClass} rounded-full border border-slate-300 ${size === 'lg' ? 'mx-auto mb-3 border-2' : ''}`}
                />
            );
        }

        if (size === 'lg') {
            return <Bot className="w-12 h-12 mx-auto mb-3 text-gray-400" />;
        }

        return (
            <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
                <Bot className={`${iconSize} text-white`} />
            </div>
        );
    };

    return (
        <div className="flex h-full w-full flex-col bg-gray-50">
            <div className="shrink-0 bg-gradient-to-r from-slate-700 to-slate-800 p-3 text-white md:p-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Bot className="w-6 h-6" />
                    Lakshman Digital Avatar
                </h2>
                <p className="text-sm text-slate-300 mt-1">Ask a Question about Lakshman Professional Experience</p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-4 space-y-4">
                {messages.length === 0 && (
                    <div className="text-center text-gray-500 mt-8">
                        {renderAvatar('lg')}
                        <p>Hello! You are in Lakshman Yeluri&apos;s Digital World</p>
                        <p className="text-sm mt-2">Ask me anything about his professional Experience...</p>
                    </div>
                )}

                {messages.map((message) => {
                    if (message.role === 'user') {
                        return (
                            <div key={message.id} className="flex gap-3 justify-end">
                                <div className="max-w-[85%] md:max-w-[75%] rounded-lg p-3 bg-slate-700 text-white">
                                    <p className="whitespace-pre-wrap">{message.content}</p>
                                    <p className="text-xs mt-1 text-slate-300">
                                        {message.timestamp.toLocaleTimeString()}
                                    </p>
                                </div>
                                <div className="flex-shrink-0">
                                    <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                                        <User className="w-5 h-5 text-white" />
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
                        <div key={message.id} className="flex gap-3 justify-start">
                            <div className="flex-shrink-0">{renderAvatar('sm')}</div>
                            <div className="flex flex-col gap-2 max-w-[85%] md:max-w-[75%]">
                                <div className="rounded-lg p-3 bg-white border border-gray-200 text-gray-800">
                                    <MessageContent content={message.content} />
                                    <p className="text-xs mt-1 text-gray-500">
                                        {message.timestamp.toLocaleTimeString()}
                                    </p>
                                </div>

                                {showSuggestions && (
                                    <div className="flex flex-col gap-2">
                                        <p className="text-xs font-medium text-gray-500 px-1">
                                            Suggested follow-up questions
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {message.suggestedQuestions!.map((question) => (
                                                <button
                                                    key={question}
                                                    type="button"
                                                    onClick={() => sendMessage(question)}
                                                    disabled={isLoading}
                                                    className="text-left text-sm px-3 py-2 rounded-full border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100 hover:border-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <div className="flex gap-3 justify-start">
                        <div className="flex-shrink-0">{renderAvatar('sm')}</div>
                        <div className="bg-white border border-gray-200 rounded-lg p-3">
                            <div className="flex space-x-2">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <div className="shrink-0 border-t border-gray-200 bg-white p-3 md:p-4">
                <div className="flex gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="Type your message..."
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-600 focus:border-transparent text-gray-800"
                        disabled={isLoading}
                        autoFocus
                    />
                    <button
                        onClick={() => sendMessage()}
                        disabled={!input.trim() || isLoading}
                        className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
