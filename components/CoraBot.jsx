import React, { useState } from 'react';

export default function CoraBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: 'Olá! Sou a Cora 🦫, sua assistente da Canal Marketplace! Em que posso ajudar você hoje?',
    },
  ]);
  const [input, setInput] = useState('');

  const quickAnswers = [
    { label: '📦 Rastrear meu pedido', action: () => { window.location.href = '/rastrear'; } },
    { label: '⚡ Como funciona o Pix com 10% OFF?', reply: 'Comprando no Pix, o desconto de 10% é aplicado automaticamente no carrinho e a confirmação é imediata!' },
    { label: '🚚 Qual o prazo de entrega?', reply: 'Enviamos todos os pedidos em até 24 horas úteis via Jadlog ou Correios com seguro total!' },
    { label: '💬 Falar no WhatsApp Oficial', action: () => { window.open('https://wa.me/5519992893859?text=Ol%C3%A1%2C%20Cora!%20Gostaria%20de%20ajuda%20com%20um%20pedido.', '_blank'); } },
  ];

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = input.trim();
    setMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setInput('');

    setTimeout(() => {
      const lower = userMsg.toLowerCase();
      let reply = 'Posso te conectar diretamente com nossa equipe de especialistas pelo WhatsApp (19) 99289-3859 para te atender agora mesmo!';

      if (lower.includes('frete') || lower.includes('entrega')) {
        reply = 'Oferecemos Frete Grátis para todo o Brasil em compras acima de R$ 199! Você também pode simular o frete direto na página de cada produto.';
      } else if (lower.includes('pix') || lower.includes('pagamento') || lower.includes('cartao') || lower.includes('cartão')) {
        reply = 'Aceitamos Pix com 10% de desconto imediato ou cartão de crédito em até 12x sem juros!';
      } else if (lower.includes('rastre') || lower.includes('onde esta') || lower.includes('pedido')) {
        reply = 'Para rastrear sua encomenda, basta acessar nossa página de rastreio informando o número do seu pedido!';
      }

      setMessages((prev) => [...prev, { sender: 'bot', text: reply }]);
    }, 600);
  };

  return (
    <>
      {/* Bot Launcher Button */}
      <button
        type="button"
        className="cora-fab-launcher"
        onClick={() => setIsOpen(!isOpen)}
        title="Falar com a Cora"
        aria-label="Assistente Cora"
      >
        <img src="/imgs/cora/1.png" alt="Cora" className="cora-fab-avatar" />
        <span className="cora-fab-badge">Dúvidas?</span>
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="cora-chat-box">
          <div className="cora-chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img src="/imgs/cora/1.png" alt="Cora" style={{ width: '32px', height: '32px' }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: '14px', color: '#FFF' }}>Cora · Canal Marketplace</div>
                <div style={{ fontSize: '11px', color: '#86EFAC' }}>● Atendimento Online</div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', color: '#FFF', fontSize: '18px', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>

          <div className="cora-chat-body">
            {messages.map((m, idx) => (
              <div key={idx} className={`cora-msg-row ${m.sender === 'user' ? 'cora-msg-user' : 'cora-msg-bot'}`}>
                {m.sender === 'bot' && (
                  <img src="/imgs/cora/1.png" alt="Cora" className="cora-msg-avatar" />
                )}
                <div className="cora-msg-bubble">{m.text}</div>
              </div>
            ))}

            <div style={{ margin: '12px 0 6px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {quickAnswers.map((qa, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (qa.action) qa.action();
                    else if (qa.reply) {
                      setMessages((prev) => [
                        ...prev,
                        { sender: 'user', text: qa.label },
                        { sender: 'bot', text: qa.reply },
                      ]);
                    }
                  }}
                  className="cora-quick-btn"
                >
                  {qa.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSend} className="cora-chat-footer">
            <input
              type="text"
              placeholder="Digite sua dúvida..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="cora-chat-input"
            />
            <button type="submit" className="cora-chat-send-btn">
              Enviar
            </button>
          </form>
        </div>
      )}
    </>
  );
}
