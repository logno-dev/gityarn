import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, CalendarDays, Check, Circle, Plus, Send, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { ProjectPatternPicker, patternViewerHref } from '#/components/project-pattern-picker'
import type { ProjectPatternChoice } from '#/components/project-pattern-picker'
import { projectStatuses } from '#/lib/projects/model'
import type { ProjectDetail, ProjectStatus, ProjectStep } from '#/lib/projects/model'

export const Route = createFileRoute('/project/$projectId')({ component: ProjectDetailPage })

type YarnChoice = { id: string; nickname: string | null; manufacturerName: string | null; lineName: string | null; colorwayName: string | null }
type HookChoice = { id: string; sizeLabel: string; metricSizeMm: string | null; material: string | null }

function ProjectDetailPage() {
  const { projectId } = Route.useParams()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [yarnChoices, setYarnChoices] = useState<YarnChoice[]>([])
  const [hookChoices, setHookChoices] = useState<HookChoice[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [projectForm, setProjectForm] = useState({ name: '', status: 'planned' as ProjectStatus, notes: '', startDate: '', dueDate: '', yarnInventoryIds: [] as string[], hookIds: [] as string[] })
  const [stepForm, setStepForm] = useState({ title: '', notes: '', dueDate: '', patterns: [] as ProjectPatternChoice[] })
  const [publishForm, setPublishForm] = useState({ name: '', notes: '', postType: 'progress', isPublic: true, yarnUsage: {} as Record<string, string> })
  const [saving, setSaving] = useState(false)

  const load = async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const [projectResponse, yarnResponse, hookResponse] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch('/api/scan/inventory?kind=yarn'),
        fetch('/api/scan/inventory?kind=hooks'),
      ])
      const payload = await projectResponse.json().catch(() => ({})) as { project?: ProjectDetail; message?: string }
      if (!projectResponse.ok || !payload.project) {
        setStatus(payload.message ?? 'Could not load project.')
        return
      }
      const [yarnPayload, hookPayload] = await Promise.all([yarnResponse.json(), hookResponse.json()]) as Array<{ items?: unknown[] }>
      setProject(payload.project)
      setProjectForm({ name: payload.project.name, status: payload.project.status, notes: payload.project.notes ?? '', startDate: payload.project.startDate ?? '', dueDate: payload.project.dueDate ?? '', yarnInventoryIds: payload.project.yarn.map((item) => item.inventoryId), hookIds: payload.project.hooks.map((item) => item.hookId) })
      setPublishForm((current) => ({ ...current, name: `${payload.project?.name ?? 'Project'} update`, postType: payload.project?.status === 'completed' ? 'completed' : current.postType, yarnUsage: Object.fromEntries(payload.project?.yarn.map((item) => [item.inventoryId, current.yarnUsage[item.inventoryId] ?? '']) ?? []) }))
      setYarnChoices(yarnResponse.ok ? (yarnPayload.items ?? []) as YarnChoice[] : [])
      setHookChoices(hookResponse.ok ? (hookPayload.items ?? []) as HookChoice[] : [])
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load project.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [projectId])

  const request = async (url: string, method: string, body?: unknown) => {
    setSaving(true)
    setStatus('')
    try {
      const response = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
      const payload = await response.json().catch(() => ({})) as { message?: string; creationId?: string }
      if (!response.ok) {
        setStatus(payload.message ?? 'Could not update project.')
        return null
      }
      setStatus(payload.message ?? '')
      return payload
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not update project.')
      return null
    } finally {
      setSaving(false)
    }
  }

  const saveProject = async (event: FormEvent) => {
    event.preventDefault()
    if (await request(`/api/projects/${projectId}`, 'PATCH', projectForm)) await load(false)
  }

  const addStep = async (event: FormEvent) => {
    event.preventDefault()
    if (await request(`/api/projects/${projectId}/steps`, 'POST', { ...stepForm, patternIds: stepForm.patterns.map((pattern) => pattern.id) })) {
      setStepForm({ title: '', notes: '', dueDate: '', patterns: [] })
      await load(false)
    }
  }

  const updateStep = async (stepId: string, update: unknown) => {
    const saved = Boolean(await request(`/api/projects/${projectId}/steps/${stepId}`, 'PATCH', update))
    if (saved) await load(false)
    return saved
  }

  const toggleStep = async (step: ProjectStep) => {
    if (!project) return
    const previous = project
    const completedAt = step.completedAt ? null : Date.now()
    setProject({ ...project, steps: project.steps.map((item) => item.id === step.id ? { ...item, completedAt } : item) })
    const saved = await request(`/api/projects/${projectId}/steps/${step.id}`, 'PATCH', { completed: !step.completedAt })
    if (!saved) setProject(previous)
  }

  const removeStep = async (stepId: string) => {
    if (!window.confirm('Remove this milestone?')) return
    if (await request(`/api/projects/${projectId}/steps/${stepId}`, 'DELETE')) await load(false)
  }

  const publish = async (event: FormEvent) => {
    event.preventDefault()
    if (!project) return
    const payload = await request(`/api/projects/${projectId}/publish`, 'POST', { ...publishForm, yarnUsage: project.yarn.map((item) => ({ inventoryYarnId: item.inventoryId, skeinsUsed: Number(publishForm.yarnUsage[item.inventoryId]) })) })
    if (payload?.creationId) window.location.href = `/creation/${payload.creationId}`
  }

  const removeProject = async () => {
    if (!window.confirm('Delete this project and all of its milestones? Published Creations will remain.')) return
    if (await request(`/api/projects/${projectId}`, 'DELETE')) window.location.href = '/projects'
  }

  if (loading) return <section className="page-stack"><p>Loading project...</p></section>
  if (!project) return <section className="page-stack"><p>{status || 'Project not found.'}</p><Link className="button" to="/projects">Back to projects</Link></section>

  const completed = project.steps.filter((step) => step.completedAt).length
  const progress = project.steps.length ? Math.round((completed / project.steps.length) * 100) : 0

  return <section className="page-stack project-detail-page">
    <header className="project-detail-header">
      <Link className="button" to="/projects"><ArrowLeft size={15} /> Projects</Link>
      <div><span className="kicker">{project.status} project</span><h1>{project.name}</h1><p>{project.steps.length ? `${completed} of ${project.steps.length} milestones complete` : 'Add the first milestone to start your plan.'}</p></div>
      <div className="project-progress project-progress-large" aria-label={`${progress}% complete`}><span style={{ width: `${progress}%` }} /></div>
    </header>
    {status ? <p className="form-status" aria-live="polite">{status}</p> : null}

    <div className="project-workspace">
      <main className="project-timeline-column">
        <form className="soft-panel project-step-composer stack-form" onSubmit={addStep}>
          <div><span className="kicker">Next checkpoint</span><h2>Add a milestone</h2></div>
          <div className="project-form-grid"><label>Title<input maxLength={200} onChange={(event) => setStepForm({ ...stepForm, title: event.target.value })} placeholder="Week 1: Main square" required value={stepForm.title} /></label><label>Due date<input onChange={(event) => setStepForm({ ...stepForm, dueDate: event.target.value })} type="date" value={stepForm.dueDate} /></label></div>
          <label>Notes<textarea onChange={(event) => setStepForm({ ...stepForm, notes: event.target.value })} placeholder="Rows to finish, modifications, CAL instructions..." rows={3} value={stepForm.notes} /></label>
          <ProjectPatternPicker onChange={(patterns) => setStepForm({ ...stepForm, patterns })} projectId={projectId} selected={stepForm.patterns} />
          <div className="project-composer-actions"><button className="button button-primary" disabled={saving} type="submit"><Plus size={15} /> Add milestone</button></div>
        </form>

        <div className="project-timeline">
          {project.steps.map((step, index) => <MilestoneCard key={step.id} number={index + 1} onDelete={() => void removeStep(step.id)} onSave={(update) => updateStep(step.id, update)} onToggle={() => void toggleStep(step)} projectId={projectId} saving={saving} step={step} />)}
          {!project.steps.length ? <div className="project-timeline-empty"><Circle size={22} /><p>No milestones yet. Add CAL stages, pattern sections, or target dates above.</p></div> : null}
        </div>
      </main>

      <aside className="project-sidebar">
        <details className="soft-panel project-settings" open>
          <summary>Project details</summary>
          <form className="stack-form" onSubmit={saveProject}>
            <label>Name<input maxLength={200} onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })} required value={projectForm.name} /></label>
            <label>Status<select onChange={(event) => setProjectForm({ ...projectForm, status: event.target.value as ProjectStatus })} value={projectForm.status}>{projectStatuses.map((value) => <option key={value} value={value}>{labelStatus(value)}</option>)}</select></label>
            <div className="project-form-grid"><label>Start<input onChange={(event) => setProjectForm({ ...projectForm, startDate: event.target.value })} type="date" value={projectForm.startDate} /></label><label>Final due<input onChange={(event) => setProjectForm({ ...projectForm, dueDate: event.target.value })} type="date" value={projectForm.dueDate} /></label></div>
            <label>Private notes<textarea onChange={(event) => setProjectForm({ ...projectForm, notes: event.target.value })} rows={4} value={projectForm.notes} /></label>
            <ChoiceChecklist label="Yarn reserved" onChange={(yarnInventoryIds) => setProjectForm({ ...projectForm, yarnInventoryIds })} options={yarnChoices.map((item) => ({ id: item.id, label: [item.nickname, item.manufacturerName, item.lineName, item.colorwayName].filter(Boolean).join(' · ') || 'Inventory yarn' }))} selected={projectForm.yarnInventoryIds} />
            <ChoiceChecklist label="Hooks" onChange={(hookIds) => setProjectForm({ ...projectForm, hookIds })} options={hookChoices.map((item) => ({ id: item.id, label: `${item.sizeLabel}${item.metricSizeMm ? ` (${item.metricSizeMm}mm)` : ''}${item.material ? ` · ${item.material}` : ''}` }))} selected={projectForm.hookIds} />
            <button className="button button-primary" disabled={saving} type="submit">Save details</button>
          </form>
        </details>

        <form className="soft-panel project-publish-panel stack-form" onSubmit={publish}>
          <div><span className="kicker">Structured post</span><h2>Share from project</h2><p>Patterns, materials, hooks, and the milestone checklist are copied into a Creation snapshot.</p></div>
          <label>Post title<input maxLength={200} onChange={(event) => setPublishForm({ ...publishForm, name: event.target.value })} required value={publishForm.name} /></label>
          <label>Update type<select onChange={(event) => setPublishForm({ ...publishForm, postType: event.target.value })} value={publishForm.postType}><option value="progress">Progress update</option><option value="completed">Finished creation</option></select></label>
          <label>Public notes<textarea onChange={(event) => setPublishForm({ ...publishForm, notes: event.target.value })} placeholder="What would you like to share?" rows={4} value={publishForm.notes} /></label>
          {project.yarn.length ? <fieldset className="project-choice-list project-yarn-usage"><legend>Skeins used so far</legend><div>{project.yarn.map((item) => <label key={item.inventoryId}><span>{item.label}</span><input aria-label={`Skeins used for ${item.label}`} max="999" min="1" onChange={(event) => setPublishForm({ ...publishForm, yarnUsage: { ...publishForm.yarnUsage, [item.inventoryId]: event.target.value } })} required type="number" value={publishForm.yarnUsage[item.inventoryId] ?? ''} /></label>)}</div></fieldset> : null}
          <label className="project-public-toggle"><input checked={publishForm.isPublic} onChange={(event) => setPublishForm({ ...publishForm, isPublic: event.target.checked })} type="checkbox" /> Publish to Discover now</label>
          <button className="button button-primary" disabled={saving} type="submit"><Send size={15} /> {publishForm.isPublic ? 'Publish Creation' : 'Save Creation draft'}</button>
        </form>
        <button className="button danger-button" onClick={() => void removeProject()} type="button"><Trash2 size={14} /> Delete project</button>
      </aside>
    </div>
  </section>
}

function MilestoneCard({ number, onDelete, onSave, onToggle, projectId, saving, step }: { number: number; onDelete: () => void; onSave: (update: unknown) => Promise<boolean>; onToggle: () => void; projectId: string; saving: boolean; step: ProjectStep }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ title: step.title, notes: step.notes ?? '', dueDate: step.dueDate ?? '', patterns: step.patterns })
  return <article className={`project-milestone ${step.completedAt ? 'completed' : ''}`}>
    <button aria-label={step.completedAt ? 'Mark milestone incomplete' : 'Complete milestone'} className="project-milestone-check" disabled={saving} onClick={onToggle} type="button">{step.completedAt ? <Check size={17} /> : <span>{number}</span>}</button>
    <div className="project-milestone-body">
      <div className="project-milestone-head"><div><h3>{step.title}</h3>{step.dueDate ? <span className="project-due"><CalendarDays size={13} /> {formatDate(step.dueDate)}</span> : null}</div><button className="button" onClick={() => setEditing((current) => !current)} type="button">{editing ? 'Close' : 'Edit'}</button></div>
      {step.notes ? <p>{step.notes}</p> : null}
      {step.patterns.length ? <div className="project-pattern-chips">{step.patterns.map((pattern) => <a href={patternViewerHref(pattern, projectId)} key={pattern.id}>{pattern.title}</a>)}</div> : null}
      {editing ? <form className="project-milestone-editor stack-form" onSubmit={async (event) => { event.preventDefault(); if (await onSave({ ...form, patternIds: form.patterns.map((pattern) => pattern.id) })) setEditing(false) }}>
        <label>Title<input onChange={(event) => setForm({ ...form, title: event.target.value })} required value={form.title} /></label>
        <label>Due date<input onChange={(event) => setForm({ ...form, dueDate: event.target.value })} type="date" value={form.dueDate} /></label>
        <label>Notes<textarea onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={3} value={form.notes} /></label>
        <ProjectPatternPicker onChange={(patterns) => setForm({ ...form, patterns })} projectId={projectId} selected={form.patterns} />
        <div className="hero-actions"><button className="button button-primary" disabled={saving} type="submit">Save milestone</button><button className="button danger-button" onClick={onDelete} type="button"><Trash2 size={13} /> Remove</button></div>
      </form> : null}
    </div>
  </article>
}

function ChoiceChecklist({ label, onChange, options, selected }: { label: string; onChange: (ids: string[]) => void; options: Array<{ id: string; label: string }>; selected: string[] }) {
  return <fieldset className="project-choice-list"><legend>{label}</legend>{options.length ? <div>{options.map((option) => <label key={option.id}><input checked={selected.includes(option.id)} onChange={(event) => onChange(event.target.checked ? [...selected, option.id] : selected.filter((id) => id !== option.id))} type="checkbox" /><span>{option.label}</span></label>)}</div> : <p>None in inventory yet.</p>}</fieldset>
}

function labelStatus(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
