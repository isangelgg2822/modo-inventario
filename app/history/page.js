'use client';

import { useState, useEffect } from 'react';
import { FaHistory } from 'react-icons/fa';
import { createClient } from '@supabase/supabase-js';
import styles from '/app/page.module.css';

const supabase = createClient(
  'https://ubybkfbmszmkfotdkfsg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVieWJrZmJtc3pta2ZvdGRrZnNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxOTk1MTQsImV4cCI6MjA2MTc3NTUxNH0.SeFyqe_bkdwT89gMwS8obrE8oCTs01WsrJXq3izv76Q'
);

export default function History() {
  const [actas, setActas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActas = async () => {
      try {
        const { data, error } = await supabase
          .from('actas')
          .select(`
            id,
            date,
            acta_type,
            assigned_person,
            location,
            id_number,
            exit_from,
            exit_to,
            pdf_path
          `);

        if (error) throw error;
        setActas(data || []);
      } catch (error) {
        console.error('Error fetching actas:', error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchActas();
  }, []);

  return (
    <div className={styles.formContainer}>
      <div className={styles.formWrapper}>
        <header className={styles.formHeader}>
          <h1 className={styles.formHeading}>Historial de Actas</h1>
          <p className={styles.formSubtitle}>Consulta el historial de actas generadas.</p>
          <nav className={styles.formNav}>
            <a href="/">Inicio</a> | <a href="/generate">Generar Acta</a>
          </nav>
        </header>
        <main>
          {loading ? (
            <p className={styles.formSubtitle}>Cargando...</p>
          ) : actas.length === 0 ? (
            <p className={styles.formSubtitle}>No hay actas disponibles.</p>
          ) : (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <FaHistory className={styles.icon} /> Lista de Actas
              </h2>
              {actas.map((acta) => (
                <div key={acta.id} className={styles.field}>
                  <p className={styles.label}>
                    Acta {acta.id} - {acta.date} ({acta.acta_type})
                  </p>
                  <p className={styles.formSubtitle}>
                    Persona: {acta.assigned_person}, Lugar: {acta.location}, Cédula: {acta.id_number}
                    {acta.acta_type === 'exit' && `, Desde: ${acta.exit_from}, Hacia: ${acta.exit_to}`}
                  </p>
                  {acta.pdf_path && (
                    <a
                      href={`https://ubybkfbmszmkfotdkfsg.supabase.co/storage/v1/object/public/actas-pdfs/${acta.pdf_path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.formNav}
                    >
                      Ver PDF
                    </a>
                  )}
                </div>
              ))}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}