/**
 * Host half of the factory status-light bundle.
 *
 * It watches every conversation this profile can list, remembers which ones are
 * currently blocked on the user (a question, an approval prompt), and serves one
 * merged snapshot to the Web UI over a small read-only route. The browser half
 * only draws that snapshot and sounds the buzzer.
 */

/** Read-only aggregate route polled by the browser half. */
const ROUTE_PATH = '/_dsh/status-light/state.json'
/** Caching window of the conversation list, so polls share one list read. */
const LIST_CACHE_MS = 1500
/** Upper bound of waiting conversations named in one payload. */
const MAX_WAITING = 8
/** Upper bound of working conversations named in one payload. */
const MAX_RUNNING = 6
/** Upper bound of a waiting label echoed to the UI. */
const MAX_LABEL_LENGTH = 90
/** Session key used when a wait carries no resolvable conversation identity. */
const FALLBACK_SESSION = 'waiting:unresolved'
/** Tools whose whole execution window means "the agent is blocked on the user". */
const HUMAN_WAIT_TOOLS = new Set(['ask_user_question'])
/** A pending approval that never reaches execution is dropped after this long. */
const ASK_WINDOW_TIMEOUT_MS = 10 * 60 * 1000

const noop = () => {}

/**
 * Merge every conversation into one of three states: waiting for the user,
 * still working, or idle. A waiting conversation always outranks a working one.
 */
export function apply(ctx) {
  /** @type {Map<string, Array<{ token: number, kind: string, label: string, since: number }>>} */
  const waits = new Map()
  let tokenSeq = 0
  /** Cached conversation rows; the waiting flags merge in live on every request. */
  const listCache = { at: 0, rows: [] }
  /** Calls whose pre-execute decision is `ask`: the user is being asked for approval. */
  const askWindows = new Map()

  function releaseAsk(callId) {
    const entry = askWindows.get(callId)
    if (!entry) return
    askWindows.delete(callId)
    entry.release()
  }

  function enterWait(sessionId, kind, label) {
    if (typeof sessionId !== 'string' || sessionId.length === 0) return noop
    const token = ++tokenSeq
    const stack = waits.get(sessionId) ?? []
    stack.push({ token, kind, label: truncate(label), since: Date.now() })
    waits.set(sessionId, stack)
    return () => {
      const current = waits.get(sessionId)
      if (!current) return
      const index = current.findIndex((entry) => entry.token === token)
      if (index < 0) return
      current.splice(index, 1)
      if (current.length === 0) waits.delete(sessionId)
    }
  }

  /**
   * Resolve the conversation a request belongs to. The scoped dispatch carries
   * the agent in its scope tag, so a payload field is not always filled; fall
   * back to the process-local initiating agent and finally to one shared bucket.
   */
  function resolveSessionId(request) {
    const direct = request?.agent?.id
    if (typeof direct === 'string' && direct.length > 0) return direct
    try {
      const initiator = ctx.get('agents')?.currentInitiator?.()
      const id = initiator && typeof initiator.id === 'string' ? initiator.id : ''
      if (id.length > 0) return id
    } catch (error) {
      /* no initiator available */
    }
    return FALLBACK_SESSION
  }

  // A blocking question may be asked directly through the waterfall. Observing
  // the exchange without claiming it means answering behaviour is unchanged.
  ctx.on('user-questions/request', async (request, next) => {
    const intent = Array.isArray(request?.questions)
      ? request.questions.find((question) => question && question.intent)?.intent
      : undefined
    const kind = intent && intent.kind === 'plan-review' ? 'plan-review' : 'question'
    const release = enterWait(resolveSessionId(request), kind, questionLabel(request))
    try {
      return await next()
    } finally {
      release()
    }
  })

  // Permission prompts are the same kind of waterfall wait.
  ctx.on('approval/request', async (request, next) => {
    const toolName = typeof request?.toolName === 'string' ? request.toolName : ''
    const release = enterWait(resolveSessionId(request), 'approval', toolName)
    try {
      return await next()
    } finally {
      release()
    }
  })

  // A high-privilege call asks composed answerers before dispatch: the final
  // `ask` decision marks the exact window in which the user must approve it.
  // Registered first so this observer still sees a decision another listener owns.
  const onPreExecute = async (exec, next) => {
    const decision = await next()
    if (decision && decision.kind === 'ask') {
      const callId = typeof exec?.callId === 'string' ? exec.callId : ''
      const agentId = exec?.agent?.id
      const sessionId = typeof agentId === 'string' && agentId.length > 0 ? agentId : FALLBACK_SESSION
      const release = enterWait(sessionId, 'approval', typeof exec?.name === 'string' ? exec.name : '')
      if (callId) askWindows.set(callId, { release, at: Date.now() })
      else release()
    }
    return decision
  }
  try {
    ctx.on('tools/pre-execute', onPreExecute, true)
  } catch (error) {
    ctx.on('tools/pre-execute', onPreExecute)
  }

  // The call resumed after an approval, finished, or was refused: stop waiting.
  ctx.on('tools/result', (exec) => {
    if (exec && typeof exec.callId === 'string') releaseAsk(exec.callId)
  })

  // The Web UI answers a question through a timed wait instead of the request
  // waterfall, so the reliable signal is the ask tool's own execution window:
  // it stays pending exactly while the agent is blocked on the user.
  ctx.on('tools/execute', async (exec, next) => {
    if (exec && typeof exec.callId === 'string') releaseAsk(exec.callId)
    const name = typeof exec?.name === 'string' ? exec.name : ''
    if (!HUMAN_WAIT_TOOLS.has(name)) return next()
    const agentId = exec?.agent?.id
    const sessionId = typeof agentId === 'string' && agentId.length > 0 ? agentId : FALLBACK_SESSION
    const release = enterWait(sessionId, 'question', questionLabel(exec?.arguments))
    try {
      return await next()
    } finally {
      release()
    }
  })

  /** Cached conversation rows: one list read serves every poll for a while. */
  async function conversationRows() {
    if (listCache.rows.length > 0 && Date.now() - listCache.at < LIST_CACHE_MS) return listCache.rows
    const controller = ctx.get('sessionController')
    if (!controller || typeof controller.list !== 'function') return listCache.rows

    let summaries = []
    try {
      const value = await controller.list({}, AbortSignal.timeout(3000))
      if (Array.isArray(value?.items)) summaries = value.items
    } catch (error) {
      ctx.logger?.warn?.('dsh-status-light: conversation list unavailable', error)
      return listCache.rows
    }

    const rows = []
    for (const summary of summaries) {
      if (!summary || typeof summary.sessionId !== 'string') continue
      if (summary.origin === 'subagent') continue
      if (summary.blank === true && summary.running !== true) continue
      rows.push({ id: summary.sessionId, title: titleOf(summary), running: summary.running === true })
    }
    listCache.at = Date.now()
    listCache.rows = rows
    return rows
  }

  async function collect() {
    const now = Date.now()
    for (const [callId, entry] of askWindows) {
      if (now - entry.at > ASK_WINDOW_TIMEOUT_MS) {
        askWindows.delete(callId)
        entry.release()
      }
    }

    const rows = await conversationRows()
    const titles = new Map(rows.map((row) => [row.id, row.title]))

    const waiting = []
    for (const [sessionId, stack] of waits) {
      if (stack.length === 0) continue
      const current = stack[stack.length - 1]
      waiting.push({
        id: sessionId,
        title: titles.get(sessionId) ?? '',
        kind: current.kind,
        label: current.label,
        since: current.since,
      })
    }
    waiting.sort((left, right) => left.since - right.since)

    // A waiting conversation outranks its own run: only count the rest as working.
    const working = rows.filter((row) => row.running && !(waits.get(row.id)?.length > 0))
    return {
      version: 1,
      level: waiting.length > 0 ? 'waiting' : working.length > 0 ? 'running' : 'idle',
      at: Date.now(),
      counts: {
        total: rows.length,
        waiting: waiting.length,
        running: working.length,
        idle: Math.max(0, rows.length - waiting.length - working.length),
      },
      waiting: waiting.slice(0, MAX_WAITING),
      running: working.slice(0, MAX_RUNNING).map((row) => ({ id: row.id, title: row.title })),
    }
  }

  ctx.inject(['webServer'], (web) => {
    web.effect(
      () =>
        web.webServer.register({
          kind: 'exact',
          path: ROUTE_PATH,
          resource: async () => {
            let body
            try {
              body = JSON.stringify(await collect())
            } catch (error) {
              ctx.logger?.warn?.('dsh-status-light: snapshot failed', error)
              body = JSON.stringify({
                version: 1,
                level: 'unknown',
                at: Date.now(),
                counts: { total: 0, waiting: 0, running: 0, idle: 0 },
                waiting: [],
                running: [],
              })
            }
            return new Response(body, {
              status: 200,
              headers: {
                'content-type': 'application/json; charset=utf-8',
                'cache-control': 'no-store',
                'x-content-type-options': 'nosniff',
              },
            })
          },
        }),
      'dsh-status-light: aggregate state route',
    )
  })
}

/** Extract a display title from a Session summary without depending on one projection shape. */
function titleOf(summary) {
  const values = summary?.projections?.values
  if (values && typeof values === 'object') {
    const candidate = values.title ?? values.sessionTitle
    const text = typeof candidate === 'string' ? candidate : candidate?.title ?? candidate?.text
    if (typeof text === 'string' && text.trim().length > 0) return text.trim()
  }
  if (typeof summary?.cwd === 'string' && summary.cwd.length > 0) {
    const parts = summary.cwd.split(/[\\/]/).filter(Boolean)
    if (parts.length > 0) return parts[parts.length - 1]
  }
  return ''
}

function questionLabel(request) {
  const questions = Array.isArray(request?.questions) ? request.questions : []
  for (const question of questions) {
    if (typeof question?.question === 'string' && question.question.trim().length > 0) {
      return question.question.trim()
    }
  }
  return ''
}

function truncate(text) {
  if (typeof text !== 'string') return ''
  const trimmed = text.trim()
  return trimmed.length > MAX_LABEL_LENGTH ? `${trimmed.slice(0, MAX_LABEL_LENGTH - 1)}…` : trimmed
}
