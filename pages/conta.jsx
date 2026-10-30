import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function Conta() {
  const [user, setUser] = useState(null);
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const checkAuth = async () => {
    const token = localStorage.getItem('cm.auth_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        localStorage.removeItem('cm.auth_token');
        setUser(null);
      }
    } catch (e) {
      console.warn('Auth check error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao autenticar');

      localStorage.setItem('cm.auth_token', data.token);
      setUser(data.user);
      setMsg('Login efetuado com sucesso!');
      checkAuth();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');

    if (!termsAccepted) {
      setError('É necessário aceitar os Termos e a Política de Privacidade (LGPD).');
      return;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, cpf, phone, termsAccepted }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar');

      localStorage.setItem('cm.auth_token', data.token);
      setUser(data.user);
      setMsg('Conta criada com sucesso com respeito à LGPD!');
      checkAuth();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('cm.auth_token');
    setUser(null);
  };

  const handleDeleteAccount = async () => {
    if (!confirm('ATENÇÃO (LGPD): Deseja realmente excluir permanentemente sua conta e todos os dados associados dos nossos servidores? Esta ação não pode ser desfeita.')) {
      return;
    }

    const token = localStorage.getItem('cm.auth_token');
    try {
      const res = await fetch('/api/auth/delete', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Conta excluída em conformidade com a LGPD.');
        handleLogout();
      } else {
        alert(data.error || 'Falha ao excluir conta.');
      }
    } catch (e) {
      alert('Erro de conexão ao solicitar exclusão.');
    }
  };

  return (
    <>
      <Head>
        <title>Minha Conta & LGPD — Canal Marketplace</title>
      </Head>

      <Header />

      <main style={{ padding: '40px 0 80px', background: '#FAFAFA' }}>
        <div className="container" style={{ maxWidth: '680px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#64748B' }}>
              Carregando dados da conta...
            </div>
          ) : user ? (
            /* Painel do Usuário Logado */
            <div style={{ background: '#FFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '32px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '16px', marginBottom: '24px' }}>
                <div>
                  <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F253C', margin: 0 }}>
                    Olá, {user.name}!
                  </h1>
                  <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: '13.5px' }}>
                    {user.email} {user.cpf && `· CPF: ${user.cpf}`}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  style={{ padding: '8px 16px', background: '#F1F5F9', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', color: '#475569' }}
                >
                  Sair
                </button>
              </div>

              {/* Pedidos do Cliente */}
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F253C', marginBottom: '16px' }}>
                  Meus Pedidos
                </h3>

                {user.orders && user.orders.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {user.orders.map((o) => (
                      <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', border: '1px solid #E2E8F0', borderRadius: '10px' }}>
                        <div>
                          <strong>Pedido #{o.orderNumber}</strong>
                          <div style={{ fontSize: '12px', color: '#64748B' }}>
                            {new Date(o.createdAt).toLocaleDateString('pt-BR')} · R$ {o.total.toFixed(2).replace('.', ',')}
                          </div>
                        </div>
                        <Link href={`/rastrear?id=${o.orderNumber}`} className="hero-secondary-btn" style={{ fontSize: '12px', padding: '6px 14px' }}>
                          Rastrear
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '13.5px', color: '#64748B' }}>Nenhum pedido realizado ainda.</p>
                )}
              </div>

              {/* Seção LGPD */}
              <div style={{ background: '#FFF7ED', border: '1px solid #FFEDD5', borderRadius: '12px', padding: '20px', marginTop: '24px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#9A3412', margin: '0 0 8px' }}>
                  🛡️ Privacidade & LGPD (Lei Geral de Proteção de Dados)
                </h4>
                <p style={{ fontSize: '13px', color: '#7C2D12', lineHeight: 1.5, margin: '0 0 16px' }}>
                  Seus dados estão protegidos com criptografia de ponta e são utilizados unicamente para faturamento
                  fiscal e entrega dos seus pedidos. Você possui total controle e pode solicitar a exclusão definitiva
                  da sua conta a qualquer momento.
                </p>
                <button
                  onClick={handleDeleteAccount}
                  style={{ padding: '8px 16px', background: '#DC2626', color: '#FFF', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' }}
                >
                  Excluir Minha Conta Permanentemente
                </button>
              </div>
            </div>
          ) : (
            /* Formulário de Login / Cadastro */
            <div style={{ background: '#FFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '36px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid #F1F5F9', paddingBottom: '16px' }}>
                <button
                  onClick={() => setIsRegister(false)}
                  style={{ flex: 1, padding: '10px', background: !isRegister ? '#0F253C' : '#F1F5F9', color: !isRegister ? '#FFF' : '#334155', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer' }}
                >
                  Entrar
                </button>
                <button
                  onClick={() => setIsRegister(true)}
                  style={{ flex: 1, padding: '10px', background: isRegister ? '#0F253C' : '#F1F5F9', color: isRegister ? '#FFF' : '#334155', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer' }}
                >
                  Criar Conta
                </button>
              </div>

              {msg && <div style={{ background: '#DCFCE7', color: '#166534', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px', fontWeight: 700 }}>{msg}</div>}
              {error && <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px', fontWeight: 700 }}>{error}</div>}

              {isRegister ? (
                <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>Nome Completo</label>
                    <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" style={{ width: '100%', padding: '10px 12px', border: '1px solid #CBD5E1', borderRadius: '6px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>E-mail</label>
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" style={{ width: '100%', padding: '10px 12px', border: '1px solid #CBD5E1', borderRadius: '6px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>Senha</label>
                    <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" style={{ width: '100%', padding: '10px 12px', border: '1px solid #CBD5E1', borderRadius: '6px' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>CPF</label>
                      <input type="text" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" style={{ width: '100%', padding: '10px 12px', border: '1px solid #CBD5E1', borderRadius: '6px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>WhatsApp</label>
                      <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(19) 99999-9999" style={{ width: '100%', padding: '10px 12px', border: '1px solid #CBD5E1', borderRadius: '6px' }} />
                    </div>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12.5px', color: '#475569', marginTop: '6px', cursor: 'pointer' }}>
                    <input type="checkbox" required checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} style={{ marginTop: '3px' }} />
                    <span>Concordo expressamente com os <strong>Termos de Uso</strong> e <strong>Política de Privacidade (LGPD)</strong> da Canal Marketplace.</span>
                  </label>

                  <button type="submit" className="hero-cta-btn" style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}>
                    Cadastrar e Salvar
                  </button>
                </form>
              ) : (
                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>E-mail</label>
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" style={{ width: '100%', padding: '10px 12px', border: '1px solid #CBD5E1', borderRadius: '6px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>Senha</label>
                    <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Sua senha" style={{ width: '100%', padding: '10px 12px', border: '1px solid #CBD5E1', borderRadius: '6px' }} />
                  </div>
                  <button type="submit" className="hero-cta-btn" style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}>
                    Acessar Conta
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
