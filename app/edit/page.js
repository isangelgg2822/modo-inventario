'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { createClient } from '@supabase/supabase-js';
import styles from '../page.module.css';

const supabase = createClient(
    'https://ubybkfbmszmkfotdkfsg.supabase.co', // Reemplaza con tu URL de Supabase
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVieWJrZmJtc3pta2ZvdGRrZnNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxOTk1MTQsImV4cCI6MjA2MTc3NTUxNH0.SeFyqe_bkdwT89gMwS8obrE8oCTs01WsrJXq3izv76Q' // Reemplaza con tu Anon Key
  );

export default function EditActa() {
  const router = useRouter();
  const { id } = router.query;
  const [formData, setFormData] = useState({
    date: '',
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
    if (id) {
      const fetchActa = async () => {
        try {
          const { data, error } = await supabase
            .from('actas')
            .select(`
              *,
              items (serial, description, quantity),
              firmas (deliverer, receiver, area_responsible)
            `)
            .eq('id', id)
            .single();

          if (error) {
            throw new Error(`Error al cargar el acta: ${error.message}`);
          }

          setFormData({
            date: data.date,
            assignedPerson: data.assigned_person,
            location: data.location,
            items: data.items.length > 0 ? data.items : [{ serial: '', description: '', quantity: '' }],
            deliverer: data.firmas.deliverer || '',
            receiver: data.firmas.receiver || '',
            areaResponsible: data.firmas.area_responsible || '',
            idNumber: data.id_number,
            exitTo: data.exit_to || '',
            exitFrom: data.exit_from || '',
          });
          setActaType(data.acta_type);
        } catch (error) {
          setErrors({ fetch: error.message });
        }
      };

      fetchActa();
    }
  }, [id]);

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
    if (!lastItem.description || !lastItem.quantity) {
      setErrors({ items: 'Por favor completa la descripción y cantidad del último equipo antes de agregar otro.' });
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
    if (formData.items.length === 0 || formData.items.every(item => !item.description || !item.quantity)) {
      newErrors.items = 'Debe haber al menos un equipo con descripción y cantidad.';
    }
    if (actaType === 'exit') {
      if (!formData.exitFrom) newErrors.exitFrom = 'El campo "Desde" es obligatorio para actas de salida.';
      if (!formData.exitTo) newErrors.exitTo = 'El campo "Hacia" es obligatorio para actas de salida.';
    }
    return newErrors;
  };

  const updateInSupabase = async () => {
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

      const { error: actaError } = await supabase
        .from('actas')
        .update(actaData)
        .eq('id', id);

      if (actaError) {
        throw new Error(`Error al actualizar el acta: ${actaError.message}`);
      }

      await supabase
        .from('items')
        .delete()
        .eq('acta_id', id);

      const itemsData = formData.items.map(item => ({
        acta_id: id,
        serial: item.serial || null,
        description: item.description,
        quantity: parseInt(item.quantity, 10),
      }));

      const { error: itemsError } = await supabase
        .from('items')
        .insert(itemsData);

      if (itemsError) {
        throw new Error(`Error al actualizar los ítems: ${itemsError.message}`);
      }

      const firmasData = {
        deliverer: formData.deliverer || null,
        receiver: formData.receiver || null,
        area_responsible: formData.areaResponsible || null,
      };

      const { error: firmasError } = await supabase
        .from('firmas')
        .update(firmasData)
        .eq('acta_id', id);

      if (firmasError) {
        throw new Error(`Error al actualizar las firmas: ${firmasError.message}`);
      }

      return true;
    } catch (error) {
      setErrors({ supabase: error.message });
      setIsLoading(false);
      return false;
    }
  };

  const generateAndUploadPDF = async () => {
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
    doc.addImage('/logo.png', 'PNG', logoX, logoY, logoWidth, logoHeight);

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

    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 10,
      head: [['SERIE O REFERENCIA DEL EQUIPO', 'DESCRIPCIÓN', 'CANTIDAD']],
      body: formData.items.map(item => [item.serial || '', item.description, item.quantity]),
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

    const pdfBlob = doc.output('blob');
    const pdfPath = `acta_${id}_${formData.date}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('actas-pdfs')
      .upload(pdfPath, pdfBlob, { contentType: 'application/pdf', upsert: true });

    if (uploadError) {
      throw new Error(`Error al subir el PDF: ${uploadError.message}`);
    }

    const { error: updateError } = await supabase
      .from('actas')
      .update({ pdf_path: pdfPath })
      .eq('id', id);

    if (updateError) {
      throw new Error(`Error al actualizar la ruta del PDF: ${updateError.message}`);
    }

    doc.save(`acta_${actaType}_${formData.date}.pdf`);
  };

  const generatePDF = async () => {
    setIsLoading(true);

    const updated = await updateInSupabase();
    if (!updated) {
      return;
    }

    try {
      await generateAndUploadPDF();
      router.push('/history');
    } catch (error) {
      setErrors({ pdf: error.message });
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
      date: '',
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
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <h1 className={styles.heading1}>Editar Acta</h1>
        <p className={styles.headerSubtitle}>Modifica los datos de la acta seleccionada.</p>
        <nav>
          <a href="/" className={styles.navLink}>Inicio</a> |{' '}
          <a href="/generate" className={styles.navLink}>Generar Nueva Acta</a> |{' '}
          <a href="/history" className={styles.navLink}>Volver al Historial</a>
        </nav>
      </header>
      <main className={styles.container}>
        {Object.keys(errors).length > 0 && (
          <div className={styles.errorBox} role="alert" aria-live="assertive">
            {Object.values(errors).map((error, index) => (
              <p key={index}>{error}</p>
            ))}
          </div>
        )}
        <div className={styles.form}>
          <div className={styles.formSection}>
            <h2 className={styles.sectionTitle}>Información General</h2>
            <label className={styles.formLabel}>
              Tipo de Acta:
              <select
                name="actaType"
                onChange={(e) => setActaType(e.target.value)}
                value={actaType}
                aria-label="Selecciona el tipo de acta"
                ref={firstInputRef}
              >
                <option value="assignment">Asignación</option>
                <option value="exit">Salida</option>
              </select>
            </label>

            <label className={styles.formLabel}>
              Fecha:
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleInputChange}
                aria-label="Fecha del acta"
                aria-required="true"
              />
            </label>

            <label className={styles.formLabel}>
              Persona Asignada:
              <input
                type="text"
                name="assignedPerson"
                value={formData.assignedPerson}
                onChange={handleInputChange}
                aria-label="Nombre de la persona asignada"
                aria-required="true"
              />
            </label>

            <label className={styles.formLabel}>
              Lugar:
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                aria-label="Lugar del acta"
              />
            </label>

            <label className={styles.formLabel}>
              Cédula de Identidad:
              <input
                type="text"
                name="idNumber"
                value={formData.idNumber}
                onChange={handleInputChange}
                aria-label="Cédula de identidad de la persona asignada"
                aria-required="true"
              />
            </label>

            {actaType === 'exit' && (
              <>
                <label className={styles.formLabel}>
                  Desde:
                  <input
                    type="text"
                    name="exitFrom"
                    value={formData.exitFrom}
                    onChange={handleInputChange}
                    aria-label="Lugar de origen para la salida del equipo"
                    aria-required="true"
                  />
                </label>
                <label className={styles.formLabel}>
                  Hacia:
                  <input
                    type="text"
                    name="exitTo"
                    value={formData.exitTo}
                    onChange={handleInputChange}
                    aria-label="Lugar de destino para la salida del equipo"
                    aria-required="true"
                  />
                </label>
              </>
            )}
          </div>

          <div className={styles.formSection}>
            <h2 className={styles.sectionTitle}>Equipos</h2>
            {formData.items.map((item, index) => (
              <div key={index} className={styles.itemRow}>
                <input
                  type="text"
                  placeholder="Serie/Referencia"
                  value={item.serial}
                  onChange={(e) => handleInputChange(e, index, 'serial')}
                  aria-label={`Serie o referencia del equipo ${index + 1}`}
                />
                <input
                  type="text"
                  placeholder="Descripción"
                  value={item.description}
                  onChange={(e) => handleInputChange(e, index, 'description')}
                  aria-label={`Descripción del equipo ${index + 1}`}
                  aria-required="true"
                />
                <input
                  type="number"
                  placeholder="Cantidad"
                  value={item.quantity}
                  onChange={(e) => handleInputChange(e, index, 'quantity')}
                  aria-label={`Cantidad del equipo ${index + 1}`}
                  aria-required="true"
                />
                {formData.items.length > 1 && (
                  <button
                    className={styles.buttonDanger}
                    onClick={() => removeItem(index)}
                    aria-label={`Eliminar equipo ${index + 1}`}
                  >
                    Eliminar
                  </button>
                )}
              </div>
            ))}
            <button
              className={styles.buttonSecondary}
              onClick={addItem}
              aria-label="Agregar un nuevo equipo a la lista"
            >
              Agregar Equipo
            </button>
          </div>

          <div className={styles.formSection}>
            <h2 className={styles.sectionTitle}>Firmas</h2>
            <label className={styles.formLabel}>
              Quien Entrega:
              <input
                type="text"
                name="deliverer"
                value={formData.deliverer}
                onChange={handleInputChange}
                aria-label="Nombre de quien entrega"
              />
            </label>

            <label className={styles.formLabel}>
              Quien Recibe:
              <input
                type="text"
                name="receiver"
                value={formData.receiver}
                onChange={handleInputChange}
                aria-label="Nombre de quien recibe"
              />
            </label>

            <label className={styles.formLabel}>
              Responsable del Área:
              <input
                type="text"
                name="areaResponsible"
                value={formData.areaResponsible}
                onChange={handleInputChange}
                aria-label="Nombre del responsable del área"
              />
            </label>
          </div>

          <div className={styles.formActions}>
            <button
              className={styles.buttonPrimary}
              onClick={handlePreview}
              disabled={isLoading}
              aria-label="Vista previa del acta antes de guardar cambios"
            >
              Vista Previa
            </button>
            <button
              className={styles.buttonSecondary}
              onClick={clearForm}
              disabled={isLoading}
              aria-label="Limpiar todos los campos del formulario"
            >
              Limpiar Formulario
            </button>
          </div>
        </div>

        {showPreview && (
          <div className={styles.modalOverlay} role="dialog" aria-labelledby="modalTitle" tabIndex={-1} ref={modalRef}>
            <div className={styles.modal}>
              <h2 id="modalTitle" className={styles.modalTitle}>
                Vista Previa del Acta
              </h2>
              <div className={styles.previewContent}>
                <div
                  style={{
                    border: '1px solid rgb(169, 169, 169)',
                    width: '210mm',
                    height: '30mm',
                    display: 'flex',
                    alignItems: 'center',
                    margin: '0 auto',
                    padding: '3mm',
                    boxSizing: 'border-box',
                  }}
                >
                  <img
                    src="/logo.png"
                    alt="MoDo Caracas Logo"
                    style={{ width: '60mm', height: '30mm', marginRight: '5mm' }}
                  />
                  <div>
                    <h3 style={{ margin: 0, fontSize: '14pt' }}>
                      {actaType === 'assignment' ? 'ACTA DE ASIGNACIÓN DE EQUIPOS' : 'ACTA DE SALIDA DE EQUIPOS'}
                    </h3>
                    <h4 style={{ margin: '8px 0 0 0', fontSize: '12pt' }}>
                      CORPORACIÓN MODO CARACAS, C.A
                    </h4>
                  </div>
                </div>

                <table className={styles.previewTable} style={{ width: '210mm', marginTop: '10mm' }}>
                  <tbody>
                    <tr style={{ height: '15px' }}>
                      <td style={{ width: '60mm' }}>Fecha:</td>
                      <td style={{ width: '150mm' }}>{formData.date}</td>
                    </tr>
                    <tr style={{ height: '15px' }}>
                      <td style={{ width: '60mm' }}>Persona Asignada:</td>
                      <td style={{ width: '150mm' }}>{formData.assignedPerson}</td>
                    </tr>
                    <tr style={{ height: '15px' }}>
                      <td style={{ width: '60mm' }}>Lugar:</td>
                      <td style={{ width: '150mm' }}>{formData.location}</td>
                    </tr>
                  </tbody>
                </table>

                <table className={`${styles.previewTable} ${styles.equipmentTable}`}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'center' }}>SERIE O REFERENCIA DEL EQUIPO</th>
                      <th style={{ textAlign: 'center' }}>DESCRIPCIÓN</th>
                      <th style={{ textAlign: 'center' }}>CANTIDAD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map((item, index) => (
                      <tr key={index}>
                        <td style={{ textAlign: 'center' }}>{item.serial || '-'}</td>
                        <td style={{ textAlign: 'center' }}>{item.description}</td>
                        <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <p className={styles.previewDeclaration}>
                  {actaType === 'assignment'
                    ? `Yo, _______________________________, titular de la cédula de identidad Nro. ${formData.idNumber}, declaro haber recibido mediante la presente Acta, los equipos mencionados en este documento en perfectas condiciones de operatividad, los cuales me comprometo a cuidar y utilizar únicamente en las actividades inherentes a las funciones que me sean asignadas, de igual manera a devolverlos cuando me sean requeridos, en las mismas condiciones de operatividad en que los estoy recibiendo, a tales efectos autorizo a la Corporación MoDo Caracas a que me descuente los equipos que me fueron asignados en caso de no devolverlos al momento que me sean requeridos si no existiere una causa comprobable que lo justifique.`
                    : `Yo, __________________________, portador de la cédula de identidad ${formData.idNumber}, autorizo la salida de los equipos mencionados en este documento desde ${formData.exitFrom} hacia ${formData.exitTo} y con mi firma doy fe de que la persona asignada se hará cargo del traslado y cumplirá responsablemente con esta tarea.`}
                </p>

                <div className={styles.previewSignatures}>
                  <div className={styles.signature}>
                    <p>{formData.deliverer || '______________________________'}</p>
                    <p>___________________________</p>
                    <p>Quien Entrega</p>
                  </div>
                  <div className={styles.signature}>
                    <p>{formData.receiver || '______________________________'}</p>
                    <p>___________________________</p>
                    <p>Quien Recibe</p>
                  </div>
                  <div className={styles.signature}>
                    <p>{formData.areaResponsible || '______________________________'}</p>
                    <p>___________________________</p>
                    <p>Responsable del Área</p>
                  </div>
                </div>
              </div>
              <div className={styles.modalActions}>
                <button
                  className={styles.buttonSecondary}
                  onClick={() => setShowPreview(false)}
                  aria-label="Cerrar la vista previa"
                >
                  Cerrar
                </button>
                <button
                  className={styles.buttonPrimary}
                  onClick={generatePDF}
                  disabled={isLoading}
                  aria-label="Guardar cambios y descargar el acta en formato PDF"
                >
                  {isLoading ? (
                    <span className={styles.spinner} aria-hidden="true"></span>
                  ) : (
                    'Guardar y Descargar PDF'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}