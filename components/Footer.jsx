import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-col brand-col">
          <img src="/imgs/canal logo.png" alt="Canal Marketplace" className="footer-logo" />
          <p className="footer-desc">
            Sua distribuidora de confiança com mais de 10 anos de tradição. Produtos originais com nota fiscal,
            garantia de fábrica e envio rápido para todo o Brasil.
          </p>
          <div className="footer-social-links">
            <a href="https://instagram.com/canalmarketplace" target="_blank" rel="noreferrer" aria-label="Instagram">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5"></rect>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"></line>
              </svg>
            </a>
            <a href="https://wa.me/5519992893859" target="_blank" rel="noreferrer" aria-label="WhatsApp">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21"></path>
                <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1"></path>
              </svg>
            </a>
          </div>
        </div>

        <div className="footer-col">
          <h4 className="footer-title">Institucional</h4>
          <ul className="footer-links">
            <li><Link href="/">Página Inicial</Link></li>
            <li><Link href="/loja">Catálogo Completo</Link></li>
            <li><Link href="/rastrear">Rastrear Pedido</Link></li>
            <li><Link href="/suporte">Central de Atendimento</Link></li>
            <li><Link href="/conta">Política de Privacidade (LGPD)</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4 className="footer-title">Categorias</h4>
          <ul className="footer-links">
            <li><Link href="/loja?category=Saúde+%26+Ortopedia">Saúde & Ortopedia</Link></li>
            <li><Link href="/loja?category=Fitness+%26+Pilates">Fitness & Pilates</Link></li>
            <li><Link href="/loja?category=Esportes">Esportes & Futsal</Link></li>
            <li><Link href="/loja?category=Tecnologia+%26+Segurança">Tecnologia & Furukawa</Link></li>
            <li><Link href="/loja?category=Casa+%26+Churrasco">Casa & Cutelaria King</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4 className="footer-title">Atendimento Humanizado</h4>
          <div className="footer-contact-box">
            <p><strong>WhatsApp Oficial:</strong> (19) 99289-3859</p>
            <p><strong>E-mail:</strong> vendas@canaldistribuidora.com.br</p>
            <p><strong>Horário:</strong> Seg a Sex, das 08h às 18h</p>
            <div style={{ marginTop: '12px' }}>
              <span className="badge-verified-seal">🛡️ Compra 100% Segura SSL</span>
            </div>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="container footer-bottom-inner">
          <p>© 2026 Canal Marketplace · Canal Distribuidora LTDA. CNPJ: 11.403.986/0001-67. Campinas/SP.</p>
          <div className="footer-cards-accepted">
            <span>Pix (10% OFF)</span>
            <span>Visa</span>
            <span>Mastercard</span>
            <span>Elo</span>
            <span>Hipercard</span>
            <span>Melhor Envio</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
