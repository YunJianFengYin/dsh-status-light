window.__ModuleLoader__.load({
  id: '@local/dsh-status-light',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Read-only aggregate route served by this bundle's Host half. */
    const STATE_URL = '/_dsh/status-light/state.json'
    const MUTED_KEY = 'dsh.status-light.muted'
    const POLL_MS = 700
    const REPEAT_MS = 3200
    const BEEP_MS = 0.11
    const BEEP_GAIN = 0.055
    const REACHABLE_FAILURES = 3

    const DICT = {
      en: {
        idle: 'Idle',
        running: 'Working',
        waiting: 'Waiting for you',
        offline: 'Not connected',
        muted: 'Muted',
        question: 'question',
        approval: 'approval',
        'plan-review': 'plan review',
        tower: 'Workspace conversation light',
        mute: 'Mute the buzzer',
        unmute: 'Turn the buzzer on',
        hint: 'Click to toggle the buzzer',
        soundLocked: 'Click the page once to allow sound',
        empty: 'No conversations',
      },
      zh: {
        idle: '空闲',
        running: '运行中',
        waiting: '等待你处理',
        offline: '未连接',
        muted: '已静音',
        question: '提问',
        approval: '授权',
        'plan-review': '计划审阅',
        tower: '工作区对话信号灯',
        mute: '静音蜂鸣器',
        unmute: '开启蜂鸣器',
        hint: '点击切换蜂鸣器',
        soundLocked: '点一下页面以开启声音',
        empty: '暂无对话',
      },
    }

    const CSS = `
.dsh-sl-root {
  position: fixed;
  right: 18px;
  bottom: 16px;
  z-index: 70;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  pointer-events: none;
  user-select: none;
  font: 11px/1.45 system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;
}
.dsh-sl-tower {
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 0;
  padding: 9px 8px 7px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(128, 128, 128, 0.32));
  border-radius: 15px;
  background: var(--dsw-alias-bg-overlay, rgba(30, 30, 32, 0.94));
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.14);
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease;
}
.dsh-sl-tower:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(0, 0, 0, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.16); }
.dsh-sl-tower:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #4d8dff); outline-offset: 3px; }
.dsh-sl-lamp {
  display: block;
  width: 28px;
  height: 28px;
  margin: 3px 0;
  border-radius: 50%;
  background: radial-gradient(circle at 34% 30%, rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0) 48%), var(--sl-dim);
  box-shadow: inset 0 0 0 3px var(--sl-rim), inset 0 2px 6px rgba(0, 0, 0, 0.55), 0 1px 1px rgba(255, 255, 255, 0.08);
  opacity: 0.34;
  filter: saturate(0.3) brightness(0.72);
  transition: opacity 0.2s ease, filter 0.2s ease, box-shadow 0.2s ease;
}
.dsh-sl-lamp.is-on {
  opacity: 1;
  filter: none;
  box-shadow: inset 0 0 0 3px var(--sl-rim), 0 0 14px 3px var(--sl-glow), inset 0 -7px 13px rgba(255, 255, 255, 0.2);
}
.dsh-sl-lamp-red { --sl-dim: #6d1a16; --sl-rim: #2b0c0a; --sl-glow: rgba(255, 59, 48, 0.78); }
.dsh-sl-lamp-amber { --sl-dim: #6e4a09; --sl-rim: #2c1e05; --sl-glow: rgba(255, 176, 32, 0.72); }
.dsh-sl-lamp-green { --sl-dim: #176033; --sl-rim: #072815; --sl-glow: rgba(52, 199, 89, 0.66); }
.dsh-sl-lamp-red.is-on { background: radial-gradient(circle at 34% 30%, #fff1ef, #ff3b30 42%, #a71c16 100%); animation: dsh-sl-pulse 1.1s ease-in-out infinite; }
.dsh-sl-lamp-amber.is-on { background: radial-gradient(circle at 34% 30%, #fff8e6, #ffb020 44%, #a86f06 100%); animation: dsh-sl-blink 1.6s steps(1, end) infinite; }
.dsh-sl-lamp-green.is-on { background: radial-gradient(circle at 34% 30%, #effff4, #34c759 44%, #1c7f3b 100%); animation: dsh-sl-breathe 3.2s ease-in-out infinite; }
.dsh-sl-base {
  display: block;
  width: 34px;
  height: 9px;
  margin-top: 5px;
  border-radius: 0 0 5px 5px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(0, 0, 0, 0.28));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.26);
}
.dsh-sl-caption {
  pointer-events: auto;
  max-width: 132px;
  padding: 0 2px;
  text-align: center;
  color: var(--dsw-alias-label-secondary, #9aa0a6);
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
@keyframes dsh-sl-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
@keyframes dsh-sl-blink { 0%, 62% { opacity: 1; } 63%, 100% { opacity: 0.26; } }
@keyframes dsh-sl-breathe { 0%, 100% { opacity: 1; } 50% { opacity: 0.78; } }
@media (prefers-reduced-motion: reduce) {
  .dsh-sl-lamp.is-on { animation: none; }
  .dsh-sl-tower { transition: none; }
}
`

    function createBuzzer() {
      let audio = null
      let closed = false

      function ensure() {
        if (closed) return null
        if (audio) return audio
        const Ctor = window.AudioContext || window.webkitAudioContext
        if (!Ctor) return null
        try {
          audio = new Ctor()
        } catch (error) {
          audio = null
        }
        return audio
      }

      function tone(delaySeconds, frequency) {
        const context = ensure()
        if (!context) return
        if (context.state === 'suspended') context.resume().catch(() => {})
        if (context.state !== 'running') return
        const start = context.currentTime + delaySeconds
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        oscillator.type = 'square'
        oscillator.frequency.setValueAtTime(frequency, start)
        oscillator.frequency.linearRampToValueAtTime(frequency * 0.9, start + BEEP_MS)
        gain.gain.setValueAtTime(0.0001, start)
        gain.gain.exponentialRampToValueAtTime(BEEP_GAIN, start + 0.012)
        gain.gain.setValueAtTime(BEEP_GAIN, start + BEEP_MS - 0.028)
        gain.gain.exponentialRampToValueAtTime(0.0001, start + BEEP_MS)
        oscillator.connect(gain)
        gain.connect(context.destination)
        oscillator.start(start)
        oscillator.stop(start + BEEP_MS + 0.02)
        oscillator.onended = () => {
          try {
            oscillator.disconnect()
            gain.disconnect()
          } catch (error) {
            /* already detached */
          }
        }
      }

      return {
        unlock() {
          const context = ensure()
          if (context && context.state === 'suspended') context.resume().catch(() => {})
        },
        alarm() {
          tone(0, 2080)
          tone(0.18, 2080)
        },
        test() {
          tone(0, 1560)
        },
        close() {
          closed = true
          if (audio) {
            try {
              audio.close()
            } catch (error) {
              /* already closed */
            }
            audio = null
          }
        },
      }
    }

    function createWidget(ctx, buzzer) {
      function readMuted() {
        try {
          return window.localStorage.getItem(MUTED_KEY) === '1'
        } catch (error) {
          return false
        }
      }

      function writeMuted(value) {
        try {
          window.localStorage.setItem(MUTED_KEY, value ? '1' : '0')
        } catch (error) {
          /* storage unavailable */
        }
      }

      function dictionary() {
        let id = ''
        try {
          const locale = ctx.get('locale')
          const snapshot = typeof locale?.getLocale === 'function' ? locale.getLocale() : null
          id = String(snapshot?.id ?? snapshot?.locale ?? snapshot?.current ?? '')
        } catch (error) {
          id = ''
        }
        if (!id) {
          try {
            id = String(window.navigator?.language ?? '')
          } catch (error) {
            id = ''
          }
        }
        return /^zh\b/i.test(id) || /^zh/i.test(id) ? DICT.zh : DICT.en
      }

      function StatusLight() {
        const [, setLocaleTick] = React.useState(0)
        const [snapshot, setSnapshot] = React.useState(null)
        const [muted, setMuted] = React.useState(readMuted)
        const [soundUnlocked, setSoundUnlocked] = React.useState(false)
        const levelRef = React.useRef('unknown')
        const mutedRef = React.useRef(muted)
        const dict = dictionary()

        React.useEffect(() => {
          const locale = ctx.get('locale')
          if (!locale || typeof locale.subscribe !== 'function') return undefined
          return locale.subscribe(() => setLocaleTick((tick) => tick + 1))
        }, [])

        React.useEffect(() => {
          let stopped = false
          let timer = 0
          let failures = 0
          const controller = new AbortController()
          const poll = async () => {
            try {
              const response = await fetch(STATE_URL, { cache: 'no-store', signal: controller.signal })
              if (!response.ok) throw new Error(`HTTP ${response.status}`)
              const next = await response.json()
              if (stopped) return
              failures = 0
              setSnapshot(next)
            } catch (error) {
              if (stopped) return
              failures += 1
              if (failures >= REACHABLE_FAILURES) setSnapshot(null)
            }
            if (!stopped) timer = window.setTimeout(poll, POLL_MS)
          }
          void poll()
          return () => {
            stopped = true
            window.clearTimeout(timer)
            controller.abort()
          }
        }, [])

        const level = snapshot && typeof snapshot.level === 'string' ? snapshot.level : 'unknown'
        levelRef.current = level
        mutedRef.current = muted

        React.useEffect(() => {
          if (muted || level !== 'waiting') return undefined
          let stopped = false
          let timer = 0
          const play = () => {
            if (stopped) return
            buzzer.alarm()
            timer = window.setTimeout(play, REPEAT_MS)
          }
          play()
          return () => {
            stopped = true
            window.clearTimeout(timer)
          }
        }, [level, muted])

        React.useEffect(() => {
          const unlock = () => {
            buzzer.unlock()
            setSoundUnlocked(true)
            if (levelRef.current === 'waiting' && !mutedRef.current) buzzer.alarm()
          }
          window.addEventListener('pointerdown', unlock, { once: true, capture: true })
          window.addEventListener('keydown', unlock, { once: true, capture: true })
          return () => {
            window.removeEventListener('pointerdown', unlock, true)
            window.removeEventListener('keydown', unlock, true)
          }
        }, [])

        const counts = snapshot?.counts ?? { total: 0, waiting: 0, running: 0 }
        const waitingRows = Array.isArray(snapshot?.waiting) ? snapshot.waiting : []
        const runningRows = Array.isArray(snapshot?.running) ? snapshot.running : []

        let caption
        if (level === 'unknown') caption = dict.offline
        else if (level === 'waiting') caption = `${dict.waiting} ${counts.waiting}`
        else if (level === 'running') caption = `${dict.running} ${counts.running}`
        else caption = dict.idle
        if (muted) caption = `${caption} · ${dict.muted}`

        const lines = [dict.tower]
        if (level === 'unknown') {
          lines.push(dict.offline)
        } else {
          lines.push(`${dict.waiting} ${counts.waiting}`)
          for (const row of waitingRows.slice(0, 6)) {
            const reason = dict[row.kind] ?? row.kind
            const detail = typeof row.label === 'string' && row.label.length > 0 ? ` (${row.label.slice(0, 40)})` : ''
            lines.push(`· ${row.title || row.id.slice(0, 8)} — ${reason}${detail}`)
          }
          if (counts.running > 0) {
            lines.push(`${dict.running} ${counts.running}`)
            for (const row of runningRows.slice(0, 4)) {
              lines.push(`· ${row.title || row.id.slice(0, 8)}`)
            }
          }
          if (counts.total === 0) lines.push(dict.empty)
        }
        if (level === 'waiting' && !muted && !soundUnlocked) lines.push(dict.soundLocked)
        lines.push(muted ? dict.unmute : dict.mute)
        const tooltip = lines.join('\n')

        const toggle = (event) => {
          event.preventDefault()
          const next = !muted
          setMuted(next)
          writeMuted(next)
          if (!next) {
            buzzer.unlock()
            buzzer.test()
            setSoundUnlocked(true)
          }
        }

        const lamp = (color, on) => h('span', { key: color, className: `dsh-sl-lamp dsh-sl-lamp-${color}${on ? ' is-on' : ''}` })

        return h(
          'div',
          { className: 'dsh-sl-root' },
          h('style', null, CSS),
          h(
            'button',
            {
              type: 'button',
              className: 'dsh-sl-tower',
              title: tooltip,
              'aria-label': `${caption} · ${tooltip}`,
              'aria-live': 'polite',
              onClick: toggle,
            },
            lamp('red', level === 'waiting'),
            lamp('amber', level === 'running'),
            lamp('green', level === 'idle'),
            h('span', { className: 'dsh-sl-base' }),
          ),
          h('span', { className: 'dsh-sl-caption' }, caption),
        )
      }

      return StatusLight
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const buzzer = createBuzzer()
        ctx.effect(() => () => buzzer.close(), 'dsh-status-light: buzzer')
        const Widget = createWidget(ctx, buzzer)
        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register({ name: 'shell.overlay', id: 'dsh-status-light', order: 100 }, Widget),
        )
      },
    }
  },
})
