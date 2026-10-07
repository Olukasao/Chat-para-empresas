import { ArrowLeft } from 'lucide-react';
import SemiDedicadoCalculator from '../components/SemiDedicadoCalculator';
import { useInternalBack } from '../utils/internalNavigation';
import styles from '../styles/SemiDedicadoCalculatorPage.module.css';

export default function SemiDedicadoCalculatorPage() {
  const voltarPaginaInterna = useInternalBack('/chat');

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <button type="button" className={styles.backButton} onClick={voltarPaginaInterna}>
          <ArrowLeft size={18} />
          Voltar
        </button>

        <SemiDedicadoCalculator />
      </div>
    </main>
  );
}
