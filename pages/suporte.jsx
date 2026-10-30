import React, { useState } from 'react';
import Head from 'next/head';
import Header from '../components/Header';
import Footer from '../components/Footer';
import CoraBot from '../components/CoraBot';

export default function Suporte() {
  const [openFaq, setOpenFaq] = useState(null);

  const faqs = [
    {
      q: 'Comprei pelo Mercado Livre ou outro marketplace, como peço ajuda aqui?',
      a: 'Basta nos chamar diretamente no WhatsApp (19) 99289-3859 informando o número da sua compra ou CPF. Nós resolvemos qualquer problema de envio, troca ou dúvida em minutos sem você precisar abrir reclamação demorada no marketplace!',
    },
    {
      q: 'Os produtos possuem garantia?',
      a: 'Sim! Todos os nossos produtos são 100% originais, acompanham nota fiscal emitida pela Canal Distribuidora LTDA e contam com garantia legal de 90 dias com reposição imediata.',
    },
    {
      q: 'Como funciona a entrega com o Melhor Envio?',
      a: 'Trabalhamos com integração direta ao Melhor Envio, permitindo despachar suas encomendas com seguro total via Jadlog e Correios (SEDEX e PAC). Compras acima de R$ 199 possuem opção de Frete Grátis!',
    },
    {
      q: 'Qual o prazo de envio após a confirmação do pagamento?',
      a: 'Pedidos aprovados até as 13h são separados e despachados no mesmo dia útil! Pagamentos via Pix são aprovados imediatamente.',
    },
  ];

  return (
    <>
      <Head>
        <title>Central de Atendimento & Suporte — Canal Marketplace</title>
      </Head>

      <Header />

      <main style={{ padding: '40px 0 80px', background: '#FAFAFA' }}>
        <div className="container" style={{ maxWidth: '840px' }}>
          {/* Banner de Resolução Rápida */}
          <div style={{ background: 'linear-gradient(135deg, #0F253C 0%, #1E3A5F 100%)', borderRadius: '20px', padding: '36px', color: '#FFF', textAlign: 'center', marginBottom: '40px', boxShadow: '0 8px 30px rgba(15,37,60,0.15)' }}>
            <img src="/imgs/cora/3.png" alt="Cora Suporte" style={{ width: '110px', margin: '0 auto 16px' }} />
            <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#FFB800' }}>
              Atendimento Humanizado Canal
            </span>
            <h1 style={{ fontSize: '28px', fontWeight: 900, margin: '8px 0 12px', lineHeight: 1.2 }}>
              Antes de abrir reclamação, fale com a gente!
            </h1>
            <p style={{ color: '#E2E8F0', fontSize: '15px', maxWidth: '600px', margin: '0 auto 24px', lineHeight: 1.6 }}>
              Resolvemos trocas, devoluções, atrasos e dúvidas técnicas em poucos minutos pelo nosso canal oficial no WhatsApp.
            </p>
            <a
              href="https://wa.me/5519992893859?text=Ol%C3%A1%2C%20Canal!%20Preciso%20de%20ajuda%20com%20um%20pedido."
              target="_blank"
              rel="noreferrer"
              className="hero-cta-btn"
              style={{ display: 'inline-flex', padding: '14px 28px', fontSize: '16px' }}
            >
              💬 Falar no WhatsApp: (19) 99289-3859
            </a>
          </div>

          {/* FAQ Accordion */}
          <div style={{ background: '#FFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '32px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0F253C', marginBottom: '20px' }}>
              Perguntas Frequentes (FAQ)
            </h2>

            {faqs.map((f, idx) => (
              <div key={idx} style={{ borderBottom: idx < faqs.length - 1 ? '1px solid #F1F5F9' : 'none', padding: '16px 0' }}>
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '15.5px', fontWeight: 700, color: '#0F253C', cursor: 'pointer' }}
                >
                  <span>{f.q}</span>
                  <span style={{ fontSize: '18px', color: '#94A3B8' }}>{openFaq === idx ? '−' : '+'}</span>
                </button>
                {openFaq === idx && (
                  <p style={{ margin: '12px 0 0', fontSize: '14px', lineHeight: 1.6, color: '#475569' }}>
                    {f.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
      <CoraBot />
    </>
  );
}
