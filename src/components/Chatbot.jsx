import React, { useState, useEffect, useRef } from 'react';
import { t } from '../i18n.js';

export function Chatbot({ lang, onApplyRoute, isOpen, setIsOpen }) {
  const T = (key, ...args) => t(lang, key, ...args);

  const [internalOpen, setInternalOpen] = useState(true);
  const open = isOpen !== undefined ? isOpen : internalOpen;
  const setOpen = setIsOpen || setInternalOpen;
  const [isExpanded, setIsExpanded] = useState(false);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ configured: false, provider: 'local', model: '' });
  const [hasUnread, setHasUnread] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Initialize or update initial greeting when language changes (if conversation hasn't started)
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length <= 1) {
        return [
          {
            id: 'init',
            role: 'assistant',
            content: T('chatGreeting'),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ];
      }
      return prev;
    });
  }, [lang]);

  // Fetch backend chat status
  useEffect(() => {
    fetch('/api/chat/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setStatus(data);
      })
      .catch(() => {
        // Fallback silently to local
      });
  }, []);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, open]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setHasUnread(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  const sendMessage = async (textToSend) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput('');
    setLoading(true);

    try {
      const apiMessages = newHistory
        .filter((m) => m.id !== 'init' || m.role === 'user')
        .map((m) => ({ role: m.role, content: m.content }));

      if (apiMessages.length === 0) {
        apiMessages.push({ role: 'user', content: text });
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          language: lang,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const data = await res.json();
      const assistantMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply || 'Sorry, I could not generate a response. Please try again.',
        routeAction: data.routeAction,
        provider: data.provider,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      if (!open) {
        setHasUnread(true);
      }
    } catch (err) {
      console.error('[Chatbot Error]:', err);
      const errorMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content:
          lang === 'gu'
            ? 'માફ કરશો, સર્વર સાથે સંપર્ક કરવામાં ભૂલ થઈ. કૃપા કરીને ફરી પ્રયાસ કરો.'
            : lang === 'hi'
            ? 'क्षमा करें, सर्वर से कनेक्ट करने में समस्या हुई। कृपया पुनः प्रयास करें।'
            : 'Sorry, could not connect to the assistant service. Please try again.',
        isError: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'init',
        role: 'assistant',
        content: T('chatGreeting'),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const quickPrompts = [
    T('quickPrompt1'),
    T('quickPrompt2'),
    T('quickPrompt3'),
    T('quickPrompt4'),
  ];

  return (
    <>
      {/* Floating Messenger Launcher Head (PIP Bubble) */}
      <div className={`pip-launcher-wrapper ${open ? 'chat-is-open' : ''}`}>
        {!open && (
          <button
            className="pip-launcher-btn"
            onClick={() => setOpen(true)}
            aria-label={T('chatLauncherTooltip')}
            title={T('chatLauncherTooltip')}
          >
            <div className="pip-launcher-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              <span className="pip-online-indicator"></span>
              {hasUnread && <span className="pip-unread-badge">1</span>}
            </div>
            <span className="pip-launcher-label">{T('aiTitle')}</span>
          </button>
        )}
      </div>

      {/* Picture-in-Picture Floating Chat Window */}
      {open && (
        <div
          className={`pip-chat-window animate-slide-up ${isExpanded ? 'expanded' : ''}`}
          role="dialog"
          aria-label={T('aiTitle')}
        >
          {/* Header */}
          <div className="pip-chat-header">
            <div className="pip-header-left">
              <div className="pip-avatar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"></path>
                  <rect x="4" y="8" width="16" height="12" rx="4"></rect>
                  <circle cx="9" cy="13" r="1.5" fill="currentColor"></circle>
                  <circle cx="15" cy="13" r="1.5" fill="currentColor"></circle>
                </svg>
                <span className="pip-avatar-dot"></span>
              </div>
              <div className="pip-header-text">
                <div className="pip-title-row">
                  <h4>{T('aiTitle')}</h4>
                  <span
                    className={`pip-status-badge ${status.configured ? 'live' : 'offline'}`}
                    title={status.configured ? `Model: ${status.model}` : 'Local Multimodal Transit Engine'}
                  >
                    {status.configured ? T('chatLiveBadge') : T('chatOfflineBadge')}
                  </span>
                </div>
                <p className="pip-subtitle">{T('aiDesc')}</p>
              </div>
            </div>

            <div className="pip-header-actions">
              {/* Expand / Minimize size button */}
              <button
                className="pip-icon-btn"
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? 'Restore Size' : 'Expand View'}
                aria-label={isExpanded ? 'Restore Size' : 'Expand View'}
              >
                {isExpanded ? (
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 14 10 14 10 20"></polyline>
                    <polyline points="20 10 14 10 14 4"></polyline>
                    <line x1="14" y1="10" x2="21" y2="3"></line>
                    <line x1="3" y1="21" x2="10" y2="14"></line>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <polyline points="9 21 3 21 3 15"></polyline>
                    <line x1="21" y1="3" x2="14" y2="10"></line>
                    <line x1="3" y1="21" x2="10" y2="14"></line>
                  </svg>
                )}
              </button>
              <button
                className="pip-icon-btn"
                onClick={clearChat}
                title={T('chatClearBtn')}
                aria-label={T('chatClearBtn')}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
              <button
                className="pip-icon-btn pip-close-btn"
                onClick={() => setOpen(false)}
                title={T('chatMinimize')}
                aria-label={T('chatMinimize')}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="pip-chat-messages">
            {messages.map((m) => (
              <div key={m.id} className={`chat-bubble-row ${m.role}`}>
                <div className={`chat-bubble ${m.role} ${m.isError ? 'error-bubble' : ''}`}>
                  <div className="chat-text">
                    <FormattedText text={m.content} />
                  </div>

                  {/* Route action card */}
                  {m.routeAction && (
                    <div className="route-action-card">
                      <div className="route-action-info">
                        <span className="route-action-badge">{T('chatSuggestedRoute')}</span>
                        <div className="route-action-names">
                          <strong>{m.routeAction.from}</strong> → <strong>{m.routeAction.to}</strong>
                        </div>
                      </div>
                      <button
                        className="route-action-btn"
                        onClick={() => onApplyRoute && onApplyRoute(m.routeAction)}
                      >
                        {T('chatApplyRoute')} <span>→</span>
                      </button>
                    </div>
                  )}

                  <span className="chat-time">{m.timestamp}</span>
                </div>
              </div>
            ))}

            {loading && (
              <div className="chat-bubble-row assistant">
                <div className="chat-bubble assistant typing-bubble">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <small>{T('chatThinking')}</small>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          {messages.length <= 2 && (
            <div className="pip-quick-prompts">
              {quickPrompts.map((q, idx) => (
                <button key={idx} className="quick-prompt-chip" onClick={() => sendMessage(q)}>
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input Area */}
          <div className="pip-chat-input-row">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={T('aiPlaceholder')}
              disabled={loading}
              aria-label={T('aiPlaceholder')}
            />
            <button
              className="chat-send-btn"
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              title={T('chatSendBtn')}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Render inline formatting (bold, italic, code).
 */
function renderInlineFormatting(text = '') {
  if (!text) return text;

  // Split bold (**...**), italic (*...*), and code (`...`)
  const tokens = [];
  let remaining = text;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/^(\*\*([^*]+)\*\*)/);
    const codeMatch = remaining.match(/^(`([^`]+)`)/);
    const italicMatch = remaining.match(/^(\*([^*]+)\*)/);

    if (boldMatch) {
      tokens.push(<strong key={tokens.length}>{boldMatch[2]}</strong>);
      remaining = remaining.slice(boldMatch[1].length);
    } else if (codeMatch) {
      tokens.push(<code key={tokens.length} className="chat-inline-code">{codeMatch[2]}</code>);
      remaining = remaining.slice(codeMatch[1].length);
    } else if (italicMatch) {
      tokens.push(<em key={tokens.length}>{italicMatch[2]}</em>);
      remaining = remaining.slice(italicMatch[1].length);
    } else {
      // Find nearest special token
      const nextSpecial = remaining.search(/(\*\*|`|\*)/);
      if (nextSpecial === -1) {
        tokens.push(remaining);
        break;
      } else if (nextSpecial === 0) {
        tokens.push(remaining[0]);
        remaining = remaining.slice(1);
      } else {
        tokens.push(remaining.slice(0, nextSpecial));
        remaining = remaining.slice(nextSpecial);
      }
    }
  }

  return tokens;
}

/**
 * Parse markdown into structured block elements (tables, headings, lists, paragraphs).
 */
function parseMarkdownBlocks(text = '') {
  // Clean any raw route_action blocks or code wrappers before rendering
  const cleanedText = (text || '')
    .replace(/(?:```|`|\b)?\s*route_action:\s*\{[^}]+\}\s*(?:```|`|\b)?/gi, '')
    .replace(/```(?:json)?\s*\{[^{}]*"from"[^{}]*"to"[^{}]*\}\s*```/gi, '')
    .replace(/`\s*\{[^{}]*"from"[^{}]*"to"[^{}]*\}\s*`/gi, '')
    .trim();

  const lines = cleanedText.split('\n');
  const blocks = [];
  let currentTable = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Check if line is a table row (has pipe separators)
    const hasPipes = trimmed.includes('|') && trimmed.split('|').length >= 3;

    if (hasPipes) {
      // Check if it's a markdown separator line like |---|---|
      const isSeparator = /^\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/.test(trimmed);

      if (isSeparator) {
        if (currentTable) {
          currentTable.hasSeparator = true;
        }
        continue;
      }

      // Extract cells
      let rawCells = trimmed.split('|');
      if (trimmed.startsWith('|')) rawCells.shift();
      if (trimmed.endsWith('|')) rawCells.pop();
      const cells = rawCells.map((c) => c.trim());

      if (!currentTable) {
        currentTable = {
          type: 'table',
          header: cells,
          rows: [],
        };
      } else {
        currentTable.rows.push(cells);
      }
      continue;
    }

    // If we were inside a table and reached a non-table line, commit it
    if (currentTable) {
      blocks.push(currentTable);
      currentTable = null;
    }

    if (!trimmed) {
      blocks.push({ type: 'space' });
      continue;
    }

    // Check for headings
    if (trimmed.startsWith('### ')) {
      blocks.push({ type: 'h3', content: trimmed.slice(4) });
    } else if (trimmed.startsWith('## ')) {
      blocks.push({ type: 'h2', content: trimmed.slice(3) });
    } else if (trimmed.startsWith('# ')) {
      blocks.push({ type: 'h1', content: trimmed.slice(2) });
    } else if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      blocks.push({ type: 'bullet', content: trimmed.replace(/^[•\-*]\s+/, '') });
    } else if (/^\d+\.\s+/.test(trimmed)) {
      const match = trimmed.match(/^(\d+)\.\s+(.*)$/);
      blocks.push({ type: 'numbered', num: match[1], content: match[2] });
    } else {
      blocks.push({ type: 'paragraph', content: trimmed });
    }
  }

  if (currentTable) {
    blocks.push(currentTable);
  }

  return blocks;
}

/**
 * Render structured markdown content with table support.
 */
function FormattedText({ text = '' }) {
  const blocks = parseMarkdownBlocks(text);

  return (
    <div className="formatted-content">
      {blocks.map((block, bIdx) => {
        if (block.type === 'space') {
          return <div key={bIdx} className="content-space" />;
        }

        if (block.type === 'table') {
          return (
            <div key={bIdx} className="chat-table-wrapper">
              <table className="chat-table">
                {block.header && block.header.length > 0 && (
                  <thead>
                    <tr>
                      {block.header.map((th, hIdx) => (
                        <th key={hIdx}>{renderInlineFormatting(th)}</th>
                      ))}
                    </tr>
                  </thead>
                )}
                {block.rows && block.rows.length > 0 && (
                  <tbody>
                    {block.rows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx}>{renderInlineFormatting(cell)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                )}
              </table>
            </div>
          );
        }

        if (block.type === 'h1' || block.type === 'h2') {
          return (
            <h4 key={bIdx} className="chat-heading">
              {renderInlineFormatting(block.content)}
            </h4>
          );
        }

        if (block.type === 'h3') {
          return (
            <h5 key={bIdx} className="chat-subheading">
              {renderInlineFormatting(block.content)}
            </h5>
          );
        }

        if (block.type === 'bullet') {
          return (
            <div key={bIdx} className="content-bullet">
              <span className="bullet-dot">•</span>
              <span className="bullet-text">{renderInlineFormatting(block.content)}</span>
            </div>
          );
        }

        if (block.type === 'numbered') {
          return (
            <div key={bIdx} className="content-bullet numbered">
              <span className="numbered-badge">{block.num}.</span>
              <span className="bullet-text">{renderInlineFormatting(block.content)}</span>
            </div>
          );
        }

        return (
          <div key={bIdx} className="content-line">
            {renderInlineFormatting(block.content)}
          </div>
        );
      })}
    </div>
  );
}
