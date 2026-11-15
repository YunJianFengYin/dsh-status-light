window.__ModuleLoader__.load({
  id: '@local/dsh-status-light',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Read-only aggregate route served by this bundle's Host half. */
    const STATE_URL = '/_dsh/status-light/state.json'
    const MUTED_KEY = 'dsh.status-light.muted'
    const VOLUME_KEY = 'dsh.status-light.volume'
    const SIZE_KEY = 'dsh.status-light.size'
    const POLL_MS = 700
    const REACHABLE_FAILURES = 3
    /** One fixed buzzer frequency; no sweep, so it reads as a plant buzzer. */
    const BUZZER_HZ = 2100
    /** Low-pass corner that keeps the square wave from turning into a chirp. */
    const BUZZER_LOWPASS_HZ = 3200
    /** 1 s on, 0.6 s off, repeating. */
    const BURST_SECONDS = 1.0
    const REPEAT_MS = 1600
    /** Gain at 100 % volume. */
    const MAX_GAIN = 0.16
    const DEFAULT_VOLUME = 0.45
    /** Tower footprint in CSS px; the drawing keeps the reference proportions. */
    const DEFAULT_TOWER_WIDTH = 40
    const MIN_TOWER_WIDTH = 24
    const MAX_TOWER_WIDTH = 88
    const TOWER_STEP = 4

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
        volume: 'Buzzer volume',
        size: 'Tower size',
        settings: 'Status light settings',
        buzzer: 'Buzzer',
        preview: 'Test',
        close: 'Close settings',
        hint: 'Left or right click opens settings',
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
        volume: '蜂鸣器音量',
        size: '信号塔大小',
        settings: '信号灯设置',
        buzzer: '蜂鸣器',
        preview: '试听',
        close: '关闭设置',
        hint: '左键或右键打开设置',
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
  gap: 4px;
  pointer-events: none;
  user-select: none;
  font: 11px/1.45 system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;
}
.dsh-sl-tower {
  pointer-events: auto;
  display: block;
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  line-height: 0;
  transition: transform 0.16s ease;
}
.dsh-sl-tower:hover { transform: translateY(-2px); }
.dsh-sl-tower:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #4d8dff); outline-offset: 4px; border-radius: 8px; }
.dsh-sl-svg { display: block; overflow: visible; filter: drop-shadow(0 7px 10px rgba(0, 0, 0, 0.3)); }
.dsh-sl-lens-red.is-on { animation: dsh-sl-pulse 1.1s ease-in-out infinite; }
.dsh-sl-lens-amber.is-on { animation: dsh-sl-blink 1.6s steps(1, end) infinite; }
.dsh-sl-lens-green.is-on { animation: dsh-sl-breathe 3.2s ease-in-out infinite; }
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
.dsh-sl-panel {
  pointer-events: auto;
  position: absolute;
  right: 0;
  bottom: calc(100% + 8px);
  width: 212px;
  padding: 10px 12px 12px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(128, 128, 128, 0.32));
  border-radius: 12px;
  background: var(--dsw-alias-bg-overlay, rgba(30, 30, 32, 0.96));
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.3);
  color: var(--dsw-alias-label-primary, #e8eaed);
  font: 12px/1.5 system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;
}
.dsh-sl-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}
.dsh-sl-panel-title {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dsh-sl-close {
  flex: none;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #9aa0a6);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}
.dsh-sl-close:hover {
  background: var(--dsw-alias-bg-layer-2, rgba(255, 255, 255, 0.08));
  color: var(--dsw-alias-label-primary, #e8eaed);
}
.dsh-sl-panel-status {
  margin-bottom: 4px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(128, 128, 128, 0.24));
  color: var(--dsw-alias-label-secondary, #9aa0a6);
}
.dsh-sl-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 10px;
}
.dsh-sl-row-label { color: var(--dsw-alias-label-secondary, #9aa0a6); }
.dsh-sl-row-value {
  min-width: 34px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-secondary, #9aa0a6);
}
.dsh-sl-switch {
  position: relative;
  flex: none;
  width: 36px;
  height: 20px;
  padding: 0;
  border: 1px solid var(--dsw-alias-border-l2, rgba(128, 128, 128, 0.4));
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-2, rgba(255, 255, 255, 0.1));
  cursor: pointer;
  transition: background 0.16s ease, border-color 0.16s ease;
}
.dsh-sl-switch.is-on {
  background: var(--dsw-alias-brand-primary, #4d8dff);
  border-color: transparent;
}
.dsh-sl-switch:focus-visible,
.dsh-sl-close:focus-visible,
.dsh-sl-test:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary, #4d8dff);
  outline-offset: 2px;
}
.dsh-sl-switch-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
  transition: transform 0.16s ease;
}
.dsh-sl-switch.is-on .dsh-sl-switch-knob { transform: translateX(16px); }
.dsh-sl-range {
  pointer-events: auto;
  flex: 1;
  min-width: 0;
  height: 16px;
  margin: 0;
  accent-color: var(--dsw-alias-brand-primary, #4d8dff);
  cursor: pointer;
}
.dsh-sl-range:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary, #4d8dff);
  outline-offset: 2px;
  border-radius: 4px;
}
.dsh-sl-test {
  pointer-events: auto;
  margin-left: auto;
  padding: 3px 12px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(128, 128, 128, 0.4));
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-primary, #e8eaed);
  font: inherit;
  cursor: pointer;
}
.dsh-sl-test:hover { background: var(--dsw-alias-bg-layer-2, rgba(255, 255, 255, 0.08)); }
@keyframes dsh-sl-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
@keyframes dsh-sl-blink { 0%, 62% { opacity: 1; } 63%, 100% { opacity: 0.3; } }
@keyframes dsh-sl-breathe { 0%, 100% { opacity: 1; } 50% { opacity: 0.8; } }
@media (prefers-reduced-motion: reduce) {
  .dsh-sl-lens.is-on { animation: none; }
  .dsh-sl-tower { transition: none; }
}
`

    /** The reference tower: 50 mm lenses, 36 mm lens height, 6 mm spacers, 56 mm body. */
    function towerSvg(level, width, greenOn) {
      const on = { red: level === 'waiting', amber: level === 'running', green: level === 'idle' && greenOn !== false }

      const gens = []
      for (const [name, stops] of [
        ['sl-red-off', ['#260b09', '#4a1512', '#370f0c', '#190605']],
        ['sl-red-on', ['#d1382f', '#ff8d80', '#ff3b30', '#d2271e', '#8d100b']],
        ['sl-amber-off', ['#241b03', '#453508', '#352806', '#170f02']],
        ['sl-amber-on', ['#d9a52a', '#ffe08a', '#ffb020', '#d68a00', '#8a5600']],
        ['sl-green-off', ['#071c10', '#0f3421', '#0a2818', '#041309']],
        ['sl-green-on', ['#3fbf68', '#a8f5c1', '#34c759', '#17903f', '#0c5c28']],
      ]) {
        gens.push(
          h(
            'linearGradient',
            { key: name, id: name, x1: '0', x2: '1', y1: '0', y2: '0' },
            stops.map((color, index) =>
              h('stop', { key: index, offset: String(index / (stops.length - 1)), stopColor: color }),
            ),
          ),
        )
      }

      const lens = (color, y, active) =>
        h(
          'g',
          { key: color, className: `dsh-sl-lens dsh-sl-lens-${color}${active ? ' is-on' : ''}` },
          active
            ? h('rect', { x: 9, y: y - 2, width: 52, height: 40, rx: 5, fill: `url(#sl-${color}-on)`, opacity: 0.62, filter: 'url(#sl-glow)' })
            : null,
          h('rect', { x: 10, y, width: 50, height: 36, fill: `url(#sl-${color}-${active ? 'on' : 'off'})` }),
          h('rect', { x: 10, y, width: 50, height: 36, fill: 'url(#sl-ribs)', opacity: active ? 1 : 0.45 }),
          h('rect', { x: 10, y, width: 50, height: 36, fill: 'url(#sl-gloss)', opacity: active ? 1 : 0.28 }),
          h('rect', { x: 10, y, width: 50, height: 0.8, fill: '#fff', opacity: active ? 0.3 : 0.07 }),
        )

      const spacer = (key, y) =>
        h(
          'g',
          { key },
          h('rect', { x: 10, y, width: 50, height: 6, fill: 'url(#sl-white)' }),
          h('rect', { x: 10, y: y + 5.2, width: 50, height: 0.8, fill: '#000', opacity: 0.12 }),
        )

      return h(
        'svg',
        {
          className: 'dsh-sl-svg',
          viewBox: '0 0 70 200',
          width,
          height: Math.round((width * 200) / 70),
          'aria-hidden': true,
          focusable: 'false',
        },
        h(
          'defs',
          null,
          h(
            'linearGradient',
            { id: 'sl-white', x1: '0', x2: '1', y1: '0', y2: '0' },
            h('stop', { offset: '0', stopColor: '#c9ced5' }),
            h('stop', { offset: '0.16', stopColor: '#ffffff' }),
            h('stop', { offset: '0.52', stopColor: '#eff1f4' }),
            h('stop', { offset: '0.84', stopColor: '#d9dde2' }),
            h('stop', { offset: '1', stopColor: '#b9bfc7' }),
          ),
          gens,
          h(
            'linearGradient',
            { id: 'sl-gloss', x1: '0', x2: '1', y1: '0', y2: '0' },
            h('stop', { offset: '0.04', stopColor: '#ffffff', stopOpacity: '0.5' }),
            h('stop', { offset: '0.22', stopColor: '#ffffff', stopOpacity: '0.08' }),
            h('stop', { offset: '0.55', stopColor: '#ffffff', stopOpacity: '0' }),
            h('stop', { offset: '0.86', stopColor: '#000000', stopOpacity: '0.14' }),
            h('stop', { offset: '1', stopColor: '#000000', stopOpacity: '0.34' }),
          ),
          h(
            'pattern',
            { id: 'sl-ribs', width: '8', height: '3.2', patternUnits: 'userSpaceOnUse' },
            h('rect', { y: '2.6', width: '8', height: '0.6', fill: '#000000', opacity: '0.22' }),
            h('rect', { y: '0', width: '8', height: '0.45', fill: '#ffffff', opacity: '0.16' }),
          ),
          h('filter', { id: 'sl-glow', x: '-40%', y: '-25%', width: '180%', height: '150%' }, h('feGaussianBlur', { stdDeviation: '3' })),
        ),
        // plain white body, no name plate and no text
        h('rect', { x: 10, y: 135.5, width: 50, height: 56, rx: 2, fill: 'url(#sl-white)' }),
        h('rect', { x: 10, y: 135.5, width: 50, height: 0.9, fill: '#000000', opacity: 0.14 }),
        // lenses
        lens('red', 15.5, on.red),
        spacer('spacer-1', 51.5),
        lens('amber', 57.5, on.amber),
        spacer('spacer-2', 93.5),
        lens('green', 99.5, on.green),
        // cap
        h('rect', { x: 10, y: 8, width: 50, height: 7.5, rx: 3, fill: 'url(#sl-white)', stroke: '#b3b9c1', strokeWidth: 0.5 }),
      )
    }

    function createBuzzer() {
      let audio = null
      let closed = false
      let volume = DEFAULT_VOLUME

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

      /** One steady tone at one frequency: no sweep, no double beep. */
      function tone(offset, seconds) {
        const context = ensure()
        if (!context) return
        if (context.state === 'suspended') context.resume().catch(() => {})
        if (context.state !== 'running') return
        const peak = MAX_GAIN * Math.max(0, Math.min(1, volume))
        if (!(peak > 0.0002)) return

        const start = context.currentTime + 0.01 + Math.max(0, offset)
        const end = start + Math.max(0.12, seconds)
        const release = end - 0.06
        const oscillator = context.createOscillator()
        const filter = context.createBiquadFilter()
        const gain = context.createGain()

        oscillator.type = 'square'
        oscillator.frequency.setValueAtTime(BUZZER_HZ, start)
        filter.type = 'lowpass'
        filter.frequency.setValueAtTime(BUZZER_LOWPASS_HZ, start)
        filter.Q.setValueAtTime(0.7, start)
        gain.gain.setValueAtTime(0.0001, start)
        gain.gain.exponentialRampToValueAtTime(peak, start + 0.012)
        gain.gain.setValueAtTime(peak, release)
        gain.gain.exponentialRampToValueAtTime(0.0001, end)

        oscillator.connect(filter)
        filter.connect(gain)
        gain.connect(context.destination)
        oscillator.start(start)
        oscillator.stop(end + 0.02)
        oscillator.onended = () => {
          try {
            oscillator.disconnect()
            filter.disconnect()
            gain.disconnect()
          } catch (error) {
            /* already detached */
          }
        }
      }

      return {
        setVolume(next) {
          volume = Number.isFinite(next) ? Math.max(0, Math.min(1, next)) : DEFAULT_VOLUME
        },
        unlock() {
          const context = ensure()
          if (context && context.state === 'suspended') context.resume().catch(() => {})
        },
        alarm() {
          tone(0, BURST_SECONDS)
        },
        /**
         * A conversation stopped running while others may keep working:
         * (0.3 on + 0.1 off + 0.3 on) + 0.3 off + (0.3 on + 0.1 off + 0.3 on).
         */
        idle() {
          tone(0, 0.3)
          tone(0.4, 0.3)
          tone(1.0, 0.3)
          tone(1.4, 0.3)
        },
        test() {
          tone(0, 0.24)
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

      function readVolume() {
        try {
          const raw = Number(window.localStorage.getItem(VOLUME_KEY))
          if (Number.isFinite(raw) && raw >= 0 && raw <= 100) return raw / 100
        } catch (error) {
          /* storage unavailable */
        }
        return DEFAULT_VOLUME
      }

      function writeVolume(value) {
        try {
          window.localStorage.setItem(VOLUME_KEY, String(Math.round(value * 100)))
        } catch (error) {
          /* storage unavailable */
        }
      }

      function readSize() {
        try {
          const raw = Number(window.localStorage.getItem(SIZE_KEY))
          if (Number.isFinite(raw) && raw >= MIN_TOWER_WIDTH && raw <= MAX_TOWER_WIDTH) return Math.round(raw)
        } catch (error) {
          /* storage unavailable */
        }
        return DEFAULT_TOWER_WIDTH
      }

      function writeSize(value) {
        try {
          window.localStorage.setItem(SIZE_KEY, String(Math.round(value)))
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
        return /^zh/i.test(id) ? DICT.zh : DICT.en
      }

      function StatusLight() {
        const [, setLocaleTick] = React.useState(0)
        const [snapshot, setSnapshot] = React.useState(null)
        const [muted, setMuted] = React.useState(readMuted)
        const [volume, setVolume] = React.useState(readVolume)
        const [size, setSize] = React.useState(readSize)
        const [greenOn, setGreenOn] = React.useState(true)
        const [soundUnlocked, setSoundUnlocked] = React.useState(false)
        const [panelOpen, setPanelOpen] = React.useState(false)
        const rootRef = React.useRef(null)
        const levelRef = React.useRef('unknown')
        const mutedRef = React.useRef(muted)
        const seenBeeps = React.useRef(null)
        const dict = dictionary()

        React.useEffect(() => {
          const locale = ctx.get('locale')
          if (!locale || typeof locale.subscribe !== 'function') return undefined
          return locale.subscribe(() => setLocaleTick((tick) => tick + 1))
        }, [])

        React.useEffect(() => {
          buzzer.setVolume(volume)
        }, [volume])

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
              const beeps = typeof next?.idleBeeps === 'number' ? next.idleBeeps : null
              if (beeps !== null) {
                const previous = seenBeeps.current
                seenBeeps.current = beeps
                // A conversation just stopped running, even if others keep working.
                if (previous !== null && beeps > previous && !mutedRef.current) buzzer.idle()
              }
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

        // Entering idle: three blinks (1.2 s lit, 0.5 s dark), then steady green.
        React.useEffect(() => {
          if (level !== 'idle') {
            setGreenOn(true)
            return undefined
          }
          let cancelled = false
          const timers = []
          for (let index = 0; index < 3; index += 1) {
            const start = index * 1700
            timers.push(
              window.setTimeout(() => {
                if (!cancelled) setGreenOn(false)
              }, start + 1200),
            )
            timers.push(
              window.setTimeout(() => {
                if (!cancelled) setGreenOn(true)
              }, start + 1700),
            )
          }
          return () => {
            cancelled = true
            for (const timer of timers) window.clearTimeout(timer)
          }
        }, [level])

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

        React.useEffect(() => {
          if (!panelOpen) return undefined
          const onPointerDown = (event) => {
            if (rootRef.current && rootRef.current.contains(event.target)) return
            setPanelOpen(false)
          }
          const onKeyDown = (event) => {
            if (event.key === 'Escape') setPanelOpen(false)
          }
          document.addEventListener('pointerdown', onPointerDown, true)
          document.addEventListener('keydown', onKeyDown)
          return () => {
            document.removeEventListener('pointerdown', onPointerDown, true)
            document.removeEventListener('keydown', onKeyDown)
          }
        }, [panelOpen])

        const counts = snapshot?.counts ?? { total: 0, waiting: 0, running: 0 }
        const waitingRows = Array.isArray(snapshot?.waiting) ? snapshot.waiting : []
        const runningRows = Array.isArray(snapshot?.running) ? snapshot.running : []
        const percent = Math.round(volume * 100)
        const silent = muted || percent === 0

        let caption
        if (level === 'unknown') caption = dict.offline
        else if (level === 'waiting') caption = `${dict.waiting} ${counts.waiting}`
        else if (level === 'running') caption = `${dict.running} ${counts.running}`
        else caption = dict.idle
        if (silent) caption = `${caption} · ${dict.muted}`

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
        if (level === 'waiting' && !silent && !soundUnlocked) lines.push(dict.soundLocked)
        lines.push(`${dict.volume}: ${percent}%`)
        lines.push(dict.hint)
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

        const changeVolume = (event) => {
          const next = Math.max(0, Math.min(100, Number(event.target.value) || 0)) / 100
          setVolume(next)
          writeVolume(next)
          buzzer.setVolume(next)
          buzzer.unlock()
          setSoundUnlocked(true)
          if (muted && next > 0) {
            setMuted(false)
            writeMuted(false)
          }
        }

        const previewVolume = () => {
          buzzer.unlock()
          setSoundUnlocked(true)
          if (!muted && volume > 0) buzzer.test()
        }

        const changeSize = (event) => {
          const raw = Number(event.target.value) || DEFAULT_TOWER_WIDTH
          const next = Math.round(Math.max(MIN_TOWER_WIDTH, Math.min(MAX_TOWER_WIDTH, raw)))
          setSize(next)
          writeSize(next)
        }

        const openPanel = () => {
          buzzer.unlock()
          setSoundUnlocked(true)
          setPanelOpen(true)
        }

        const panel = panelOpen
          ? h(
              'div',
              { className: 'dsh-sl-panel', role: 'dialog', 'aria-label': dict.settings },
              h(
                'div',
                { className: 'dsh-sl-panel-head' },
                h('span', { className: 'dsh-sl-panel-title' }, dict.settings),
                h('button', { type: 'button', className: 'dsh-sl-close', 'aria-label': dict.close, onClick: () => setPanelOpen(false) }, '×'),
              ),
              h('div', { className: 'dsh-sl-panel-status' }, caption),
              h(
                'div',
                { className: 'dsh-sl-row' },
                h('span', { className: 'dsh-sl-row-label' }, dict.buzzer),
                h(
                  'button',
                  {
                    type: 'button',
                    role: 'switch',
                    'aria-checked': !muted,
                    'aria-label': dict.buzzer,
                    className: `dsh-sl-switch${muted ? '' : ' is-on'}`,
                    onClick: toggle,
                  },
                  h('span', { className: 'dsh-sl-switch-knob' }),
                ),
              ),
              h(
                'div',
                { className: 'dsh-sl-row' },
                h('span', { className: 'dsh-sl-row-label' }, dict.volume),
                h('input', {
                  type: 'range',
                  className: 'dsh-sl-range',
                  min: 0,
                  max: 100,
                  step: 5,
                  value: percent,
                  'aria-label': dict.volume,
                  'aria-valuetext': `${percent}%`,
                  onChange: changeVolume,
                  onPointerDown: () => {
                    buzzer.unlock()
                    setSoundUnlocked(true)
                  },
                  onPointerUp: previewVolume,
                  onKeyUp: previewVolume,
                }),
                h('span', { className: 'dsh-sl-row-value' }, `${percent}%`),
              ),
              h(
                'div',
                { className: 'dsh-sl-row' },
                h('span', { className: 'dsh-sl-row-label' }, dict.size),
                h('input', {
                  type: 'range',
                  className: 'dsh-sl-range',
                  min: MIN_TOWER_WIDTH,
                  max: MAX_TOWER_WIDTH,
                  step: TOWER_STEP,
                  value: size,
                  'aria-label': dict.size,
                  'aria-valuetext': `${size}px`,
                  onChange: changeSize,
                }),
                h('span', { className: 'dsh-sl-row-value' }, `${size}px`),
              ),
              h('div', { className: 'dsh-sl-row' }, h('button', { type: 'button', className: 'dsh-sl-test', onClick: previewVolume }, dict.preview)),
            )
          : null

        return h(
          'div',
          { className: 'dsh-sl-root', ref: rootRef },
          h('style', null, CSS),
          panel,
          h(
            'button',
            {
              type: 'button',
              className: 'dsh-sl-tower',
              title: tooltip,
              'aria-label': `${caption} · ${tooltip}`,
              'aria-live': 'polite',
              'aria-haspopup': 'dialog',
              'aria-expanded': panelOpen,
              onClick: () => setPanelOpen((open) => !open),
              onContextMenu: (event) => {
                event.preventDefault()
                openPanel()
              },
            },
            towerSvg(level, size, greenOn),
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
