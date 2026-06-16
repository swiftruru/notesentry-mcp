import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store/useAppStore'
import { Input, Textarea, Label } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Stethoscope, FileText, Send, Sparkles, ListPlus } from 'lucide-react'

type Tab = 'triage' | 'soap'

// 檢傷範例的生命徵象（主訴文字走 i18n presets.triage[]，索引對齊）。
const TRIAGE_VITALS = [
  { age: '65', temp: '36.8', hr: '132', rr: '26', spo2: '91', sbp: '85', dbp: '50', gcs: '15' },
  { age: '78', temp: '39.5', hr: '118', rr: '24', spo2: '93', sbp: '88', dbp: '55', gcs: '13' },
  { age: '45', temp: '37.0', hr: '110', rr: '28', spo2: '89', sbp: '130', dbp: '80', gcs: '15' }
]

/** 兩個表單共用的「載入範例 / AI 生成範例」工具列。 */
function SampleToolbar({
  onLoad,
  onAi,
  loading
}: {
  onLoad: () => void
  onAi: () => void
  loading: boolean
}): React.JSX.Element {
  const { t } = useTranslation('apps')
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" onClick={onLoad}>
        <ListPlus className="h-3.5 w-3.5" />
        {t('loadSample')}
      </Button>
      <Button type="button" variant="secondary" size="sm" onClick={onAi} disabled={loading}>
        <Sparkles className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        {loading ? t('generating') : t('aiGenerate')}
      </Button>
    </div>
  )
}

export function AppsView(): React.JSX.Element {
  const { t } = useTranslation('apps')
  const [tab, setTab] = useState<Tab>('triage')

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-6 py-3">
        <h1 className="text-sm font-semibold text-ink">{t('title')}</h1>
        <p className="text-xs text-ink-muted">{t('desc')}</p>
      </div>

      {/* 分頁 */}
      <div className="flex gap-1 border-b border-border px-4 pt-2">
        <TabButton active={tab === 'triage'} onClick={() => setTab('triage')}>
          <Stethoscope className="h-4 w-4" />
          {t('triage.tab')}
        </TabButton>
        <TabButton active={tab === 'soap'} onClick={() => setTab('soap')}>
          <FileText className="h-4 w-4" />
          {t('soap.tab')}
        </TabButton>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto max-w-xl">{tab === 'triage' ? <TriageForm /> : <SoapForm />}</div>
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-1.5 rounded-t-md px-3 py-2 text-sm font-medium transition-colors',
        active ? 'border-b-2 border-brand text-brand' : 'text-ink-muted hover:text-ink'
      )}
    >
      {children}
    </button>
  )
}

/** 應用 A：檢傷——主訴 + 生命徵象 → 組提示 → runApp（觸發 assess_vital_signs + get_ttas_reference）。 */
function TriageForm(): React.JSX.Element {
  const { t } = useTranslation('apps')
  const runApp = useAppStore((s) => s.runApp)
  const pushToast = useAppStore((s) => s.pushToast)
  const [v, setV] = useState({
    complaint: '',
    age: '',
    temp: '',
    hr: '',
    rr: '',
    spo2: '',
    sbp: '',
    dbp: '',
    gcs: ''
  })
  const [presetIdx, setPresetIdx] = useState(0)
  const [genLoading, setGenLoading] = useState(false)
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((s) => ({ ...s, [k]: e.target.value }))

  const loadPreset = (): void => {
    const texts = t('presets.triage', { returnObjects: true }) as string[]
    const i = presetIdx % TRIAGE_VITALS.length
    setV({ complaint: texts[i] ?? '', ...TRIAGE_VITALS[i] })
    setPresetIdx(i + 1)
  }

  const aiGenerate = async (): Promise<void> => {
    setGenLoading(true)
    try {
      const r = await window.api.generateSample('triage')
      if (r) {
        const g = (k: string): string => (r[k] != null ? String(r[k]) : '')
        setV({
          complaint: g('complaint'),
          age: g('age'),
          temp: g('temp'),
          hr: g('hr'),
          rr: g('rr'),
          spo2: g('spo2'),
          sbp: g('sbp'),
          dbp: g('dbp'),
          gcs: g('gcs')
        })
      } else {
        loadPreset()
        pushToast(t('genFailed'), 'info')
      }
    } finally {
      setGenLoading(false)
    }
  }

  const submit = (): void => {
    const vitals: string[] = []
    if (v.age) vitals.push(`年齡 ${v.age} 歲`)
    if (v.temp) vitals.push(`體溫 ${v.temp}°C`)
    if (v.hr) vitals.push(`心跳 ${v.hr}/分`)
    if (v.rr) vitals.push(`呼吸 ${v.rr}/分`)
    if (v.spo2) vitals.push(`血氧 ${v.spo2}%`)
    if (v.sbp || v.dbp) vitals.push(`血壓 ${v.sbp || '?'}/${v.dbp || '?'} mmHg`)
    if (v.gcs) vitals.push(`GCS ${v.gcs}`)
    const prompt = t('triage.prompt', {
      complaint: v.complaint.trim() || '（未填）',
      vitals: vitals.join('、') || '（未填）'
    })
    runApp(prompt)
  }

  const canSubmit = v.complaint.trim() !== '' || Object.values(v).some((x) => x !== '')

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-muted">{t('triage.hint')}</p>
      <SampleToolbar onLoad={loadPreset} onAi={() => void aiGenerate()} loading={genLoading} />
      <Field label={t('triage.complaint')}>
        <Input
          value={v.complaint}
          onChange={set('complaint')}
          placeholder={t('triage.complaintPlaceholder')}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label={t('triage.age')}>
          <Input type="number" value={v.age} onChange={set('age')} placeholder="65" />
        </Field>
        <Field label={t('triage.temp')}>
          <Input type="number" value={v.temp} onChange={set('temp')} placeholder="38.5" />
        </Field>
        <Field label={t('triage.hr')}>
          <Input type="number" value={v.hr} onChange={set('hr')} placeholder="110" />
        </Field>
        <Field label={t('triage.rr')}>
          <Input type="number" value={v.rr} onChange={set('rr')} placeholder="22" />
        </Field>
        <Field label={t('triage.spo2')}>
          <Input type="number" value={v.spo2} onChange={set('spo2')} placeholder="94" />
        </Field>
        <Field label={t('triage.sbp')}>
          <Input type="number" value={v.sbp} onChange={set('sbp')} placeholder="90" />
        </Field>
        <Field label={t('triage.dbp')}>
          <Input type="number" value={v.dbp} onChange={set('dbp')} placeholder="60" />
        </Field>
        <Field label={t('triage.gcs')}>
          <Input type="number" value={v.gcs} onChange={set('gcs')} placeholder="15" />
        </Field>
      </div>
      <Button onClick={submit} disabled={!canSubmit} className="w-full">
        <Send className="h-4 w-4" />
        {t('triage.submit')}
      </Button>
    </div>
  )
}

/** 應用 B：SOAP——病歷類型 + 關鍵字 → 組提示 → runApp（觸發 get_soap_template）。 */
function SoapForm(): React.JSX.Element {
  const { t } = useTranslation('apps')
  const runApp = useAppStore((s) => s.runApp)
  const pushToast = useAppStore((s) => s.pushToast)
  const [noteType, setNoteType] = useState('急診醫師病歷')
  const [keywords, setKeywords] = useState('')
  const [presetIdx, setPresetIdx] = useState(0)
  const [genLoading, setGenLoading] = useState(false)

  const submit = (): void => {
    const prompt = t('soap.prompt', { noteType, keywords: keywords.trim() })
    runApp(prompt)
  }

  const loadPreset = (): void => {
    const texts = t('presets.soap', { returnObjects: true }) as string[]
    const i = presetIdx % texts.length
    setKeywords(texts[i] ?? '')
    setPresetIdx(i + 1)
  }

  const aiGenerate = async (): Promise<void> => {
    setGenLoading(true)
    try {
      const r = await window.api.generateSample('soap')
      if (r) {
        if (r.noteType != null) setNoteType(String(r.noteType))
        setKeywords(r.keywords != null ? String(r.keywords) : '')
      } else {
        loadPreset()
        pushToast(t('genFailed'), 'info')
      }
    } finally {
      setGenLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-muted">{t('soap.hint')}</p>
      <SampleToolbar onLoad={loadPreset} onAi={() => void aiGenerate()} loading={genLoading} />
      <Field label={t('soap.noteType')}>
        <select
          value={noteType}
          onChange={(e) => setNoteType(e.target.value)}
          className="flex h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option>急診醫師病歷</option>
          <option>護理紀錄</option>
          <option>出院摘要</option>
        </select>
      </Field>
      <Field label={t('soap.keywords')}>
        <Textarea
          rows={4}
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder={t('soap.keywordsPlaceholder')}
        />
      </Field>
      <Button onClick={submit} disabled={keywords.trim() === ''} className="w-full">
        <Send className="h-4 w-4" />
        {t('soap.submit')}
      </Button>
    </div>
  )
}

function Field({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
