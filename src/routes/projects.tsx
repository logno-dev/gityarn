import { Link, createFileRoute } from '@tanstack/react-router'
import { CalendarDays, ChevronRight, CircleCheckBig, FolderKanban, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { projectStatuses } from '#/lib/projects/model'
import type { ProjectStatus } from '#/lib/projects/model'

export const Route = createFileRoute('/projects')({ component: ProjectsPage })

type ProjectSummary = {
  id: string
  name: string
  status: ProjectStatus
  notes: string | null
  startDate: string | null
  dueDate: string | null
  completedAt: number | null
  updatedAt: number
  stepCount: number
  completedStepCount: number
  nextDueDate: string | null
}

function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', status: 'planned' as ProjectStatus, notes: '', startDate: '', dueDate: '' })

  const load = async () => {
    setLoading(true)
    const response = await fetch('/api/projects')
    const payload = await response.json().catch(() => ({})) as { projects?: ProjectSummary[]; message?: string }
    if (!response.ok) setStatus(payload.message ?? 'Could not load projects.')
    else setProjects(payload.projects ?? [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const createProject = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setStatus('')
    const response = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const payload = await response.json().catch(() => ({})) as { projectId?: string; message?: string }
    setSaving(false)
    if (!response.ok || !payload.projectId) {
      setStatus(payload.message ?? 'Could not create project.')
      return
    }
    window.location.href = `/project/${payload.projectId}`
  }

  const activeCount = projects.filter((project) => project.status === 'active').length
  const datedCount = projects.filter((project) => project.nextDueDate && !project.completedAt).length

  return <section className="page-stack projects-page">
    <header className="projects-hero">
      <div><span className="kicker">Your workbench</span><h1>Projects</h1><p>Plan CAL deadlines, connect patterns and materials, then share progress as a Creation.</p></div>
      <button className="button button-primary" onClick={() => setShowCreate((current) => !current)} type="button"><Plus size={16} /> New project</button>
      <div className="projects-hero-stats"><span><strong>{projects.length}</strong> total</span><span><strong>{activeCount}</strong> active</span><span><strong>{datedCount}</strong> with dated milestones</span></div>
    </header>

    {showCreate ? <form className="soft-panel project-create-panel stack-form" onSubmit={createProject}>
      <div><span className="kicker">Start planning</span><h2>New project</h2></div>
      <div className="project-form-grid">
        <label>Project name<input autoFocus maxLength={200} onChange={(event) => setForm({ ...form, name: event.target.value })} required value={form.name} /></label>
        <label>Status<select onChange={(event) => setForm({ ...form, status: event.target.value as ProjectStatus })} value={form.status}>{projectStatuses.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></label>
        <label>Start date<input onChange={(event) => setForm({ ...form, startDate: event.target.value })} type="date" value={form.startDate} /></label>
        <label>Final due date<input onChange={(event) => setForm({ ...form, dueDate: event.target.value })} type="date" value={form.dueDate} /></label>
      </div>
      <label>Private working notes<textarea onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Goals, sizing, CAL details, or anything you want nearby..." rows={4} value={form.notes} /></label>
      <div className="hero-actions"><button className="button button-primary" disabled={saving} type="submit">{saving ? 'Creating...' : 'Create project'}</button><button className="button" onClick={() => setShowCreate(false)} type="button">Cancel</button></div>
    </form> : null}

    {status ? <p className="form-status">{status}</p> : null}
    {loading ? <p>Loading projects...</p> : null}
    {!loading && !projects.length ? <article className="soft-panel projects-empty"><FolderKanban size={30} /><h2>Make room for the next make</h2><p>Create a project to organize a CAL, a gift deadline, or a longer pattern sequence.</p><button className="button button-primary" onClick={() => setShowCreate(true)} type="button"><Plus size={16} /> Create your first project</button></article> : null}

    <div className="project-card-grid">{projects.map((project) => {
      const progress = project.stepCount ? Math.round((project.completedStepCount / project.stepCount) * 100) : 0
      return <Link className="project-card" key={project.id} params={{ projectId: project.id }} to="/project/$projectId">
        <div className="project-card-top"><span className={`project-status status-${project.status}`}>{statusLabel(project.status)}</span><ChevronRight size={18} /></div>
        <div><h2>{project.name}</h2>{project.notes ? <p>{project.notes}</p> : <p className="muted">No project notes yet.</p>}</div>
        <div className="project-progress" aria-label={`${progress}% complete`}><span style={{ width: `${progress}%` }} /></div>
        <div className="project-card-meta"><span><CircleCheckBig size={14} /> {project.completedStepCount}/{project.stepCount} milestones</span><span><CalendarDays size={14} /> {project.nextDueDate ? `Milestone ${formatDate(project.nextDueDate)}` : project.dueDate ? `Due ${formatDate(project.dueDate)}` : 'No due date'}</span></div>
      </Link>
    })}</div>
  </section>
}

function statusLabel(status: ProjectStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
