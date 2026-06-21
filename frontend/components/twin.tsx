'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, RotateCcw } from 'lucide-react';
import MessageContent from '@/components/message-content';
import { profile } from '@/lib/profile';

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

    const startNewConversation = () => {
        setMessages([]);
        setSessionId('');
        setInput('');
        inputRef.current?.focus();
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
        const sizeClass = size === 'lg' ? 'w-28 h-28 md:w-32 md:h-32' : 'w-9 h-9';
        const iconSize = size === 'lg' ? 'w-14 h-14' : 'w-5 h-5';

        if (hasAvatar) {
            return (
                <img
                    src="/avatar.jpg"
                    alt={profile.name}
                    className={`${sizeClass} rounded-full object-cover ${
                        size === 'lg'
                            ? 'mx-auto mb-4 ring-4 ring-blue-100 shadow-lg'
                            : 'ring-2 ring-white shadow-sm'
                    }`}
                />
            );
        }

        if (size === 'lg') {
            return <Bot className="w-14 h-14 mx-auto mb-4 text-blue-300" />;
        }

        return (
            <div className="w-9 h-9 bg-blue-900 rounded-full flex items-center justify-center shadow-sm">
                <Bot className={`${iconSize} text-white`} />
            </div>
        );
    };

    return (
        <div className="flex h-full w-full flex-col">
            {messages.length > 0 && (
                <div className="flex shrink-0 justify-end px-3 pt-2 md:px-6">
                    <button
                        type="button"
                        onClick={startNewConversation}
                        disabled={isLoading}
                        className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-900 disabled:opacity-50"
                    >
                        <RotateCcw className="h-3.5 w-3.5" />
                        New conversation
                    </button>
                </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-6 md:py-6">
                <div className="mx-auto max-w-3xl space-y-4">
                    {messages.length === 0 && (
                        <div className="animate-fade-in-up flex flex-col items-center px-4 pt-6 pb-4 text-center md:pt-10">
                            {renderAvatar('lg')}
                            <h2 className="text-xl font-bold text-gray-900 md:text-2xl">
                                {profile.name}
                            </h2>
                            <p className="mt-1 text-sm font-medium text-blue-800 md:text-base">
                                {profile.title} · {profile.company}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">{profile.location}</p>
                            <p className="mt-4 max-w-md text-sm leading-relaxed text-gray-600 md:text-base">
                                Hello! You are in Lakshman Yeluri&apos;s Digital World.
                                <br />
                                {profile.tagline}
                            </p>
                            <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-lg">
                                {profile.starterQuestions.map((question) => (
                                    <button
                                        key={question}
                                        type="button"
                                        onClick={() => sendMessage(question)}
                                        disabled={isLoading}
                                        className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm text-blue-900 shadow-sm transition-all hover:border-blue-300 hover:bg-blue-50 hover:shadow disabled:opacity-50"
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
                                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-blue-900 p-4 text-white shadow-md md:max-w-[75%]">
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
                                <div className="flex-shrink-0 pt-1">{renderAvatar('sm')}</div>
                                <div className="flex max-w-[85%] flex-col gap-2 md:max-w-[75%]">
                                    <div className="rounded-2xl rounded-bl-md border border-gray-100 bg-white p-4 text-gray-800 shadow-sm">
                                        <MessageContent content={message.content} />
                                        <p className="mt-2 text-xs text-gray-400">
                                            {message.timestamp.toLocaleTimeString()}
                                        </p>
                                    </div>

                                    {showSuggestions && (
                                        <div className="flex flex-col gap-2 pl-1">
                                            <p className="text-xs font-medium text-gray-500">
                                                Suggested follow-up questions
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {message.suggestedQuestions!.map((question) => (
                                                    <button
                                                        key={question}
                                                        type="button"
                                                        onClick={() => sendMessage(question)}
                                                        disabled={isLoading}
                                                        className="rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-left text-sm text-blue-900 transition-colors hover:border-blue-300 hover:bg-blue-100 disabled:opacity-50"
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
                                <div className={hasAvatar ? 'animate-pulse' : ''}>
                                    {renderAvatar('sm')}
                                </div>
                            </div>
                            <div className="rounded-2xl rounded-bl-md border border-gray-100 bg-white p-4 shadow-sm">
                                <p className="mb-2 text-sm font-medium text-gray-500">
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
                <div className="mx-auto max-w-3xl">
                    <p className="mb-2 text-center text-xs text-gray-400">
                        Press Enter to send
                    </p>
                    <div className="relative flex items-center rounded-full border border-gray-200 bg-white shadow-lg">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyPress}
                            placeholder="Ask about Lakshman's experience..."
                            className="w-full rounded-full bg-transparent py-3.5 pl-5 pr-14 text-gray-800 focus:outline-none disabled:opacity-50"
                            disabled={isLoading}
                            autoFocus
                        />
                        <button
                            onClick={() => sendMessage()}
                            disabled={!input.trim() || isLoading}
                            className="absolute right-2 rounded-full bg-blue-900 p-2.5 text-white transition-colors hover:bg-blue-950 disabled:cursor-not-allowed disabled:opacity-50"
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
