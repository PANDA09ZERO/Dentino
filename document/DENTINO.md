# DENTINO



## Requerimientos funcionales:

* ##### Gestión de pacientes:

  * Registrar(nombre, edad, apellido, DNI, dirección, teléfono)
  * búsqueda por: nombre, apellido, DNI, dirección, teléfono
  * editar
  * eliminar de manera lógica(sin borrar de la DB)



* ##### Gestión de usuarios:

  * Registrar(nombre, apellido, DNI, dirección, teléfono, correo, contraseña)
  * búsqueda por: nombre, apellido, DNI, dirección, teléfono
  * editar
  * eliminar de manera lógica(sin borrar de la DB)
  * determinar su rol(admin, recepcionista, doctor)
  * de ser doctor elegir su especialización(q se podrá agregar por computadora)
  * doctores externos elegir su especialización(q se podrá agregar por computadora)
  * turno(mañana, tarde y noche)
  * estado(activo=1, inactivo=0)



* ##### Gestión de citas:

  * Registrar: paciente, fecha, hora, motivo, doctor, recepcionista
  * editar
  * cancelar
  * agregar estado de la cita(atendido, confirmado, cancelado)
* ##### gestión de gastos:

  * facturación; registrar: boleta o factura, recepcionista, fecha, hora, monto total(agregando los del plan de  tratamiento)
  * consultar boleta o factura según cliente o fecha
  * registro de caja(otorgar permiso a recepcionista): registrar pagos al contador, empleados, sunat, teléfono, internet, laboratorios etc; mostrar ingresos y egresos(con los todos los gastos e ingresos que figuran en el sistema)
  * editar(solo con código de verificación de un admin)
  * eliminar(está para ver si será posible)
  * adicionalmente agregar una manera de solo ciertas boletas o facturas se registren en la sunat
* ##### Antecedentes médicos:

  * registrar info sobre tratamientos médicos del paciente en otras clínicas(solo de ser necesario)
  * agregar (de necesitar algún tratamiento según doctor a cargo(con su pin))
  * editar(con pin de admin o doctor)
* ##### diagnósticos:

  * registrar: según paciente y doctor, fecha, hora
  * mostrar: según paciente y doctor, fecha, hora
  * editar



* ##### exámenes auxiliares:

  * registrar: según paciente y doctor, fecha, hora
  * mostrar: según paciente y doctor, fecha, hora
  * editar



* ##### plan de tratamiento:

  * agregar una lista de tratamientos con precios
  * registrar un plan de tratamiento registrando: paciente, doctor, fecha, hora
  * modificar de ser necesario
  * ver plan de tratamiento anterior del paciente 
* ##### evaluación del cliente:

  * registrar y actualizar EV con : paciente, doctor, fecha, hora, estado del paciente(comentario de si va mejorando o necesita algo mas), avances del tratamiento
  * validar evaluación con una firma digital o pin de doctor
* ##### Distribuidores:

  * registrar y editar(editar solo con pin de admin): empresa, teléfono, correo(si es q tiene), dirección
  * eliminar(solo con pin de un admin)
* ##### inventario:

  * registrar y editar(editar solo con pin de admin): nombre del insumo, categoría(que se pueda agregar por computadora y hacer una lista de categorías para usar) , tipo(que se pueda agregar por computadora y hacer una lista de categorías para usar) , cantidad, precio unitario, distribuidor, fecha de ingreso, fecha de vencimiento, estado(Disponible, agotado, por agotarse, por vencer, vencido)
  * eliminar(solo con pin de un admin)
* ##### laboratorios:

  * registrar y editar(editar solo con pin de admin): nombre afiliado, dirección, teléfono, correro(de tener),servicio, costo

&#x20;

