'use client';

import styles from '/app/page.module.css';
import { FaFileAlt, FaHistory, FaLaptop, FaChartBar } from 'react-icons/fa';

export default function Home() {
  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <h1 className={styles.heading}>Sistema de Actas</h1>
        <p className={styles.subtitle}>Gestión de actas de asignación y salida</p>
      </header>
      <main className={styles.grid}>
        <a href="/generate" className={styles.card}>
          <FaFileAlt className={styles.icon} />
          <span className={styles.cardText}>Generar Acta</span>
        </a>
        <a href="/history" className={styles.card}>
          <FaHistory className={styles.icon} />
          <span className={styles.cardText}>Historial</span>
        </a>
        <a href="/laptops" className={styles.card}>
          <FaLaptop className={styles.icon} />
          <span className={styles.cardText}>Laptops Asignadas</span>
        </a>
        <a href="/reports" className={styles.card}>
          <FaChartBar className={styles.icon} />
          <span className={styles.cardText}>Reportes</span>
        </a>
      </main>
    </div>
  );
}