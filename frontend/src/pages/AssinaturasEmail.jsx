import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Mail, ShieldCheck } from 'lucide-react';
import { useInternalBack } from '../utils/internalNavigation';
import styles from '../styles/AssinaturasEmail.module.css';

export default function AssinaturasEmail() {
  const navigate = useNavigate();
  const voltarPaginaInterna = useInternalBack('/chat');

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  return (
    <div className={styles.page}>
      <main className={styles.shell}>
        <button type="button" className={styles.backButton} onClick={voltarPaginaInterna}>
          <ArrowLeft size={18} />
          Voltar
        </button>

        <section className={styles.hero}>
          <span>
            <Mail size={16} />
            Modelos corporativos
          </span>
          <h1>Assinaturas de e-mail</h1>
          <p>
            Modelos editáveis em HTML para Acessa Net, Projecta Empreendimentos e Dias Gestão, prontos para copiar e colar no Gmail, Outlook ou webmail.
          </p>
        </section>

        <section className={styles.infoBox}>
          <ShieldCheck size={24} />
          <p>
            Abra o gerador, escolha a empresa, selecione um membro do chat ou preencha os dados manualmente, envie uma foto profissional e copie a assinatura pronta.
          </p>
        </section>

        <section className={styles.createPanel}>
          <div>
            <strong>Criar assinatura</strong>
            <p>Use um único gerador para Acessa Net, Projecta Empreendimentos e Dias Gestão.</p>
          </div>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => window.open('/email-signatures/index.html', '_blank', 'noopener,noreferrer')}
          >
            Criar assinatura
            <ExternalLink size={16} />
          </button>
        </section>

        <section className={styles.readmeBox}>
          <div>
            <strong>Guia de edição</strong>
            <p>Consulte o README para detalhes sobre Gmail, Outlook, imagens e links preenchidos.</p>
          </div>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => window.open('/email-signatures/README.md', '_blank', 'noopener,noreferrer')}
          >
            Abrir README
          </button>
        </section>
      </main>
    </div>
  );
}
