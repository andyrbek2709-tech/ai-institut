import { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { AvatarComp, PriorityDot } from './ui';

interface KanbanBoardProps {
  tasks: any[];
  statusMap: Record<string, { label: string; color: string }>;
  projects: any[];
  getUserById: (id: any) => any;
  formatDateRu: (d: string) => string;
  onCardClick: (task: any) => void;
  onStatusChange: (taskId: number, newStatus: string) => void;
  C: any;
  searchQuery: string;
  filterStatus: string;
  filterPriority: string;
  filterAssigned: string;
}

function DraggableCard({ task, projects, getUserById, formatDateRu, C, onClick, isDragging }: any) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: String(task.id) });
  const u = getUserById(task.assigned_to);

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    cursor: 'grab',
    touchAction: 'none',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="kanban-card"
      onClick={(e) => {
        if (!transform) onClick(task);
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <PriorityDot p={task.priority} C={C} />
        <span style={{ fontSize: 13, flex: 1, color: C.text, fontWeight: 500 }}>{task.name}</span>
      </div>
      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 10 }}>
        <span>📁 {projects.find((p: any) => String(p.id) === String(task.project_id))?.name || 'Неизвестный проект'}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {task.dept && <span style={{ fontSize: 10, color: C.textMuted, background: C.surface2, padding: '3px 8px', borderRadius: 6, width: 'fit-content' }}>{task.dept}</span>}
          {task.deadline && <span style={{ fontSize: 10, color: C.textMuted }}>📅 {formatDateRu(task.deadline)}</span>}
        </div>
        {u && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 500 }}>{u.full_name.split(' ')[0]}</span>
            <AvatarComp user={u} size={24} C={C} />
          </div>
        )}
      </div>
    </div>
  );
}

function DroppableColumn({ colId, label, color, tasks, projects, getUserById, formatDateRu, C, onCardClick, draggingId, isOver }: any) {
  const { setNodeRef } = useDroppable({ id: colId });

  return (
    <div className="kanban-col-shell">
      <div className="kanban-col-title" style={{ color }}>
        <span className="stat-card-dot" style={{ background: color }} />
        {label}
        <span className="kanban-col-count">{tasks.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className="kanban-col-body"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          minHeight: 80,
          borderRadius: 10,
          transition: 'background 0.15s',
          background: isOver ? color + '15' : 'transparent',
          padding: isOver ? 4 : 0,
        }}
      >
        {tasks.map((t: any) => (
          <DraggableCard
            key={t.id}
            task={t}
            projects={projects}
            getUserById={getUserById}
            formatDateRu={formatDateRu}
            C={C}
            onClick={onCardClick}
            isDragging={draggingId === String(t.id)}
          />
        ))}
        {tasks.length === 0 && (
          <div className="kanban-empty" style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', padding: 16 }}>
            {isOver ? '⬇ Перетащите сюда' : 'Пусто'}
          </div>
        )}
      </div>
    </div>
  );
}

export function KanbanBoard({
  tasks, statusMap, projects, getUserById, formatDateRu,
  onCardClick, onStatusChange, C,
  searchQuery, filterStatus, filterPriority, filterAssigned,
}: KanbanBoardProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const draggingTask = draggingId ? tasks.find(t => String(t.id) === draggingId) : null;

  const filterTasks = (col: string) => tasks.filter(t => {
    if (t.status !== col) return false;
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    if (filterAssigned !== 'all' && String(t.assigned_to) !== filterAssigned) return false;
    if (searchQuery) {
      const sq = searchQuery.toLowerCase();
      const u = getUserById(t.assigned_to);
      if (!t.name.toLowerCase().includes(sq) && !(t.dept || '').toLowerCase().includes(sq) && !(u?.full_name || '').toLowerCase().includes(sq)) return false;
    }
    return true;
  });

  const handleDragStart = (e: DragStartEvent) => {
    setDraggingId(String(e.active.id));
  };

  const handleDragOver = (e: DragOverEvent) => {
    setOverId(e.over ? String(e.over.id) : null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setDraggingId(null);
    setOverId(null);
    if (!over) return;
    const taskId = Number(active.id);
    const newStatus = String(over.id);
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === newStatus) return;
    onStatusChange(taskId, newStatus);
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
      <div className="kanban-grid">
        {Object.entries(statusMap).map(([col, s]) => {
          const colTasks = filterTasks(col);
          if (colTasks.length === 0 && col !== 'todo' && col !== 'inprogress') return null;
          return (
            <DroppableColumn
              key={col}
              colId={col}
              label={s.label}
              color={s.color}
              tasks={colTasks}
              projects={projects}
              getUserById={getUserById}
              formatDateRu={formatDateRu}
              C={C}
              onCardClick={onCardClick}
              draggingId={draggingId}
              isOver={overId === col}
            />
          );
        })}
      </div>

      <DragOverlay>
        {draggingTask && (
          <div className="kanban-card" style={{ opacity: 0.95, boxShadow: '0 8px 32px rgba(0,0,0,0.3)', cursor: 'grabbing', rotate: '2deg' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <PriorityDot p={draggingTask.priority} C={C} />
              <span style={{ fontSize: 13, flex: 1, color: C.text, fontWeight: 500 }}>{draggingTask.name}</span>
            </div>
            {draggingTask.dept && <span style={{ fontSize: 10, color: C.textMuted, background: C.surface2, padding: '3px 8px', borderRadius: 6 }}>{draggingTask.dept}</span>}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
