'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { saveAs } from 'file-saver';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import styles from '/app/page.module.css';
import { FaCalendarAlt, FaFileDownload, FaTable, FaFileExcel } from 'react-icons/fa';

const supabase = createClient(
  'https://ubybkfbmszmkfotdkfsg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVieWJrZmJtc3pta2ZvdGRrZnNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxOTk1MTQsImV4cCI6MjA2MTc3NTUxNH0.SeFyqe_bkdwT89gMwS8obrE8oCTs01WsrJXq3izv76Q'
);

export default function Reports() {
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    category: '',
    actaType: 'all',
  });
  const [reportData, setReportData] = useState([]);
  const [showTable, setShowTable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const fetchReportData = async () => {
    setIsLoading(true);
    try {
      // Paso 1: Consultar todos los ítems
      let itemsQuery = supabase.from('items').select('*');

      if (filters.startDate) itemsQuery = itemsQuery.gte('created_at', filters.startDate);
      if (filters.endDate) itemsQuery = itemsQuery.lte('created_at', filters.endDate);

      const { data: itemsData, error: itemsError } = await itemsQuery;

      if (itemsError) throw new Error(`Error al consultar ítems: ${itemsError.message}`);
      console.log('Ítems crudos:', itemsData);

      if (!itemsData || itemsData.length === 0) {
        throw new Error('No se encontraron ítems en el rango de fechas seleccionado.');
      }

      // Paso 2: Obtener los acta_id únicos de los ítems
      const actaIds = [...new Set(itemsData.map(item => item.acta_id))];
      console.log('acta_id encontrados:', actaIds);

      // Paso 3: Consultar las actas correspondientes
      let actasQuery = supabase.from('actas').select('*').in('id', actaIds);

      if (filters.actaType !== 'all') {
        actasQuery = actasQuery.eq('acta_type', filters.actaType);
      }

      const { data: actasData, error: actasError } = await actasQuery;

      if (actasError) throw new Error(`Error al consultar actas: ${actasError.message}`);
      console.log('Actas crudas:', actasData);

      // Paso 4: Unir ítems con actas manualmente
      const mergedData = actasData.map(acta => ({
        ...acta,
        items: itemsData.filter(item => item.acta_id === acta.id),
      })).filter(acta => acta.items.length > 0);

      console.log('Datos unidos:', mergedData);

      // Paso 5: Aplicar filtro de categoría
      const categoryKeywords = {
        laptops: ['laptop', 'portátil', 'notebook', 'computadora portátil', 'lenovo', 'dell', 'hp'],
        phones: ['telefono', 'teléfono', 'celular', 'phone', 'smartphone'],
        monitors: ['monitor', 'pantalla', 'display', 'screen'],
        lines: ['linea', 'línea', 'line', 'líneas'],
      };

      const filteredData = mergedData.map(acta => ({
        ...acta,
        items: acta.items.filter(item => {
          if (!filters.category) return true;
          const desc = item.description ? item.description.toLowerCase() : '';
          const keywords = categoryKeywords[filters.category] || [];
          return keywords.some(keyword => desc.includes(keyword));
        }),
      })).filter(acta => acta.items.length > 0);

      console.log('Datos filtrados:', filteredData);

      setReportData(filteredData);
      setShowTable(true);
      if (filteredData.length === 0) {
        toast.warn('No se encontraron datos. Verifica las fechas (usando created_at), el tipo de acta, o las descripciones (ejemplo: "laptop", "lenovo").');
      } else {
        toast.success(`Se encontraron ${filteredData.length} actas con ítems que coinciden.`);
      }
    } catch (error) {
      console.error('Error en fetchReportData:', error);
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const generatePDF = () => {
    if (reportData.length === 0) {
      toast.error('No hay datos para generar el reporte.');
      return;
    }

    const doc = new jsPDF();
    doc.setFont('times', 'bold');
    doc.setFontSize(16);
    const categoryText = filters.category ? filters.category.charAt(0).toUpperCase() + filters.category.slice(1) : 'Todos';
    doc.text(`Reporte de ${categoryText}`, 20, 20);

    const totalItems = reportData.reduce((sum, acta) => sum + acta.items.length, 0);
    const totalActas = reportData.length;
    doc.setFontSize(12);
    doc.text(`Total de Actas: ${totalActas}`, 20, 30);
    doc.text(`Total de Ítems: ${totalItems}`, 20, 38);

    doc.autoTable({
      startY: 50,
      head: [['Fecha', 'Tipo de Acta', 'Persona Asignada', 'Descripción', 'Serie', 'Cantidad']],
      body: reportData.flatMap((acta) =>
        acta.items.map((item) => [
          acta.date || acta.created_at || '-',
          acta.acta_type === 'assignment' ? 'Asignación' : 'Salida',
          acta.assigned_person || '-',
          item.description || '-',
          item.serial || '-',
          item.quantity || '1',
        ])
      ),
      theme: 'grid',
      styles: { font: 'times', fontSize: 10, cellPadding: 3, textColor: [0, 0, 0] },
      headStyles: { fillColor: [96, 165, 250], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { cellWidth: 25, halign: 'center' },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 30, halign: 'center' },
        3: { cellWidth: 50, halign: 'center' },
        4: { cellWidth: 30, halign: 'center' },
        5: { cellWidth: 20, halign: 'center' },
      },
    });

    const filename = `reporte_${filters.category || 'todos'}_${filters.startDate}_to_${filters.endDate}.pdf`;
    doc.save(filename);
    toast.success('Reporte PDF generado con éxito.');
  };

  const generateExcel = () => {
    if (reportData.length === 0) {
      toast.error('No hay datos para generar el reporte.');
      return;
    }

    const headers = ['Fecha,Tipo de Acta,Persona Asignada,Descripción,Serie,Cantidad'];
    const rows = reportData.flatMap((acta) =>
      acta.items.map((item) =>
        [
          acta.date || acta.created_at || '-',
          acta.acta_type === 'assignment' ? 'Asignación' : 'Salida',
          acta.assigned_person || '-',
          `"${item.description || '-'}"`,
          item.serial || '-',
          item.quantity || '1',
        ].join(',')
      )
    );

    const csvContent = [...headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const filename = `reporte_${filters.category || 'todos'}_${filters.startDate}_to_${filters.endDate}.csv`;
    saveAs(blob, filename);
    toast.success('Reporte Excel (CSV) generado con éxito.');
  };

  return (
    <div className={styles.formContainer}>
      <ToastContainer position="top-right" autoClose={3000} />
      <div className={styles.formWrapper}>
        <header className={styles.formHeader}>
          <h1 className={styles.formHeading}>Generador de Reportes</h1>
          <p className={styles.formSubtitle}>
            Genera reportes de equipos asignados o dados de salida.
          </p>
          <nav className={styles.formNav}>
            <a href="/">Inicio</a> | <a href="/generate">Generar Acta</a> |{' '}
            <a href="/history">Historial</a>
          </nav>
        </header>
        <main>
          <form className={styles.form}>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <FaCalendarAlt className={styles.icon} /> Filtros del Reporte
              </h2>
              <div className={styles.field}>
                <label className={styles.label}>
                  <FaCalendarAlt className={styles.icon} /> Fecha Inicio
                </label>
                <input
                  type="date"
                  name="startDate"
                  value={filters.startDate}
                  onChange={handleInputChange}
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>
                  <FaCalendarAlt className={styles.icon} /> Fecha Fin
                </label>
                <input
                  type="date"
                  name="endDate"
                  value={filters.endDate}
                  onChange={handleInputChange}
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Categoría</label>
                <select
                  name="category"
                  value={filters.category}
                  onChange={handleInputChange}
                  className={styles.select}
                >
                  <option value="">Todos</option>
                  <option value="laptops">Laptops</option>
                  <option value="phones">Teléfonos</option>
                  <option value="monitors">Monitores</option>
                  <option value="lines">Líneas</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Tipo de Acta</label>
                <select
                  name="actaType"
                  value={filters.actaType}
                  onChange={handleInputChange}
                  className={styles.select}
                >
                  <option value="all">Todas</option>
                  <option value="assignment">Asignación</option>
                  <option value="exit">Salida</option>
                </select>
              </div>
            </section>

            <div className={styles.buttonGroup}>
              <button
                type="button"
                onClick={fetchReportData}
                disabled={isLoading}
                className={styles.previewButton}
              >
                <FaTable className={styles.icon} /> Mostrar Datos
              </button>
            </div>
          </form>

          {showTable && (
            <div className={styles.modalSection}>
              <h3 className={styles.modalSectionTitle}>Vista Previa del Reporte</h3>
              <table className={styles.modalTable}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo de Acta</th>
                    <th>Persona Asignada</th>
                    <th>Descripción</th>
                    <th>Serie</th>
                    <th>Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.flatMap((acta, index) =>
                    acta.items.map((item, itemIndex) => (
                      <tr key={`${index}-${itemIndex}`}>
                        <td>{acta.date || acta.created_at || '-'}</td>
                        <td>{acta.acta_type === 'assignment' ? 'Asignación' : 'Salida'}</td>
                        <td>{acta.assigned_person || '-'}</td>
                        <td>{item.description || '-'}</td>
                        <td>{item.serial || '-'}</td>
                        <td>{item.quantity || '1'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className={styles.buttonGroup}>
                <button onClick={generatePDF} className={styles.downloadButton}>
                  <FaFileDownload className={styles.icon} /> Descargar PDF
                </button>
                <button onClick={generateExcel} className={styles.downloadButton}>
                  <FaFileExcel className={styles.icon} /> Descargar Excel
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}