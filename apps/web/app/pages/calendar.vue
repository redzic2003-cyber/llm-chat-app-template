<script setup lang="ts">
import type { CalendarOptions, DateSelectArg, EventClickArg, EventContentArg, EventSourceFuncArg } from "@fullcalendar/core";
import frLocale from "@fullcalendar/core/locales/fr";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import luxonPlugin from "@fullcalendar/luxon3";
import timeGridPlugin from "@fullcalendar/timegrid";
import FullCalendar from "@fullcalendar/vue3";
import type { SessionDTO } from "@tm/shared-types";

const api = useApi();
const toast = useToast();
const fmt = useFormat();
const { can, user } = useAuth();
const calendar = ref<InstanceType<typeof FullCalendar> | null>(null);
const mineOnly = ref(false);
const formOpen = ref(false);
const slot = ref<{ date: string; start: string; end: string } | null>(null);

const STATUS_CLASS: Record<string, string> = {
  draft: "ev-draft",
  planned: "ev-planned",
  in_progress: "ev-progress",
  completed: "ev-completed",
  cancelled: "ev-cancelled",
};

async function fetchEvents(info: EventSourceFuncArg) {
  const { items } = await api.sessions.list({ from: info.start.toISOString(), to: info.end.toISOString(), mine: mineOnly.value || undefined });
  return items.map((s) => ({
    id: s.id,
    title: s.training.title,
    start: s.startsAt,
    end: s.endsAt,
    classNames: [STATUS_CLASS[s.status] ?? ""],
    extendedProps: { session: s },
  }));
}

function renderEvent(arg: EventContentArg) {
  const s = arg.event.extendedProps.session as SessionDTO;
  const expected = s.counts.enrolled - s.counts.excused;
  const wrap = document.createElement("div");
  wrap.className = "ev";
  const line = (text: string, cls: string) => {
    const el = document.createElement("div");
    el.className = cls;
    el.textContent = text;
    wrap.appendChild(el);
  };
  line(fmt.timeRange(s.startsAt, s.endsAt), "ev-time");
  line(s.training.title, "ev-title");
  if (arg.view.type !== "dayGridMonth") line(s.training.reference, "ev-ref");
  line(s.status === "cancelled" ? "Annulée" : `${s.counts.present} / ${expected} validés`, "ev-count");
  return { domNodes: [wrap] };
}

function onSelect(arg: DateSelectArg) {
  if (!can("sessions:create")) return;
  const allDay = arg.allDay;
  slot.value = {
    date: fmt.dateKey(arg.start.toISOString()),
    start: allDay ? "08:00" : fmt.time(arg.start.toISOString()),
    end: allDay ? "10:00" : fmt.time(arg.end.toISOString()),
  };
  formOpen.value = true;
  calendar.value?.getApi().unselect();
}

function onEventClick(arg: EventClickArg) {
  navigateTo(`/sessions/${arg.event.id}`);
}

const options = computed<CalendarOptions>(() => ({
  plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, luxonPlugin],
  locale: frLocale,
  timeZone: fmt.tz,
  initialView: "timeGridWeek",
  headerToolbar: { left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek" },
  buttonText: { today: "Aujourd'hui", month: "Mois", week: "Semaine", day: "Jour", list: "Liste" },
  height: "auto",
  slotMinTime: "06:00:00",
  slotMaxTime: "20:00:00",
  slotDuration: "00:30:00",
  allDaySlot: false,
  nowIndicator: true,
  weekNumbers: true,
  weekNumberFormat: { week: "numeric" },
  firstDay: 1,
  selectable: can("sessions:create"),
  selectMirror: true,
  dayMaxEvents: 4,
  eventSources: [{ events: fetchEvents, failure: (e: unknown) => toast.error(e) }],
  eventContent: renderEvent,
  eventClick: onEventClick,
  select: onSelect,
}));

watch(mineOnly, () => calendar.value?.getApi().refetchEvents());

function onSaved(session: SessionDTO) {
  formOpen.value = false;
  navigateTo(`/sessions/${session.id}`);
}
</script>

<template>
  <div>
    <PageHeader title="Calendrier" subtitle="Cliquez sur une session pour l'ouvrir, sélectionnez un créneau pour en planifier une.">
      <label v-if="user?.role !== 'viewer'" class="checkbox"><input v-model="mineOnly" type="checkbox" /> Mes sessions uniquement</label>
      <button v-if="can('sessions:create')" class="btn btn-primary" type="button" @click="slot = null; formOpen = true">
        <AppIcon name="plus" /> Nouvelle session
      </button>
    </PageHeader>
    <div class="card card-body calendar-card">
      <FullCalendar ref="calendar" :options="options" />
    </div>
    <SessionFormDialog :open="formOpen" :slot="slot" @close="formOpen = false" @saved="onSaved" />
  </div>
</template>

<style>
.calendar-card {
  --fc-border-color: var(--border);
  --fc-today-bg-color: #f3f6fe;
  --fc-button-bg-color: var(--surface);
  --fc-button-border-color: var(--border-strong);
  --fc-button-text-color: var(--text);
  --fc-button-hover-bg-color: var(--surface-2);
  --fc-button-hover-border-color: var(--border-strong);
  --fc-button-active-bg-color: var(--accent-weak);
  --fc-button-active-border-color: var(--accent);
  --fc-now-indicator-color: var(--danger);
  font-size: 0.85rem;
}

.calendar-card .fc .fc-button {
  font-weight: 550;
  font-size: 0.85rem;
  text-transform: none;
}

.calendar-card .fc .fc-button-primary:not(:disabled).fc-button-active {
  color: var(--accent);
}

.calendar-card .fc .fc-toolbar-title {
  font-size: 1.1rem;
  font-weight: 650;
  text-transform: capitalize;
}

.calendar-card .fc-event {
  cursor: pointer;
  border-radius: 6px;
  border-width: 0 0 0 3px;
  padding: 1px 2px;
}

.ev {
  display: flex;
  flex-direction: column;
  gap: 1px;
  overflow: hidden;
  line-height: 1.25;
}

.ev-time {
  font-size: 0.75rem;
  opacity: 0.85;
}

.ev-title {
  font-weight: 650;
}

.ev-ref,
.ev-count {
  font-size: 0.75rem;
}

.fc-event.ev-planned,
.fc-event.ev-draft {
  --fc-event-bg-color: var(--accent-weak);
  --fc-event-border-color: var(--accent);
  --fc-event-text-color: #1e3a8a;
}

.fc-event.ev-draft {
  background: repeating-linear-gradient(45deg, #eef2fb, #eef2fb 6px, #f8faff 6px, #f8faff 12px);
}

.fc-event.ev-progress {
  --fc-event-bg-color: var(--warning-weak);
  --fc-event-border-color: var(--warning);
  --fc-event-text-color: #7a4207;
}

.fc-event.ev-completed {
  --fc-event-bg-color: var(--success-weak);
  --fc-event-border-color: var(--success);
  --fc-event-text-color: #135c2e;
}

.fc-event.ev-cancelled {
  --fc-event-bg-color: var(--neutral-weak);
  --fc-event-border-color: var(--subtle);
  --fc-event-text-color: var(--muted);
  text-decoration: line-through;
}

.fc .fc-daygrid-event {
  background: var(--fc-event-bg-color);
  color: var(--fc-event-text-color);
  border-left: 3px solid var(--fc-event-border-color);
}

.fc .fc-daygrid-event .fc-daygrid-event-dot {
  display: none;
}

.fc .fc-daygrid-event .ev {
  padding: 1px 3px;
}

.fc .fc-list-event .ev {
  flex-direction: row;
  gap: 0.75rem;
}
</style>
