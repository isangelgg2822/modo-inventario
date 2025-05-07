'use client';

import { useState, useEffect } from 'react';
import { FaLaptop, FaEye, FaSync, FaSort } from 'react-icons/fa';
import { createClient } from '@supabase/supabase-js';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import styles from '/app/page.module.css';

const supabase = createClient(
  'https://ubybkfbmszmkfotdkfsg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVieWJrZmJtc3pta2ZvdGRrZnNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxOTk1MTQsImV4cCI6MjA2MTc3NTUxNH0.SeFyqe_bkdwT89gMwS8obrE8oCTs01WsrJXq3izv76Q'
);

export default function Laptops() {
  const [laptops, setLaptops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ assignedPerson: '', date: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLaptop, setSelectedLaptop] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
  const itemsPerPage = 10;

  const fetchLaptops = async () => {
    try {
      setLoading(true);

      // 1. Obtener todas las actas con acta_type = 'assignment'
      const { data: actasData, error: actasError } = await supabase
        .from('actas')
        .select('id, date, assigned_person, location, acta_type')
        .eq('acta_type', 'assignment')
        .limit(100);

      if (actasError) {
        console.error('Error fetching actas:', actasError.message);
        throw actasError;
      }

      console.log('Actas obtenidas:', actasData); // Depuración: Verifica las actas

      if (!actasData || actasData.length === 0) {
        console.warn('No se encontraron actas con acta_type = assignment');
        setLaptops([]);
        setLoading(false);
        return;
      }

      // 2. Obtener todos los ítems relacionados con esas actas
      const actaIds = actasData.map(acta => acta.id);
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select('acta_id, serial, description, quantity')
        .in('acta_id', actaIds);

      if (itemsError) {
        console.error('Error fetching items:', itemsError.message);
        throw itemsError;
      }

      console.log('Ítems obtenidos:', itemsData); // Depuración: Verifica los ítems

      // 3. Combinar actas con ítems
      const assignedLaptopsMap = new Map();
      actasData.forEach((acta) => {
        const actaItems = itemsData.filter(item => item.acta_id === acta.id) || [];
        if (actaItems.length === 0) {
          console.warn('Acta sin ítems:', acta);
        }

        actaItems.forEach((item) => {
          const descriptionLower = item.description?.toLowerCase() || '';
          if (descriptionLower.includes('laptop') || descriptionLower.includes('portátil')) {
            const key = item.serial || item.description || acta.id;
            const existing = assignedLaptopsMap.get(key);
            const currentDate = new Date(acta.date || new Date());

            if (!existing || currentDate > new Date(existing.date)) {
              assignedLaptopsMap.set(key, {
                serial: item.serial || '-',
                description: item.description || 'Sin descripción',
                quantity: item.quantity || 1,
                assignedPerson: acta.assigned_person || 'Sin asignar',
                date: acta.date || new Date().toISOString().split('T')[0],
                location: acta.location || 'Sin lugar',
              });
            }
          }
        });
      });

      const assignedLaptops = Array.from(assignedLaptopsMap.values()).sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      );

      console.log('Laptops procesadas:', assignedLaptops); // Depuración: Verifica las laptops generadas
      if (assignedLaptops.length === 0) {
        console.warn('No se encontraron laptops asignadas que cumplan con los criterios.');
      }

      setLaptops(assignedLaptops);
    } catch (error) {
      console.error('Error general fetching laptops:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchLaptopHistory = async (serial) => {
    const { data } = await supabase
      .from('actas')
      .select(`
        date,
        assigned_person,
        location,
        items!inner(serial)
      `)
      .eq('acta_type', 'assignment')
      .eq('items.serial', serial);

    console.log('Historial para serial', serial, ':', data); // Depuración: Verifica el historial
    setSelectedLaptop({ serial, history: data || [] });
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const laptopsToExport = filteredLaptops.length > 0 ? filteredLaptops : laptops;
    if (laptopsToExport.length === 0) {
      doc.text('No hay datos para exportar.', 10, 10);
      doc.save('laptops_asignadas.pdf');
      return;
    }

    doc.autoTable({
      head: [['Persona', 'Descripción del Equipo', 'Número de Serie']],
      body: laptopsToExport.map(l => [l.assignedPerson, l.description, l.serial]),
      styles: { fontSize: 10 },
      headStyles: { fillColor: [173, 216, 230] },
    });
    doc.save('laptops_asignadas.pdf');
  };

  const sortLaptops = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });

    const sortedLaptops = [...laptops].sort((a, b) => {
      if (a[key] < b[key]) return direction === 'ascending' ? -1 : 1;
      if (a[key] > b[key]) return direction === 'ascending' ? 1 : -1;
      return 0;
    });
    setLaptops(sortedLaptops);
  };

  useEffect(() => {
    fetchLaptops();
    const interval = setInterval(fetchLaptops, 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredLaptops = laptops.filter(laptop =>
    (!filters.assignedPerson || laptop.assignedPerson.toLowerCase().includes(filters.assignedPerson.toLowerCase())) &&
    (!filters.date || laptop.date === filters.date)
  );

  const totalPages = Math.ceil(filteredLaptops.length / itemsPerPage);
  const paginatedLaptops = filteredLaptops.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className={styles.formContainer}>
      <div className={styles.formWrapper}>
        <header className={styles.formHeader}>
          <h1 className={styles.formHeading}>Laptops Asignadas</h1>
          <p className={styles.formSubtitle}>Listado de laptops asignadas a empleados.</p>
          <nav className={styles.formNav}>
            <a href="/">Inicio</a> | <a href="/generate">Generar Acta</a> | <a href="/history">Historial de Actas</a>
          </nav>
        </header>
        <main>
          {loading ? (
            <p className={styles.formSubtitle}>Cargando...</p>
          ) : (
            <>
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                  <FaLaptop className={styles.icon} /> Filtros
                </h2>
                <div className={styles.field}>
                  <label className={styles.label}>Filtrar por Persona</label>
                  <input
                    type="text"
                    value={filters.assignedPerson}
                    onChange={(e) => setFilters({ ...filters, assignedPerson: e.target.value })}
                    className={styles.input}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Filtrar por Fecha</label>
                  <input
                    type="date"
                    value={filters.date}
                    onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                    className={styles.input}
                  />
                </div>
              </section>

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                  <FaLaptop className={styles.icon} /> Lista de Laptops Asignadas
                </h2>
                <div className={styles.buttonGroup}>
                  <button onClick={fetchLaptops} className={styles.addButton}>
                    <FaSync className={styles.icon} /> Actualizar Ahora
                  </button>
                  <button onClick={exportToPDF} className={styles.downloadButton}>
                    Exportar a PDF
                  </button>
                </div>
                <div className={styles.modalTable}>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: '33.33%' }} onClick={() => sortLaptops('assignedPerson')}>
                          Persona <FaSort />
                        </th>
                        <th style={{ width: '33.33%' }} onClick={() => sortLaptops('description')}>
                          Descripción del Equipo <FaSort />
                        </th>
                        <th style={{ width: '33.33%' }} onClick={() => sortLaptops('serial')}>
                          Número de Serie <FaSort />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedLaptops.length > 0 ? (
                        paginatedLaptops.map((laptop, index) => (
                          <tr key={index}>
                            <td style={{ wordWrap: 'break-word' }}>{laptop.assignedPerson}</td>
                            <td style={{ wordWrap: 'break-word' }}>{laptop.description}</td>
                            <td style={{ wordWrap: 'break-word' }}>{laptop.serial}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="3" style={{ textAlign: 'center' }}>No hay laptops asignadas.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className={styles.buttonGroup}>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className={styles.addButton}
                  >
                    Anterior
                  </button>
                  <span style={{ fontSize: '1rem', lineHeight: '2rem' }}>
                    Página {currentPage} de {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className={styles.addButton}
                  >
                    Siguiente
                  </button>
                </div>
              </section>
            </>
          )}
          {selectedLaptop && (
            <div className={styles.modal} onClick={() => setSelectedLaptop(null)}>
              <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <h2 className={styles.modalTitle}>Historial de {selectedLaptop.serial}</h2>
                <div className={styles.modalSection}>
                  <table className={styles.modalTable}>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Persona</th>
                        <th>Lugar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedLaptop.history.map((h, i) => (
                        <tr key={i}>
                          <td>{h.date}</td>
                          <td>{h.assigned_person}</td>
                          <td>{h.location}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button onClick={() => setSelectedLaptop(null)} className={styles.closeButton}>
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}