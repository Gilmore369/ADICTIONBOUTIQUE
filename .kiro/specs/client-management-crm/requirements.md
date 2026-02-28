# Documento de Requerimientos: Gestión Avanzada de Clientes (CRM)

## Introducción

Este documento define los requerimientos funcionales para el sistema de Gestión Avanzada de Clientes (CRM). El sistema extiende las capacidades existentes de gestión de clientes con seguimiento completo del ciclo de vida del cliente, gestión de cobranzas, alertas automáticas, calificación de clientes y análisis de comportamiento. Los requerimientos están escritos siguiendo los patrones EARS (Easy Approach to Requirements Syntax) para garantizar claridad, precisión y verificabilidad.

## Glosario

- **Sistema**: El sistema de Gestión Avanzada de Clientes (CRM)
- **Cliente**: Persona o entidad que realiza compras en el negocio
- **Cliente_Activo**: Cliente con estado active = true
- **Cliente_Inactivo**: Cliente con estado active = false (dado de baja)
- **Perfil_Cliente**: Vista agregada que incluye datos del cliente, historial de compras, créditos, acciones y calificación
- **Calificación_Cliente**: Puntuación de 0-100 y categoría (A, B, C, D) basada en comportamiento de pago
- **Cuota**: Pago individual dentro de un plan de crédito
- **Cuota_Vencida**: Cuota con fecha de vencimiento anterior a la fecha actual y estado PENDING, PARTIAL u OVERDUE
- **Alerta**: Notificación generada automáticamente sobre eventos importantes del cliente
- **Acción_Cobranza**: Registro de gestión de cobranza (llamada, visita, mensaje, etc.)
- **Registro_Acción**: Log de interacción con el cliente (nota, llamada, visita, mensaje, reactivación)
- **Resumen_Crédito**: Agregación de límite de crédito, crédito usado, disponible y deudas
- **Dashboard**: Panel de control con métricas y alertas del sistema
- **Filtro_Cliente**: Criterios de búsqueda para segmentar clientes
- **Exportación**: Generación de archivo CSV con datos de clientes filtrados
- **Puntualidad_Pago**: Porcentaje de cuotas pagadas en o antes de la fecha de vencimiento
- **Frecuencia_Compra**: Número de compras por mes desde la primera compra
- **Usuario**: Persona autenticada que utiliza el sistema

## Requerimientos

### Requerimiento 1: Visualización del Perfil del Cliente

**Historia de Usuario:** Como vendedor, quiero ver el perfil completo de un cliente, para tener toda la información relevante en un solo lugar.

#### Criterios de Aceptación

1. WHEN un Usuario navega al perfil de un Cliente_Activo, THE Sistema SHALL mostrar el Perfil_Cliente completo incluyendo datos personales, Resumen_Crédito, historial de compras, planes de crédito, cuotas pendientes, Registro_Acción y Calificación_Cliente
2. WHEN el Sistema carga un Perfil_Cliente, THE Sistema SHALL obtener todos los datos relacionados en paralelo para optimizar el rendimiento
3. WHEN el Sistema muestra cuotas en el Perfil_Cliente, THE Sistema SHALL ordenarlas por fecha de vencimiento de la más próxima a la más lejana
4. WHEN el Sistema muestra el historial de compras en el Perfil_Cliente, THE Sistema SHALL ordenarlo por fecha de la más reciente a la más antigua
5. WHEN el Sistema calcula el Resumen_Crédito, THE Sistema SHALL incluir crédito disponible (límite - usado), deuda total, deuda vencida, cuotas pendientes y cuotas vencidas
6. WHEN un Usuario intenta acceder al perfil de un cliente inexistente, THE Sistema SHALL mostrar un error 404 con el mensaje "Cliente no encontrado"

### Requerimiento 2: Calificación Automática de Clientes

**Historia de Usuario:** Como administrador, quiero que el sistema califique automáticamente a los clientes, para identificar los mejores y peores pagadores.

#### Criterios de Aceptación

1. WHEN el Sistema calcula la Calificación_Cliente, THE Sistema SHALL generar una puntuación entre 0 y 100 basada en cuatro componentes ponderados
2. WHEN el Sistema calcula la Puntualidad_Pago, THE Sistema SHALL asignar un peso del 40% al componente y calcularlo como el porcentaje de cuotas pagadas en o antes de la fecha de vencimiento
3. WHEN el Sistema calcula la Frecuencia_Compra, THE Sistema SHALL asignar un peso del 30% al componente y calcularlo como compras por mes normalizado a escala 0-100
4. WHEN el Sistema calcula el monto total de compras, THE Sistema SHALL asignar un peso del 20% al componente y normalizarlo a escala 0-100
5. WHEN el Sistema calcula la antigüedad del cliente, THE Sistema SHALL asignar un peso del 10% al componente y calcularlo como días desde la primera compra normalizado a escala 0-100
6. WHEN la puntuación final es mayor o igual a 90, THE Sistema SHALL asignar categoría 'A'
7. WHEN la puntuación final está entre 70 y 89, THE Sistema SHALL asignar categoría 'B'
8. WHEN la puntuación final está entre 50 y 69, THE Sistema SHALL asignar categoría 'C'
9. WHEN la puntuación final es menor a 50, THE Sistema SHALL asignar categoría 'D'
10. WHEN un Cliente no tiene historial de compras o créditos, THE Sistema SHALL asignar una calificación predeterminada de 'C' con puntuación 50
11. WHEN el Sistema actualiza la Calificación_Cliente, THE Sistema SHALL almacenar la fecha y hora del cálculo

### Requerimiento 3: Generación de Alertas Automáticas

**Historia de Usuario:** Como vendedor, quiero recibir alertas automáticas sobre eventos importantes, para gestionar proactivamente a los clientes.

#### Criterios de Aceptación

1. WHEN el Sistema genera alertas, THE Sistema SHALL crear alertas de cuatro tipos: cumpleaños, inactividad, cuota próxima a vencer y cuota vencida
2. WHEN la fecha actual está entre 0 y 7 días antes del cumpleaños de un Cliente_Activo, THE Sistema SHALL generar una Alerta de tipo BIRTHDAY con prioridad MEDIUM
3. WHEN un Cliente_Activo no ha realizado compras en más días que el umbral configurado de inactividad, THE Sistema SHALL generar una Alerta de tipo INACTIVITY con prioridad LOW
4. WHEN una Cuota con estado PENDING o PARTIAL tiene fecha de vencimiento entre 0 y 7 días en el futuro, THE Sistema SHALL generar una Alerta de tipo INSTALLMENT con prioridad MEDIUM
5. WHEN una Cuota con estado PENDING, PARTIAL u OVERDUE tiene fecha de vencimiento anterior a la fecha actual, THE Sistema SHALL generar una Alerta de tipo OVERDUE con prioridad HIGH
6. WHEN el Sistema genera una Alerta, THE Sistema SHALL incluir el ID del cliente, nombre del cliente, mensaje descriptivo, prioridad, fecha de vencimiento (si aplica) y monto pendiente (si aplica)
7. WHEN el Sistema genera alertas múltiples veces en el mismo día, THE Sistema SHALL producir el mismo conjunto de alertas (idempotencia)
8. WHEN el Sistema genera alertas, THE Sistema SHALL asignar un identificador único basado en tipo y entidad para evitar duplicados

### Requerimiento 4: Gestión de Baja de Clientes

**Historia de Usuario:** Como administrador, quiero dar de baja a clientes que ya no operan, para mantener la base de datos actualizada sin perder información histórica.

#### Criterios de Aceptación

1. WHEN un Usuario con permisos de administrador da de baja a un Cliente_Activo, THE Sistema SHALL cambiar el estado del cliente a inactivo (active = false)
2. WHEN el Sistema da de baja a un cliente, THE Sistema SHALL crear un registro en client_deactivations con el motivo, notas, usuario que realizó la acción y fecha
3. WHEN el Sistema da de baja a un cliente, THE Sistema SHALL requerir uno de los siguientes motivos: FALLECIDO, MUDADO, DESAPARECIDO u OTRO
4. WHEN un Cliente_Inactivo intenta realizar una compra, THE Sistema SHALL rechazar la operación
5. WHEN el Sistema da de baja a un cliente, THE Sistema SHALL preservar todo el historial de compras, créditos, cuotas y acciones del cliente
6. WHEN el Sistema da de baja a un cliente, THE Sistema SHALL crear una entrada en el registro de auditoría con los detalles de la operación

### Requerimiento 5: Filtrado Avanzado de Clientes

**Historia de Usuario:** Como vendedor, quiero filtrar clientes por múltiples criterios, para segmentar y gestionar grupos específicos de clientes.

#### Criterios de Aceptación

1. WHEN un Usuario aplica un Filtro_Cliente, THE Sistema SHALL retornar solo los clientes que cumplan TODOS los criterios especificados (lógica AND)
2. WHEN un Usuario filtra por estado de deuda 'MOROSO', THE Sistema SHALL retornar solo clientes con al menos una Cuota_Vencida
3. WHEN un Usuario filtra por estado de deuda 'CON_DEUDA', THE Sistema SHALL retornar solo clientes con credit_used mayor a 0
4. WHEN un Usuario filtra por estado de deuda 'AL_DIA', THE Sistema SHALL retornar solo clientes con credit_used mayor a 0 y sin cuotas vencidas
5. WHEN un Usuario filtra por días sin comprar, THE Sistema SHALL retornar solo clientes cuya diferencia entre la fecha actual y last_purchase_date sea mayor al umbral especificado
6. WHEN un Usuario filtra por calificación, THE Sistema SHALL retornar solo clientes cuya Calificación_Cliente coincida con las categorías seleccionadas
7. WHEN un Usuario filtra por mes de cumpleaños, THE Sistema SHALL retornar solo clientes cuyo mes de nacimiento coincida con el mes especificado
8. WHEN un Usuario filtra por estado 'BAJA', THE Sistema SHALL retornar solo clientes con active = false
9. WHEN un Usuario filtra por motivo de baja, THE Sistema SHALL retornar solo clientes cuyo deactivation_reason coincida con los motivos seleccionados
10. WHEN el Sistema retorna clientes filtrados, THE Sistema SHALL ordenarlos alfabéticamente por nombre

### Requerimiento 6: Dashboard de Métricas

**Historia de Usuario:** Como administrador, quiero ver un dashboard con métricas clave, para monitorear el estado general de la cartera de clientes.

#### Criterios de Aceptación

1. WHEN un Usuario accede al Dashboard, THE Sistema SHALL mostrar el número total de clientes activos
2. WHEN un Usuario accede al Dashboard, THE Sistema SHALL mostrar el número total de clientes dados de baja
3. WHEN un Usuario accede al Dashboard, THE Sistema SHALL mostrar el número de clientes con deuda (credit_used > 0)
4. WHEN un Usuario accede al Dashboard, THE Sistema SHALL mostrar el número de clientes con deuda vencida (al menos una Cuota_Vencida)
5. WHEN un Usuario accede al Dashboard, THE Sistema SHALL mostrar el número de clientes inactivos (sin compras en más días que el umbral configurado)
6. WHEN un Usuario accede al Dashboard, THE Sistema SHALL mostrar el número de clientes con cumpleaños en el mes actual
7. WHEN un Usuario accede al Dashboard, THE Sistema SHALL mostrar el número de acciones de cobranza pendientes
8. WHEN un Usuario accede al Dashboard, THE Sistema SHALL mostrar el monto total de deuda pendiente sumando todas las cuotas no pagadas
9. WHEN un Usuario accede al Dashboard, THE Sistema SHALL mostrar el monto total de deuda vencida sumando todas las Cuota_Vencida
10. WHEN un Usuario accede al Dashboard, THE Sistema SHALL mostrar la lista completa de alertas generadas ordenadas por prioridad (HIGH, MEDIUM, LOW)

### Requerimiento 7: Registro de Acciones del Cliente

**Historia de Usuario:** Como vendedor, quiero registrar todas las interacciones con un cliente, para mantener un historial completo de la relación comercial.

#### Criterios de Aceptación

1. WHEN un Usuario crea un Registro_Acción, THE Sistema SHALL requerir el tipo de acción: NOTA, LLAMADA, VISITA, MENSAJE o REACTIVACION
2. WHEN un Usuario crea un Registro_Acción, THE Sistema SHALL requerir una descripción de texto
3. WHEN el Sistema crea un Registro_Acción, THE Sistema SHALL almacenar el ID del usuario que realizó la acción y la fecha y hora actual
4. WHEN un Usuario visualiza el Perfil_Cliente, THE Sistema SHALL mostrar todos los Registro_Acción ordenados por fecha de la más reciente a la más antigua
5. WHEN un Usuario crea un Registro_Acción de tipo REACTIVACION para un Cliente_Inactivo, THE Sistema SHALL cambiar el estado del cliente a activo (active = true)

### Requerimiento 8: Gestión de Acciones de Cobranza

**Historia de Usuario:** Como cobrador, quiero registrar y dar seguimiento a las acciones de cobranza, para gestionar eficientemente la recuperación de deudas.

#### Criterios de Aceptación

1. WHEN un Usuario crea una Acción_Cobranza, THE Sistema SHALL requerir el cliente asociado, tipo de acción, descripción y fecha de seguimiento
2. WHEN un Usuario crea una Acción_Cobranza, THE Sistema SHALL permitir marcarla como completada o pendiente
3. WHEN un Usuario visualiza el Perfil_Cliente, THE Sistema SHALL mostrar todas las Acción_Cobranza ordenadas por fecha de seguimiento
4. WHEN un Usuario marca una Acción_Cobranza como completada, THE Sistema SHALL actualizar el estado y registrar la fecha de completado
5. WHEN el Dashboard calcula acciones pendientes, THE Sistema SHALL contar solo las Acción_Cobranza con estado pendiente y fecha de seguimiento menor o igual a la fecha actual

### Requerimiento 9: Exportación de Datos

**Historia de Usuario:** Como administrador, quiero exportar datos de clientes filtrados a CSV, para realizar análisis externos o compartir información.

#### Criterios de Aceptación

1. WHEN un Usuario solicita una Exportación con filtros aplicados, THE Sistema SHALL generar un archivo CSV con todos los clientes que cumplan los criterios del Filtro_Cliente
2. WHEN el Sistema genera una Exportación, THE Sistema SHALL incluir las siguientes columnas: nombre, DNI, teléfono, dirección, límite de crédito, crédito usado, deuda total, deuda vencida, calificación, última compra y estado
3. WHEN el Sistema genera una Exportación, THE Sistema SHALL formatear las fechas en formato ISO 8601 (YYYY-MM-DD)
4. WHEN el Sistema genera una Exportación, THE Sistema SHALL formatear los montos con dos decimales
5. WHERE el Usuario no tiene rol 'admin', THE Sistema SHALL enmascarar datos sensibles (DNI completo, teléfono completo) en la Exportación
6. WHEN el Sistema completa una Exportación, THE Sistema SHALL iniciar la descarga del archivo con nombre descriptivo incluyendo fecha y hora

### Requerimiento 10: Validación de Límites de Crédito

**Historia de Usuario:** Como sistema, quiero validar que los clientes activos no excedan su límite de crédito, para mantener la integridad financiera.

#### Criterios de Aceptación

1. WHEN un Cliente_Activo realiza una compra a crédito, THE Sistema SHALL verificar que credit_used más el monto de la nueva compra no exceda credit_limit
2. WHEN la validación de crédito falla, THE Sistema SHALL rechazar la compra y mostrar un mensaje de error indicando el crédito disponible
3. WHEN el Sistema actualiza credit_used después de un pago, THE Sistema SHALL recalcular el crédito disponible
4. WHEN el Sistema calcula el Resumen_Crédito, THE Sistema SHALL garantizar que credit_available sea igual a credit_limit menos credit_used

### Requerimiento 11: Cálculo de Días de Mora

**Historia de Usuario:** Como cobrador, quiero ver cuántos días de mora tiene cada cuota vencida, para priorizar las gestiones de cobranza.

#### Criterios de Aceptación

1. WHEN el Sistema muestra una Cuota con fecha de vencimiento anterior a la fecha actual, THE Sistema SHALL calcular y mostrar los días de mora como la diferencia entre la fecha actual y la fecha de vencimiento
2. WHEN una Cuota tiene fecha de vencimiento futura o igual a la fecha actual, THE Sistema SHALL mostrar días de mora igual a 0
3. WHEN el Sistema ordena cuotas por urgencia, THE Sistema SHALL ordenarlas por días de mora de mayor a menor

### Requerimiento 12: Interfaz de Usuario Responsiva

**Historia de Usuario:** Como usuario, quiero que la interfaz se adapte a diferentes tamaños de pantalla, para poder usar el sistema desde cualquier dispositivo.

#### Criterios de Aceptación

1. WHEN un Usuario accede al Sistema desde un dispositivo móvil, THE Sistema SHALL mostrar una interfaz adaptada con navegación optimizada para pantallas pequeñas
2. WHEN un Usuario accede al Sistema desde una tablet, THE Sistema SHALL mostrar una interfaz adaptada con diseño de grilla de 2 columnas
3. WHEN un Usuario accede al Sistema desde un escritorio, THE Sistema SHALL mostrar una interfaz con diseño de grilla de 3 o más columnas
4. WHEN el Sistema muestra tablas en dispositivos móviles, THE Sistema SHALL permitir desplazamiento horizontal o colapsar columnas no esenciales

### Requerimiento 13: Autorización y Seguridad

**Historia de Usuario:** Como administrador del sistema, quiero que solo usuarios autorizados accedan a funciones sensibles, para proteger la información de los clientes.

#### Criterios de Aceptación

1. WHEN un Usuario intenta acceder a funciones de CRM, THE Sistema SHALL verificar que el usuario tenga rol 'admin' o 'vendedor'
2. WHEN un Usuario sin permisos intenta acceder a funciones de CRM, THE Sistema SHALL mostrar un error 403 y redirigir a la página de inicio
3. WHEN un Usuario intenta dar de baja a un cliente, THE Sistema SHALL verificar que el usuario tenga rol 'admin'
4. WHEN el Sistema almacena o transmite datos de clientes, THE Sistema SHALL usar conexiones seguras (HTTPS/TLS)
5. WHEN el Sistema ejecuta consultas a la base de datos, THE Sistema SHALL usar consultas parametrizadas para prevenir inyección SQL
6. WHEN el Sistema registra cambios sensibles (baja de cliente, cambio de calificación), THE Sistema SHALL crear una entrada en el registro de auditoría con usuario, fecha y detalles de la operación

### Requerimiento 14: Rendimiento y Optimización

**Historia de Usuario:** Como usuario, quiero que el sistema responda rápidamente, para trabajar eficientemente sin esperas prolongadas.

#### Criterios de Aceptación

1. WHEN el Sistema carga un Perfil_Cliente, THE Sistema SHALL completar la carga en menos de 2 segundos para el 95% de los casos
2. WHEN el Sistema aplica filtros a la lista de clientes, THE Sistema SHALL retornar resultados en menos de 1 segundo para el 95% de los casos
3. WHEN el Sistema genera el Dashboard, THE Sistema SHALL completar la carga en menos de 3 segundos para el 95% de los casos
4. WHEN un Usuario modifica filtros de búsqueda, THE Sistema SHALL aplicar debouncing de 300 milisegundos antes de ejecutar la consulta
5. WHEN el Sistema muestra listas de clientes, THE Sistema SHALL implementar paginación con límite inicial de 100 registros
6. WHEN el Sistema accede a métricas del Dashboard, THE Sistema SHALL usar caché con tiempo de vida de 5 minutos

### Requerimiento 15: Manejo de Errores

**Historia de Usuario:** Como usuario, quiero recibir mensajes de error claros cuando algo falla, para entender qué sucedió y cómo proceder.

#### Criterios de Aceptación

1. WHEN ocurre un error de conexión a la base de datos, THE Sistema SHALL mostrar el mensaje "Error de conexión. Intente nuevamente." y reintentar la operación hasta 3 veces con retroceso exponencial
2. WHEN un Usuario proporciona valores inválidos en un formulario, THE Sistema SHALL mostrar mensajes de validación específicos junto a cada campo con error
3. WHEN ocurre un error inesperado, THE Sistema SHALL registrar el error completo en los logs del servidor y mostrar al usuario un mensaje genérico "Ocurrió un error inesperado. Por favor contacte al soporte."
4. WHEN el Sistema no puede calcular la Calificación_Cliente debido a datos faltantes, THE Sistema SHALL registrar una advertencia en los logs y continuar con valores predeterminados
5. WHEN un Usuario intenta realizar una operación no permitida, THE Sistema SHALL mostrar un mensaje explicativo indicando por qué la operación no está permitida
