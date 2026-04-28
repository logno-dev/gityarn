import { Link } from '@tanstack/react-router'
import { Flag, MessageCircle, Reply, Send, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import heartEmpty from '../../assets/heart_empty.svg'
import heartFull from '../../assets/heart_full.svg'

type CommentNode = {
  id: string
  parentCommentId: string | null
  body: string
  depth: number
  createdAt: number
  updatedAt: number
  moderationStatus: string
  moderationReason: string | null
  heartCount: number
  viewerHasHeart: boolean
  author: {
    id: string
    displayName: string
  }
}

type CommentResponse = {
  comments: CommentNode[]
}

export function CommentThread({ entityType, entityId }: { entityType: string; entityId: string }) {
  const [comments, setComments] = useState<CommentNode[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [draft, setDraft] = useState('')
  const [replyOpenForId, setReplyOpenForId] = useState<string | null>(null)
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [authUser, setAuthUser] = useState<{ id: string; role: 'member' | 'admin' } | null>(null)

  const loadComments = async () => {
    setLoading(true)
    const response = await fetch(`/api/comments?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`)
    const payload = (await response.json()) as CommentResponse & { message?: string }
    if (!response.ok) {
      setStatus(payload.message ?? 'Could not load comments.')
      setLoading(false)
      return
    }
    setComments(payload.comments)
    setLoading(false)
  }

  useEffect(() => {
    void loadComments()
  }, [entityType, entityId])

  useEffect(() => {
    fetch('/api/auth/me')
      .then((response) => response.json())
      .then((data: { user: { id: string; role: 'member' | 'admin' } | null }) => setAuthUser(data.user))
      .catch(() => setAuthUser(null))
  }, [])

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, CommentNode[]>()
    for (const item of comments) {
      const key = item.parentCommentId
      const list = map.get(key) ?? []
      list.push(item)
      map.set(key, list)
    }
    return map
  }, [comments])

  const postComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text) {
      return
    }
    const response = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType, entityId, text }),
    })
    const payload = (await response.json()) as { message?: string }
    setStatus(payload.message ?? (response.ok ? 'Comment posted.' : 'Could not post comment.'))
    if (response.ok) {
      setDraft('')
      await loadComments()
    }
  }

  const postReply = async (event: FormEvent<HTMLFormElement>, parentCommentId: string) => {
    event.preventDefault()
    const text = (replyDrafts[parentCommentId] ?? '').trim()
    if (!text) {
      return
    }
    const response = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType, entityId, parentCommentId, text }),
    })
    const payload = (await response.json()) as { message?: string }
    setStatus(payload.message ?? (response.ok ? 'Reply posted.' : 'Could not post reply.'))
    if (response.ok) {
      setReplyDrafts((current) => ({ ...current, [parentCommentId]: '' }))
      setReplyOpenForId(null)
      await loadComments()
    }
  }

  const toggleHeart = async (commentId: string) => {
    const response = await fetch(`/api/comments/${commentId}/hearts`, { method: 'POST' })
    const payload = (await response.json()) as { message?: string; heartCount?: number; viewerHasHeart?: boolean }
    if (!response.ok) {
      setStatus(payload.message ?? 'Could not update heart.')
      return
    }
    setComments((current) =>
      current.map((item) =>
        item.id === commentId
          ? {
              ...item,
              heartCount: payload.heartCount ?? item.heartCount,
              viewerHasHeart: payload.viewerHasHeart ?? item.viewerHasHeart,
            }
          : item,
      ),
    )
  }

  const reportComment = async (commentId: string) => {
    const details = window.prompt('Optional details for this report:') ?? ''
    const response = await fetch('/api/community/flags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityType: 'comment',
        entityId: commentId,
        reason: 'comment_report',
        details: details.trim() || null,
      }),
    })
    const payload = (await response.json()) as { message?: string }
    setStatus(payload.message ?? (response.ok ? 'Report submitted.' : 'Could not submit report.'))
  }

  const removeCommentAsAdmin = async (commentId: string) => {
    const reason = window.prompt('Optional removal reason (shown to owner):') ?? ''
    const response = await fetch('/api/admin/moderation/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityType: 'comment',
        entityId: commentId,
        reason: reason.trim() || null,
      }),
    })
    const payload = (await response.json()) as { message?: string }
    setStatus(payload.message ?? (response.ok ? 'Comment removed.' : 'Could not remove comment.'))
    if (response.ok) {
      await loadComments()
    }
  }

  return (
    <article className="soft-panel comment-thread-shell">
      <h2>
        <MessageCircle size={16} /> Discussion ({comments.length})
      </h2>

      <form className="stack-form" onSubmit={postComment}>
        <label>
          Add a comment
          <textarea maxLength={2000} onChange={(event) => setDraft(event.target.value)} rows={3} value={draft} />
        </label>
        <button className="button button-primary" type="submit">
          <Send size={14} /> Post
        </button>
      </form>

      {status ? <p>{status}</p> : null}
      {loading ? <p>Loading comments...</p> : null}
      {!loading && !comments.length ? <p>No comments yet. Start the thread.</p> : null}

      <div className="comment-tree">
        {(childrenByParent.get(null) ?? []).map((comment) => (
          <CommentBranch
            childrenByParent={childrenByParent}
            comment={comment}
            key={comment.id}
            onPostReply={postReply}
            onReplyDraftChange={(commentId, value) =>
              setReplyDrafts((current) => ({
                ...current,
                [commentId]: value,
              }))
            }
            onRemoveComment={removeCommentAsAdmin}
            onReportComment={reportComment}
            onToggleReply={(commentId) => setReplyOpenForId((current) => (current === commentId ? null : commentId))}
            onToggleHeart={toggleHeart}
            replyDraft={replyDrafts[comment.id] ?? ''}
            replyOpenForId={replyOpenForId}
            replyDrafts={replyDrafts}
            viewerIsAdmin={authUser?.role === 'admin'}
          />
        ))}
      </div>
    </article>
  )
}

function CommentBranch({
  comment,
  childrenByParent,
  replyOpenForId,
  replyDraft,
  replyDrafts,
  onToggleReply,
  onReplyDraftChange,
  onPostReply,
  onToggleHeart,
  onReportComment,
  onRemoveComment,
  viewerIsAdmin,
}: {
  comment: CommentNode
  childrenByParent: Map<string | null, CommentNode[]>
  replyOpenForId: string | null
  replyDraft: string
  replyDrafts: Record<string, string>
  onToggleReply: (commentId: string) => void
  onReplyDraftChange: (commentId: string, value: string) => void
  onPostReply: (event: FormEvent<HTMLFormElement>, parentCommentId: string) => Promise<void>
  onToggleHeart: (commentId: string) => Promise<void>
  onReportComment: (commentId: string) => Promise<void>
  onRemoveComment: (commentId: string) => Promise<void>
  viewerIsAdmin: boolean
}) {
  const replies = childrenByParent.get(comment.id) ?? []

  return (
    <div className="comment-node" style={{ '--comment-depth': String(comment.depth) } as React.CSSProperties}>
      <div className="comment-node-body">
        <div className="comment-node-head">
          <Link className="comment-author-link" params={{ userId: comment.author.id }} to="/profile/$userId">
            <span className="comment-author-dot">
              <img
                alt={comment.author.displayName}
                onError={(event) => {
                  event.currentTarget.style.display = 'none'
                  const fallback = event.currentTarget.nextElementSibling as HTMLElement | null
                  if (fallback) fallback.style.display = 'inline-flex'
                }}
                src={`/api/profiles/${comment.author.id}/avatar`}
              />
              <span className="comment-author-dot-fallback">{comment.author.displayName.slice(0, 1).toUpperCase()}</span>
            </span>
            <strong>{comment.author.displayName}</strong>
          </Link>
          <span>{new Date(comment.createdAt).toLocaleString()}</span>
        </div>
        <p>{comment.body}</p>
        {comment.moderationStatus === 'removed' && comment.moderationReason ? <p>{comment.moderationReason}</p> : null}
        <div className="hero-actions">
          <button className="button" onClick={() => void onToggleHeart(comment.id)} type="button">
            <img alt="" aria-hidden="true" className="heart-icon" src={comment.viewerHasHeart ? heartFull : heartEmpty} />
            {comment.heartCount}
          </button>
          {comment.moderationStatus !== 'removed' && comment.depth < 6 ? (
            <button className="button" onClick={() => onToggleReply(comment.id)} type="button">
              <Reply size={14} /> Reply
            </button>
          ) : null}
          <button className="button" onClick={() => void onReportComment(comment.id)} type="button">
            <Flag size={14} /> Report
          </button>
          {viewerIsAdmin && comment.moderationStatus !== 'removed' ? (
            <button className="button" onClick={() => void onRemoveComment(comment.id)} type="button">
              <XCircle size={14} /> Remove
            </button>
          ) : null}
        </div>

        {replyOpenForId === comment.id ? (
          <form className="stack-form comment-reply-form" onSubmit={(event) => void onPostReply(event, comment.id)}>
            <label>
              Reply
              <textarea
                maxLength={2000}
                onChange={(event) => onReplyDraftChange(comment.id, event.target.value)}
                rows={2}
                value={replyDraft}
              />
            </label>
            <button className="button" type="submit">
              <Send size={14} /> Post reply
            </button>
          </form>
        ) : null}
      </div>

      {replies.length ? (
        <div className="comment-children">
          {replies.map((reply) => (
            <CommentBranch
              childrenByParent={childrenByParent}
              comment={reply}
              key={reply.id}
              onPostReply={onPostReply}
              onReplyDraftChange={onReplyDraftChange}
              onRemoveComment={onRemoveComment}
              onReportComment={onReportComment}
              onToggleReply={onToggleReply}
              onToggleHeart={onToggleHeart}
              replyDraft={replyDrafts[reply.id] ?? ''}
              replyOpenForId={replyOpenForId}
              replyDrafts={replyDrafts}
              viewerIsAdmin={viewerIsAdmin}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
