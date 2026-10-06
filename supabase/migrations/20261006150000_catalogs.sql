-- Catálogos de Severa (MD8 §5): iguales para todos y de solo lectura para la app.
-- Generado desde la bóveda de SeveraOS (neuronas y sinapsis) y los documentos de producto.
-- Neuronas: docs/02 Producto/Mapa de descubrimiento.md · Oficios: Catálogo de oficios v1
-- Feriados 2026: revisar cada año con el calendario oficial · Hábitos: MD5 y F14 sección F.

create table public.neurons (
  code text primary key,
  name text not null,
  hemisphere text not null check (hemisphere in ('personal', 'work', 'bridge')),
  level smallint not null check (level between 0 and 4),
  summary text,
  minimum text,
  sensitive boolean not null default false,
  min_age smallint not null default 14,
  sort_order smallint not null default 0
);

create table public.synapses (
  id uuid primary key default gen_random_uuid(),
  neuron_a text not null references public.neurons (code) on delete cascade,
  neuron_b text not null references public.neurons (code) on delete cascade,
  crosses text,
  confirmed boolean not null default false,
  unique (neuron_a, neuron_b),
  check (neuron_a < neuron_b)
);

create table public.trades (
  code text primary key,
  name text not null,
  icon text,
  main_action text not null,
  tools text[] not null default '{}',
  card_fields jsonb not null default '[]'::jsonb,
  beta_priority smallint,
  status text not null default 'active' check (status in ('active', 'proposed', 'retired')),
  sort_order smallint not null default 0
);

create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  name text not null,
  kind text not null check (kind in ('national', 'regional', 'irrenunciable')),
  region text,
  unique (date, name)
);
create index holidays_date_idx on public.holidays (date);

create table public.habit_templates (
  code text primary key,
  name text not null,
  kind text not null check (kind in ('yes_no', 'counter', 'quantity', 'impulse')),
  unit text,
  direction text not null check (direction in ('good', 'reduce')),
  period text not null check (period in ('day', 'week', 'month')),
  suggested_target numeric,
  min_age smallint not null default 14,
  sort_order smallint not null default 0
);

-- Solo lectura para quien tiene sesión; nadie escribe desde la app.
alter table public.neurons enable row level security;
alter table public.synapses enable row level security;
alter table public.trades enable row level security;
alter table public.holidays enable row level security;
alter table public.habit_templates enable row level security;
revoke all on public.neurons, public.synapses, public.trades, public.holidays, public.habit_templates from anon;
revoke insert, update, delete on public.neurons, public.synapses, public.trades, public.holidays, public.habit_templates from authenticated;
create policy "catálogo: leer" on public.neurons for select to authenticated using (true);
create policy "catálogo: leer" on public.synapses for select to authenticated using (true);
create policy "catálogo: leer" on public.trades for select to authenticated using (true);
create policy "catálogo: leer" on public.holidays for select to authenticated using (true);
create policy "catálogo: leer" on public.habit_templates for select to authenticated using (true);

insert into public.neurons (code, name, hemisphere, level, summary, minimum, sensitive, min_age, sort_order) values
  ('tu_rutina', 'Tu rutina', 'bridge', 2, 'El puente entre los hemisferios: según tu tipo de rutina y tus horarios, el cerebro gira hacia Personal o hacia Trabajo.', 'Tipo de rutina (de día, turnos, faena, según agenda o variable) y las horas básicas', false, 14, 1),
  ('perfil_personal', 'Perfil personal', 'personal', 0, 'Lo básico de la persona: cómo la llamamos, su edad y para qué usa Severa. Alimenta a los demás módulos.', 'Nombre, fecha de nacimiento y objetivo («¿para qué quieres Severa?»)', false, 14, 2),
  ('calendario', 'Calendario', 'personal', 1, 'Eventos y citas de la vida personal; lee otros calendarios y escribe en el de Severa.', 'Conectar el calendario del teléfono o crear un evento', false, 14, 3),
  ('finanzas', 'Finanzas', 'personal', 1, 'Gastos, ingresos, cuentas, cuotas, presupuesto y los tres informes: resultados, balance y flujo de caja.', 'Día de pago: día 5, día 15, último día hábil, otro día (del 1 al 31), cambia según el mes (calendario de pagos) o «no tengo sueldo fijo»', false, 14, 4),
  ('habitos', 'Hábitos', 'personal', 1, 'Hábitos propios (pueden ser privados), +1 en un toque, rachas e impulsos (Resistí / Cedí). Cuenta lo que hace bien y lo que se quiere bajar (cigarros, energéticas, alcohol, salidas y carrete, redes, chatarra), con límites por día, semana o mes, y muestra lo que te ayuda (05-10-2026).', 'Elegir qué contar: algo que te hace bien o algo que quieres bajar', false, 14, 5),
  ('prioridades', 'Prioridades', 'personal', 1, 'El día en orden: tareas, pagos, citas y hábitos de todos los módulos.', 'Una tarea', false, 14, 6),
  ('resumen', 'Resumen', 'personal', 1, 'La semana y el mes en cifras, armados solos con lo que registras.', 'Nada: se arma solo', false, 14, 7),
  ('alimentacion', 'Alimentación', 'personal', 2, 'Comidas, IMC con referencia OMS, metas y lista de compras compartida.', 'Peso y estatura, o una comida', false, 14, 8),
  ('documentos', 'Documentos', 'personal', 2, 'Documentos con vencimiento (carnet, licencia, revisión técnica) y sus avisos.', 'Un documento con su fecha de vencimiento', true, 14, 9),
  ('ejercicio', 'Ejercicio', 'personal', 2, 'Registro manual de entrenamientos, temporizador y planes.', 'Registrar una sesión', false, 14, 10),
  ('estudios', 'Estudios', 'personal', 2, 'Ramos, notas, ponderaciones, asistencia y «¿cuánto necesito?».', 'Un ramo', false, 14, 11),
  ('gastos_compartidos', 'Gastos compartidos', 'personal', 2, 'Grupos para dividir gastos: pareja, casa, viajes.', 'Crear un grupo', false, 14, 12),
  ('biblia', 'Biblia', 'personal', 3, 'Reina-Valera 1909, pan de vida, rutas de lectura sin plazo e índice de emociones.', 'Activar el pan de vida', false, 14, 13),
  ('biografia', 'Biografía', 'personal', 3, 'Recuerdos y lugares de tu vida, con fechas aproximadas.', 'Un recuerdo', false, 14, 14),
  ('cv', 'CV', 'personal', 3, 'Historial laboral con tareas por trabajo y PDF.', 'Un trabajo en el historial', false, 14, 15),
  ('diario', 'Diario', 'personal', 3, 'Registrar mi día: nota de 1 a 10, color, actividades y notas.', 'Un registro de tu día', false, 14, 16),
  ('familia_y_mascotas', 'Familia y mascotas', 'personal', 3, 'Personas a cargo (hijos, mascotas, otros) con su salud, colegio y documentos; co-cuidado.', 'Un perfil a cargo', false, 14, 17),
  ('foda_personal', 'FODA personal', 'personal', 3, 'Fortalezas, oportunidades, debilidades y amenazas personales.', 'Una fortaleza', false, 14, 18),
  ('gratitud', 'Gratitud', 'personal', 3, 'Tres cosas buenas del día.', 'Una cosa buena', false, 14, 19),
  ('juegos', 'Juegos', 'personal', 3, 'Juegos breves para descansar la mente.', 'Ninguno', false, 14, 20),
  ('logros', 'Logros', 'personal', 3, 'Medallas y rachas de toda la app.', 'Se gana solo', false, 14, 21),
  ('viajes', 'Viajes', 'personal', 3, 'Viajes con itinerario, gastos y recuerdos.', 'Un viaje', false, 14, 22),
  ('intimo_y_ciclo', 'Íntimo y ciclo', 'personal', 4, 'Ciclo y registro íntimo, con secciones que cada persona activa.', 'Consentimiento y elegir las secciones', true, 16, 23),
  ('salud', 'Salud', 'personal', 4, 'Remedios con recordatorio, síntomas para mostrar al médico, exámenes, citas y licencias médicas.', 'Consentimiento de datos sensibles y un remedio o un dato', true, 16, 24),
  ('trabajo', 'Trabajo', 'work', 0, 'El hemisferio Trabajo: Mis trabajos (uno o varios cargos) y sus herramientas.', 'Elegir el oficio', false, 14, 25),
  ('agenda_y_citas', 'Agenda y citas', 'work', 1, 'Citas, clases o visitas del trabajo; también aparecen en el calendario personal.', 'Una cita', false, 14, 26),
  ('cobros_y_boletas', 'Cobros y boletas', 'work', 1, 'Lo cobrado y lo por cobrar; boletas de honorarios con retención.', 'Forma de pago del oficio', false, 14, 27),
  ('habitos_rapidos_en_trabajo', 'Hábitos rápidos en Trabajo', 'work', 1, 'Hábitos personales que se registran sin salir de Trabajo (agua, pausa activa).', 'Elegir qué hábitos aparecen en Trabajo', false, 14, 28),
  ('jornada', 'Jornada', 'work', 1, 'Inicio y fin del día de trabajo según el tipo de jornada; al salir se cierra la jornada.', 'Tipo de jornada: diurna, turnos, sistema por días (faena), según agenda o sin horario', false, 14, 29),
  ('tareas_del_trabajo', 'Tareas del trabajo', 'work', 1, 'Pendientes y trámites del trabajo.', 'Una tarea', false, 14, 30),
  ('clientes_y_pacientes', 'Clientes y pacientes', 'work', 2, 'Fichas de personas atendidas; clientes con abonos y saldo.', 'Un cliente o paciente', true, 14, 31),
  ('ficha_al_terminar', 'Ficha al terminar', 'work', 2, 'Registro al terminar una cita o trabajo, con campos personalizables.', 'Elegir o armar la plantilla', false, 14, 32),
  ('gastos_del_trabajo', 'Gastos del trabajo', 'work', 2, 'Combustible, materiales, arriendo de silla y otros gastos del trabajo.', 'Un gasto del trabajo', false, 14, 33),
  ('pedidos_y_costeo', 'Pedidos y costeo', 'work', 2, 'Pedidos con fecha de entrega y costo por receta.', 'Un pedido', false, 14, 34),
  ('recorridos', 'Recorridos', 'work', 2, 'Jornadas de conductor o repartidor: viajes, kilómetros, gastos y ganancia neta.', 'Plataforma y tarifas', false, 14, 35),
  ('turnos_y_faenas', 'Turnos y faenas', 'work', 2, 'Turnos rotativos (cuarto turno) y sistemas por días (7x7, 10x10, 14x14, 4x3…) para salud, minería y faenas; contratos breves por faena.', 'Plantilla de turnos y «¿qué te toca hoy?» (turnos), o sistema y próxima subida (faena)', false, 14, 36),
  ('ventas_y_productos', 'Ventas y productos', 'work', 2, 'Productos, precios, ventas del día y clientes con fiado.', 'Un producto o un monto', false, 14, 37),
  ('documentos_laborales', 'Documentos laborales', 'work', 3, 'Contratos, certificados y documentos del trabajo.', 'Un documento', false, 14, 38);

insert into public.synapses (neuron_a, neuron_b, confirmed) values
  ('agenda_y_citas', 'calendario', true),
  ('agenda_y_citas', 'clientes_y_pacientes', true),
  ('agenda_y_citas', 'cobros_y_boletas', false),
  ('agenda_y_citas', 'ficha_al_terminar', true),
  ('agenda_y_citas', 'tareas_del_trabajo', false),
  ('agenda_y_citas', 'trabajo', false),
  ('alimentacion', 'ejercicio', true),
  ('alimentacion', 'finanzas', true),
  ('alimentacion', 'habitos', true),
  ('alimentacion', 'habitos_rapidos_en_trabajo', false),
  ('alimentacion', 'salud', true),
  ('alimentacion', 'tu_rutina', false),
  ('biblia', 'diario', false),
  ('biblia', 'gratitud', true),
  ('biblia', 'habitos', false),
  ('biblia', 'logros', false),
  ('biografia', 'cv', true),
  ('biografia', 'diario', true),
  ('biografia', 'familia_y_mascotas', true),
  ('biografia', 'viajes', true),
  ('calendario', 'estudios', true),
  ('calendario', 'familia_y_mascotas', true),
  ('calendario', 'intimo_y_ciclo', false),
  ('calendario', 'pedidos_y_costeo', false),
  ('calendario', 'perfil_personal', false),
  ('calendario', 'prioridades', true),
  ('calendario', 'salud', false),
  ('calendario', 'tu_rutina', false),
  ('calendario', 'turnos_y_faenas', false),
  ('clientes_y_pacientes', 'cobros_y_boletas', true),
  ('clientes_y_pacientes', 'ficha_al_terminar', true),
  ('clientes_y_pacientes', 'ventas_y_productos', true),
  ('cobros_y_boletas', 'ficha_al_terminar', false),
  ('cobros_y_boletas', 'finanzas', true),
  ('cobros_y_boletas', 'gastos_del_trabajo', false),
  ('cobros_y_boletas', 'jornada', false),
  ('cobros_y_boletas', 'resumen', false),
  ('cobros_y_boletas', 'trabajo', false),
  ('cv', 'documentos_laborales', false),
  ('cv', 'estudios', true),
  ('cv', 'foda_personal', false),
  ('cv', 'trabajo', true),
  ('diario', 'foda_personal', false),
  ('diario', 'gratitud', true),
  ('diario', 'habitos', true),
  ('diario', 'prioridades', true),
  ('diario', 'resumen', false),
  ('documentos_laborales', 'trabajo', false),
  ('documentos', 'documentos_laborales', true),
  ('documentos', 'familia_y_mascotas', true),
  ('documentos', 'finanzas', true),
  ('documentos', 'salud', true),
  ('documentos', 'viajes', true),
  ('ejercicio', 'habitos', true),
  ('ejercicio', 'logros', false),
  ('ejercicio', 'salud', true),
  ('estudios', 'familia_y_mascotas', false),
  ('estudios', 'prioridades', false),
  ('familia_y_mascotas', 'finanzas', false),
  ('familia_y_mascotas', 'gastos_compartidos', false),
  ('familia_y_mascotas', 'perfil_personal', false),
  ('familia_y_mascotas', 'salud', true),
  ('finanzas', 'gastos_compartidos', true),
  ('finanzas', 'gastos_del_trabajo', false),
  ('finanzas', 'habitos', true),
  ('finanzas', 'jornada', false),
  ('finanzas', 'logros', false),
  ('finanzas', 'pedidos_y_costeo', false),
  ('finanzas', 'perfil_personal', false),
  ('finanzas', 'prioridades', false),
  ('finanzas', 'recorridos', false),
  ('finanzas', 'resumen', true),
  ('finanzas', 'turnos_y_faenas', false),
  ('finanzas', 'ventas_y_productos', false),
  ('finanzas', 'viajes', true),
  ('foda_personal', 'habitos', true),
  ('foda_personal', 'prioridades', false),
  ('gastos_compartidos', 'viajes', true),
  ('gastos_del_trabajo', 'recorridos', true),
  ('habitos_rapidos_en_trabajo', 'jornada', true),
  ('habitos', 'habitos_rapidos_en_trabajo', true),
  ('habitos', 'logros', true),
  ('habitos', 'perfil_personal', false),
  ('habitos', 'prioridades', false),
  ('habitos', 'resumen', false),
  ('habitos', 'salud', true),
  ('intimo_y_ciclo', 'salud', true),
  ('jornada', 'recorridos', false),
  ('jornada', 'trabajo', false),
  ('jornada', 'tu_rutina', false),
  ('jornada', 'turnos_y_faenas', true),
  ('juegos', 'logros', false),
  ('pedidos_y_costeo', 'ventas_y_productos', true),
  ('perfil_personal', 'trabajo', false),
  ('prioridades', 'tareas_del_trabajo', true),
  ('resumen', 'trabajo', false),
  ('salud', 'tu_rutina', false),
  ('salud', 'turnos_y_faenas', true),
  ('tareas_del_trabajo', 'trabajo', false),
  ('tu_rutina', 'turnos_y_faenas', false);

insert into public.trades (code, name, icon, main_action, tools, beta_priority, status, sort_order) values
  ('conductor', 'Conductor/a de aplicaciones', 'Car', 'Empezar jornada', array['jornada', 'recorridos', 'gastos_del_trabajo', 'cobros_y_boletas']::text[], 1, 'active', 1),
  ('shopper', 'Shopper o repartidor/a', 'ShoppingCart', 'Empezar jornada', array['jornada', 'recorridos', 'gastos_del_trabajo', 'cobros_y_boletas']::text[], 2, 'active', 2),
  ('prevencionista', 'Prevencionista de riesgos', 'HardHat', 'Registrar visita', array['agenda_y_citas', 'clientes_y_pacientes', 'ficha_al_terminar', 'tareas_del_trabajo', 'documentos_laborales', 'cobros_y_boletas']::text[], 3, 'active', 3),
  ('ventas', 'Ventas y comercio', 'Storefront', 'Vender', array['ventas_y_productos', 'clientes_y_pacientes', 'cobros_y_boletas', 'gastos_del_trabajo']::text[], 4, 'active', 4),
  ('kinesiologia', 'Kinesiólogo/a', 'Heartbeat', 'Cobrar', array['agenda_y_citas', 'clientes_y_pacientes', 'ficha_al_terminar', 'cobros_y_boletas']::text[], null, 'active', 5),
  ('nutricion', 'Nutricionista', 'ForkKnife', 'Cobrar', array['agenda_y_citas', 'clientes_y_pacientes', 'ficha_al_terminar', 'cobros_y_boletas']::text[], null, 'active', 6),
  ('profesor', 'Profesor/a', 'ChalkboardTeacher', 'Registrar clase', array['agenda_y_citas', 'tareas_del_trabajo', 'documentos_laborales', 'jornada']::text[], null, 'active', 7),
  ('administrativo', 'Administrativo/a', 'Briefcase', 'Anotar lo hecho', array['tareas_del_trabajo', 'documentos_laborales', 'jornada']::text[], null, 'active', 8),
  ('supervisor_obra', 'Supervisor/a de obra', 'Buildings', 'Libro de obra', array['tareas_del_trabajo', 'documentos_laborales', 'jornada', 'ficha_al_terminar']::text[], null, 'active', 9),
  ('barberia', 'Barbería y estética', 'Scissors', 'Cobrar', array['agenda_y_citas', 'clientes_y_pacientes', 'ventas_y_productos', 'cobros_y_boletas']::text[], null, 'active', 10),
  ('cabanas', 'Cabañas en arriendo', 'House', 'Nueva reserva', array['agenda_y_citas', 'clientes_y_pacientes', 'cobros_y_boletas', 'gastos_del_trabajo']::text[], null, 'active', 11),
  ('servicio_tecnico', 'Servicio técnico o profesional', 'Wrench', 'Cobrar', array['agenda_y_citas', 'clientes_y_pacientes', 'ficha_al_terminar', 'cobros_y_boletas', 'ventas_y_productos']::text[], null, 'active', 12),
  ('pasteleria', 'Pastelería', 'Cake', 'Nuevo pedido', array['pedidos_y_costeo', 'ventas_y_productos', 'clientes_y_pacientes', 'cobros_y_boletas']::text[], null, 'active', 13),
  ('mineria_faenas', 'Minería y faenas', 'Mountains', 'Ver mi ciclo', array['turnos_y_faenas', 'jornada', 'documentos_laborales']::text[], null, 'proposed', 14),
  ('otro', 'Otro oficio', 'Toolbox', 'Registrar', array['tareas_del_trabajo', 'cobros_y_boletas']::text[], null, 'active', 15);

insert into public.holidays (date, name, kind, region) values
  ('2026-01-01', 'Año Nuevo', 'irrenunciable', null),
  ('2026-04-03', 'Viernes Santo', 'national', null),
  ('2026-04-04', 'Sábado Santo', 'national', null),
  ('2026-05-01', 'Día Nacional del Trabajo', 'irrenunciable', null),
  ('2026-05-21', 'Día de las Glorias Navales', 'national', null),
  ('2026-06-07', 'Asalto y Toma del Morro de Arica', 'regional', 'Arica y Parinacota'),
  ('2026-06-21', 'Día Nacional de los Pueblos Indígenas', 'national', null),
  ('2026-06-29', 'San Pedro y San Pablo', 'national', null),
  ('2026-07-16', 'Día de la Virgen del Carmen', 'national', null),
  ('2026-08-15', 'Asunción de la Virgen', 'national', null),
  ('2026-08-20', 'Nacimiento del Prócer de la Independencia (Chillán y Chillán Viejo)', 'regional', 'Ñuble'),
  ('2026-09-18', 'Independencia Nacional', 'irrenunciable', null),
  ('2026-09-19', 'Día de las Glorias del Ejército', 'irrenunciable', null),
  ('2026-10-12', 'Encuentro de Dos Mundos', 'national', null),
  ('2026-10-31', 'Día de las Iglesias Evangélicas y Protestantes', 'national', null),
  ('2026-11-01', 'Día de Todos los Santos', 'national', null),
  ('2026-12-08', 'Inmaculada Concepción', 'national', null),
  ('2026-12-25', 'Navidad', 'irrenunciable', null);

insert into public.habit_templates (code, name, kind, unit, direction, period, suggested_target, min_age, sort_order) values
  ('agua', 'Tomar agua', 'counter', 'vasos', 'good', 'day', 8, 14, 1),
  ('sueno', 'Dormir 7 h o más', 'quantity', 'horas', 'good', 'day', 7, 14, 2),
  ('caminar', 'Caminar', 'quantity', 'minutos', 'good', 'day', 30, 14, 3),
  ('leer', 'Leer', 'quantity', 'minutos', 'good', 'day', 20, 14, 4),
  ('entrenar', 'Entrenar', 'yes_no', null, 'good', 'week', 3, 14, 5),
  ('orar_meditar', 'Orar o meditar', 'yes_no', null, 'good', 'day', 1, 14, 6),
  ('cigarros', 'Cigarros', 'counter', 'cigarros', 'reduce', 'day', null, 18, 7),
  ('energeticas', 'Energéticas', 'counter', 'latas', 'reduce', 'day', null, 14, 8),
  ('alcohol', 'Alcohol', 'counter', 'tragos', 'reduce', 'week', null, 18, 9),
  ('salidas', 'Salidas y carrete', 'yes_no', null, 'reduce', 'month', 4, 18, 10),
  ('redes', 'Redes sociales', 'quantity', 'horas', 'reduce', 'day', 2, 14, 11),
  ('chatarra', 'Comida chatarra', 'counter', 'veces', 'reduce', 'week', 2, 14, 12);

-- PowerSync: los catálogos también bajan al teléfono (funcionan sin conexión).
grant select on public.neurons, public.synapses, public.trades, public.holidays, public.habit_templates to powersync_role;
alter publication powersync add table public.neurons, public.synapses, public.trades, public.holidays, public.habit_templates;
