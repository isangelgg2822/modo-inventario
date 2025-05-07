'use client';

import { useState, useRef, useEffect } from 'react';
import { FaCalendarAlt, FaUser, FaMapMarkerAlt, FaIdCard, FaArrowUp, FaArrowDown, FaPlus, FaFileSignature, FaEye, FaEraser } from 'react-icons/fa';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { createClient } from '@supabase/supabase-js';
import styles from '/app/page.module.css';


const supabase = createClient(
  'https://ubybkfbmszmkfotdkfsg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVieWJrZmJtc3pta2ZvdGRrZnNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxOTk1MTQsImV4cCI6MjA2MTc3NTUxNH0.SeFyqe_bkdwT89gMwS8obrE8oCTs01WsrJXq3izv76Q'
);

export default function Generate() {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0], // Valor inicial para la fecha
    assignedPerson: '',
    location: 'MoDo CARACAS',
    items: [{ serial: '', description: '', quantity: '' }],
    deliverer: '',
    receiver: '',
    areaResponsible: '',
    idNumber: '',
    exitTo: '',
    exitFrom: '',
  });

  const [actaType, setActaType] = useState('assignment');
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const modalRef = useRef(null);
  const firstInputRef = useRef(null);

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showPreview) {
        setShowPreview(false);
      }
    };

    if (showPreview) {
      document.addEventListener('keydown', handleKeyDown);
      modalRef.current?.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showPreview]);

  const handleInputChange = (e, index = null, field = null) => {
    if (index !== null && field) {
      const newItems = [...formData.items];
      newItems[index][field] = e.target.value;
      setFormData({ ...formData, items: newItems });
    } else {
      setFormData({ ...formData, [e.target.name]: e.target.value });
    }
    setErrors({});
  };

  const addItem = () => {
    const lastItem = formData.items[formData.items.length - 1];
    if (!lastItem.description || !lastItem.quantity || parseInt(lastItem.quantity) <= 0) {
      setErrors({ items: 'Por favor completa la descripción y una cantidad válida del último equipo antes de agregar otro.' });
      return;
    }
    setFormData({
      ...formData,
      items: [...formData.items, { serial: '', description: '', quantity: '' }],
    });
    setErrors({});
  };

  const removeItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
    setErrors({});
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.date) newErrors.date = 'La fecha es obligatoria.';
    if (!formData.assignedPerson) newErrors.assignedPerson = 'La persona asignada es obligatoria.';
    if (!formData.idNumber) newErrors.idNumber = 'La cédula de identidad es obligatoria.';
    if (formData.items.length === 0 || formData.items.every(item => !item.description || !item.quantity || parseInt(item.quantity) <= 0)) {
      newErrors.items = 'Debe haber al menos un equipo con descripción y cantidad válida (mayor a 0).';
    }
    if (actaType === 'exit') {
      if (!formData.exitFrom) newErrors.exitFrom = 'El campo "Desde" es obligatorio para actas de salida.';
      if (!formData.exitTo) newErrors.exitTo = 'El campo "Hacia" es obligatorio para actas de salida.';
    }
    return newErrors;
  };

  const saveToSupabase = async () => {
    try {
      const actaData = {
        acta_type: actaType,
        date: formData.date,
        assigned_person: formData.assignedPerson,
        location: formData.location,
        id_number: formData.idNumber,
        exit_from: actaType === 'exit' ? formData.exitFrom : null,
        exit_to: actaType === 'exit' ? formData.exitTo : null,
      };

      const { data: acta, error: actaError } = await supabase
        .from('actas')
        .insert([actaData])
        .select()
        .single();

      if (actaError) throw new Error(`Error al guardar el acta: ${actaError.message}`);

      const actaId = acta.id;

      const itemsData = formData.items
        .filter(item => item.description && item.quantity && parseInt(item.quantity) > 0)
        .map(item => ({
          acta_id: actaId,
          serial: item.serial || null,
          description: item.description,
          quantity: parseInt(item.quantity, 10),
        }));

      if (itemsData.length > 0) {
        const { error: itemsError } = await supabase
          .from('items')
          .insert(itemsData);

        if (itemsError) throw new Error(`Error al guardar los ítems: ${itemsError.message}`);
      }

      const firmasData = {
        acta_id: actaId,
        deliverer: formData.deliverer || null,
        receiver: formData.receiver || null,
        area_responsible: formData.areaResponsible || null,
      };

      const { error: firmasError } = await supabase
        .from('firmas')
        .insert([firmasData]);

      if (firmasError) throw new Error(`Error al guardar las firmas: ${firmasError.message}`);

      console.log('Acta guardada con ID:', actaId); // Depuración
      return actaId;
    } catch (error) {
      setErrors({ supabase: error.message });
      setIsLoading(false);
      return null;
    }
  };

  const generateAndUploadPDF = async (actaId) => {
    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.setFont('times', 'bold');
      doc.setFontSize(14);

      const boxX = 32;
      const boxY = 10;
      const boxWidth = 237;
      const boxHeight = 30;

      doc.setLineWidth(0.5);
      doc.rect(boxX, boxY, boxWidth, boxHeight);

      const logoWidth = 40;
      const logoHeight = 20;
      const logoX = boxX + 5;
      const logoY = boxY + 5;

      // Manejar el logo de forma segura
      try {
        const imgData = '/logo.png';
        doc.addImage(imgData, 'PNG', logoX, logoY, logoWidth, logoHeight);
      } catch (error) {
        console.warn('No se pudo cargar el logo, asegúrate de que "/logo.png" esté disponible:', error.message);
        doc.setFontSize(12);
        doc.text('Logo no disponible', logoX, logoY + 10);
      }

      const title = actaType === 'assignment' ? 'ACTA DE ASIGNACIÓN DE EQUIPOS' : 'ACTA DE SALIDA DE EQUIPOS';
      const subtitle = 'CORPORACIÓN MODO CARACAS, C.A';
      const textX = logoX + logoWidth + 10;
      const textY = logoY + 5;

      doc.setFontSize(14);
      doc.text(title, textX, textY);
      doc.setFontSize(12);
      doc.text(subtitle, textX, textY + 8);

      doc.setFont('times', 'normal');
      doc.setFontSize(12);
      doc.autoTable({
        startY: boxY + boxHeight + 10,
        body: [
          ['Fecha:', formData.date],
          ['Persona Asignada:', formData.assignedPerson],
          ['Lugar:', formData.location],
        ],
        theme: 'grid',
        styles: { font: 'times', fontSize: 11, cellPadding: 1, lineHeight: 0.5, textColor: [0, 0, 0] },
        headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 45 },
          1: { cellWidth: 150 },
        },
        margin: { left: 32 },
      });

      // Filtrar ítems válidos para la tabla
      const validItems = formData.items.filter(item => item.description && item.quantity && parseInt(item.quantity) > 0);
      if (validItems.length === 0) {
        throw new Error('No hay ítems válidos para incluir en el PDF.');
      }

      doc.autoTable({
        startY: doc.lastAutoTable.finalY + 10,
        head: [['SERIE O REFERENCIA DEL EQUIPO', 'DESCRIPCIÓN', 'CANTIDAD']],
        body: validItems.map(item => [item.serial || '', item.description, item.quantity]),
        theme: 'grid',
        styles: { font: 'times', fontSize: 11, cellPadding: 3, textColor: [0, 0, 0] },
        headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
        columnStyles: {
          0: { cellWidth: 60, halign: 'center' },
          1: { cellWidth: 120, halign: 'center' },
          2: { cellWidth: 30, halign: 'center' },
        },
        margin: { left: 48.5 },
      });

      let declaration = '';
      if (actaType === 'assignment') {
        declaration = `Yo, _______________________________, titular de la cédula de identidad Nro. ${formData.idNumber}, declaro haber recibido mediante la presente Acta, los equipos mencionados en este documento en perfectas condiciones de operatividad, los cuales me comprometo a cuidar y utilizar únicamente en las actividades inherentes a las funciones que me sean asignadas, de igual manera a devolverlos cuando me sean requeridos, en las mismas condiciones de operatividad en que los estoy recibiendo, a tales efectos autorizo a la Corporación MoDo Caracas a que me descuente los equipos que me fueron asignados en caso de no devolverlos al momento que me sean requeridos si no existiere una causa comprobable que lo justifique.`;
      } else {
        declaration = `Yo, __________________________, portador de la cédula de identidad ${formData.idNumber}, autorizo la salida de los equipos mencionados en este documento desde ${formData.exitFrom} hacia ${formData.exitTo} y con mi firma doy fe de que la persona asignada se hará cargo del traslado y cumplirá responsablemente con esta tarea.`;
      }

      doc.setFontSize(11);
      doc.text(declaration, 30, doc.lastAutoTable.finalY + 15, { maxWidth: 237, align: 'justify' });

      const signatureY = doc.lastAutoTable.finalY + 50;
      doc.setFontSize(11);

      doc.text(formData.deliverer || '______________________________', 40, signatureY - 5, { align: 'center' });
      doc.text('______________________________', 40, signatureY, { align: 'center' });
      doc.text('Quien Entrega', 40, signatureY + 10, { align: 'center' });

      doc.text(formData.receiver || '______________________________', 148.5, signatureY - 5, { align: 'center' });
      doc.text('______________________________', 148.5, signatureY, { align: 'center' });
      doc.text('Quien Recibe', 148.5, signatureY + 10, { align: 'center' });

      doc.text(formData.areaResponsible || '______________________________', 257, signatureY - 5, { align: 'center' });
      doc.text('______________________________', 257, signatureY, { align: 'center' });
      doc.text('Responsable del Área', 257, signatureY + 10, { align: 'center' });

      // Generar el PDF y permitir la descarga incluso si la subida falla
      const pdfBlob = doc.output('blob');
      const pdfPath = `acta_${actaId}_${formData.date}.pdf`;

      // Intentar subir el PDF a Supabase Storage
      try {
        const { error: uploadError } = await supabase.storage
          .from('actas-pdfs')
          .upload(pdfPath, pdfBlob, { contentType: 'application/pdf', upsert: true });

        if (uploadError) {
          console.warn('Error al subir el PDF a Supabase, pero el archivo se descargará localmente:', uploadError.message);
        } else {
          const { error: updateError } = await supabase
            .from('actas')
            .update({ pdf_path: pdfPath })
            .eq('id', actaId);

          if (updateError) {
            console.warn('Error al actualizar la ruta del PDF en Supabase, pero el archivo se descargará localmente:', updateError.message);
          }
        }
      } catch (uploadError) {
        console.warn('Error al interactuar con Supabase Storage, pero el archivo se descargará localmente:', uploadError.message);
      }

      // Descargar el PDF localmente
      doc.save(`acta_${actaType}_${formData.date}.pdf`);
    } catch (error) {
      setErrors({ pdf: `Error al generar el PDF: ${error.message}` });
      throw error;
    }
  };

  const generatePDF = async () => {
    setIsLoading(true);
    try {
      const validationErrors = validateForm();
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }

      const actaId = await saveToSupabase();
      if (!actaId) return;

      await generateAndUploadPDF(actaId);
      setShowPreview(false); // Cerrar la vista previa después de generar el PDF
    } catch (error) {
      console.error('Error generating PDF:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreview = () => {
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setShowPreview(true);
  };

  const clearForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      assignedPerson: '',
      location: 'MoDo CARACAS',
      items: [{ serial: '', description: '', quantity: '' }],
      deliverer: '',
      receiver: '',
      areaResponsible: '',
      idNumber: '',
      exitTo: '',
      exitFrom: '',
    });
    setActaType('assignment');
    setErrors({});
    setShowPreview(false);
  };

  return (
    <div className={styles.formContainer}>
      <div className={styles.formWrapper}>
        <header className={styles.formHeader}>
          <h1 className={styles.formHeading}>Generador de Actas</h1>
          <p className={styles.formSubtitle}>Crea actas de asignación y salida de equipos de manera rápida y eficiente.</p>
          <nav className={styles.formNav}>
            <a href="/">Inicio</a> | <a href="/history">Ver Historial de Actas</a>
          </nav>
        </header>
        <main>
          {Object.keys(errors).length > 0 && (
            <div className={styles.errorMessage} role="alert">
              {Object.values(errors).map((error, index) => (
                <p key={index}>{error}</p>
              ))}
            </div>
          )}
          <form className={styles.form}>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <FaMapMarkerAlt className={styles.icon} /> Información General
              </h2>
              <div className={styles.field}>
                <label className={styles.label}>
                  <FaCalendarAlt className={styles.icon} /> Tipo de Acta
                </label>
                <select
                  name="actaType"
                  value={actaType}
                  onChange={(e) => setActaType(e.target.value)}
                  className={styles.select}
                  ref={firstInputRef}
                >
                  <option value="assignment">Asignación</option>
                  <option value="exit">Salida</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>
                  <FaCalendarAlt className={styles.icon} /> Fecha
                </label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>
                  <FaUser className={styles.icon} /> Persona Asignada
                </label>
                <input
                  type="text"
                  name="assignedPerson"
                  value={formData.assignedPerson}
                  onChange={handleInputChange}
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>
                  <FaMapMarkerAlt className={styles.icon} /> Lugar
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>
                  <FaIdCard className={styles.icon} /> Cédula de Identidad
                </label>
                <input
                  type="text"
                  name="idNumber"
                  value={formData.idNumber}
                  onChange={handleInputChange}
                  className={styles.input}
                />
              </div>
              {actaType === 'exit' && (
                <>
                  <div className={styles.field}>
                    <label className={styles.label}>
                      <FaArrowUp className={styles.icon} /> Desde
                    </label>
                    <input
                      type="text"
                      name="exitFrom"
                      value={formData.exitFrom}
                      onChange={handleInputChange}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>
                      <FaArrowDown className={styles.icon} /> Hacia
                    </label>
                    <input
                      type="text"
                      name="exitTo"
                      value={formData.exitTo}
                      onChange={handleInputChange}
                      className={styles.input}
                    />
                  </div>
                </>
              )}
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <FaPlus className={styles.icon} /> Equipos
              </h2>
              {formData.items.map((item, index) => (
                <div key={index} className={styles.itemGrid}>
                  <div>
                    <input
                      type="text"
                      placeholder="Serie/Referencia"
                      value={item.serial}
                      onChange={(e) => handleInputChange(e, index, 'serial')}
                      className={styles.input}
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Descripción"
                      value={item.description}
                      onChange={(e) => handleInputChange(e, index, 'description')}
                      className={styles.input}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      placeholder="Cantidad"
                      value={item.quantity}
                      onChange={(e) => handleInputChange(e, index, 'quantity')}
                      className={styles.input}
                      min="1"
                    />
                    {formData.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className={styles.removeButton}
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addItem}
                className={styles.addButton}
              >
                <FaPlus className={styles.icon} /> Agregar Equipo
              </button>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <FaFileSignature className={styles.icon} /> Firmas
              </h2>
              <div className={styles.field}>
                <label className={styles.label}>
                  <FaUser className={styles.icon} /> Quien Entrega
                </label>
                <input
                  type="text"
                  name="deliverer"
                  value={formData.deliverer}
                  onChange={handleInputChange}
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>
                  <FaUser className={styles.icon} /> Quien Recibe
                </label>
                <input
                  type="text"
                  name="receiver"
                  value={formData.receiver}
                  onChange={handleInputChange}
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>
                  <FaUser className={styles.icon} /> Responsable del Área
                </label>
                <input
                  type="text"
                  name="areaResponsible"
                  value={formData.areaResponsible}
                  onChange={handleInputChange}
                  className={styles.input}
                />
              </div>
            </section>

            <div className={styles.buttonGroup}>
              <button
                type="button"
                onClick={handlePreview}
                disabled={isLoading}
                className={styles.previewButton}
              >
                <FaEye className={styles.icon} /> Vista Previa
              </button>
              <button
                type="button"
                onClick={clearForm}
                disabled={isLoading}
                className={styles.clearButton}
              >
                <FaEraser className={styles.icon} /> Limpiar Formulario
              </button>
            </div>
          </form>

          {showPreview && (
            <div className={styles.modal} role="dialog" ref={modalRef}>
              <div className={styles.modalContent}>
                <h2 className={styles.modalTitle}>Vista Previa del Acta</h2>
                <div className={styles.modalSection}>
                  <h3 className={styles.modalSectionTitle}>{actaType === 'assignment' ? 'ACTA DE ASIGNACIÓN' : 'ACTA DE SALIDA'}</h3>
                  <p><strong>Fecha:</strong> {formData.date}</p>
                  <p><strong>Persona Asignada:</strong> {formData.assignedPerson}</p>
                  <p><strong>Lugar:</strong> {formData.location}</p>
                </div>
                <div className={styles.modalSection}>
                  <h3 className={styles.modalSectionTitle}>Equipos</h3>
                  <table className={styles.modalTable}>
                    <thead>
                      <tr>
                        <th>Serie/Referencia</th>
                        <th>Descripción</th>
                        <th>Cantidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.items.map((item, index) => (
                        <tr key={index}>
                          <td>{item.serial || '-'}</td>
                          <td>{item.description || '-'}</td>
                          <td>{item.quantity || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className={styles.modalSection}>
                  <p className={styles.modalText}>{actaType === 'assignment' ? `Yo, ${formData.assignedPerson}, declaro haber recibido...` : `Yo, ${formData.assignedPerson}, autorizo la salida...`}</p>
                  <div className={styles.modalSignatureGroup}>
                    <div><strong>Quien Entrega:</strong> {formData.deliverer || '_______________'}</div>
                    <div><strong>Quien Recibe:</strong> {formData.receiver || '_______________'}</div>
                    <div><strong>Responsable:</strong> {formData.areaResponsible || '_______________'}</div>
                  </div>
                </div>
                <div className={styles.buttonGroup}>
                  <button
                    onClick={() => setShowPreview(false)}
                    className={styles.closeButton}
                  >
                    Cerrar
                  </button>
                  <button
                    onClick={generatePDF}
                    disabled={isLoading}
                    className={styles.downloadButton}
                  >
                    {isLoading ? 'Generando...' : 'Descargar PDF'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}