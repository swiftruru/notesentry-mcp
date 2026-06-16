import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import { Copy, Check, Download, LayoutGrid, Braces } from 'lucide-react'

// 最小 FHIR 型別（僅取本 app 會用到的欄位）。
type Coding = { system?: string; code?: string; display?: string }
type Quantity = { value?: number; unit?: string; system?: string; code?: string }
type FhirComponent = { code?: { coding?: Coding[] }; valueQuantity?: Quantity }
interface Observation {
  resourceType?: string
  status?: string
  category?: { coding?: Coding[] }[]
  code?: { coding?: Coding[]; text?: string }
  effectiveDateTime?: string
  valueQuantity?: Quantity
  component?: FhirComponent[]
  subject?: { reference?: string }
}
interface FhirBundle {
  resourceType?: string
  type?: string
  total?: number
  entry?: { resource?: Observation }[]
}

/** 偵測工具結果是否為 FHIR Bundle（含 nis server 的 {format,bundle} 外層）。 */
function detectFhirBundle(content: string): FhirBundle | null {
  try {
    const obj = JSON.parse(content) as { bundle?: unknown; resourceType?: string }
    const b = (obj?.bundle ?? obj) as FhirBundle
    return b && typeof b === 'object' && b.resourceType === 'Bundle' ? b : null
  } catch {
    return null
  }
}

function tryParseJson(content: string): unknown | undefined {
  try {
    return JSON.parse(content)
  } catch {
    return undefined
  }
}

/** 工具結果呈現：FHIR → Observation 卡片；一般 JSON → 縮排美化；其餘 → 原始文字。 */
export function ToolResult({ content }: { content: string }): React.JSX.Element {
  const { t } = useTranslation('chat')
  const pushToast = useAppStore((s) => s.pushToast)
  const [showRaw, setShowRaw] = useState(false)
  const [copied, setCopied] = useState(false)

  const bundle = useMemo(() => detectFhirBundle(content), [content])
  const parsed = useMemo(() => (bundle ? undefined : tryParseJson(content)), [content, bundle])
  const pretty = useMemo(
    () => (parsed !== undefined ? JSON.stringify(parsed, null, 2) : null),
    [parsed]
  )
  const canExport = !!bundle || pretty !== null

  const copy = (): void => {
    void navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  const exportJson = async (): Promise<void> => {
    const r = await window.api.saveTextFile('fhir-bundle.json', content)
    if (r.saved) pushToast(t('message.exported'), 'success')
    else if (r.error) pushToast(r.error, 'error')
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        {bundle && (
          <>
            <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand">
              {t('message.fhirBadge')}
            </span>
            <span className="text-[11px] text-ink-muted">
              {t('message.fhirObs', { count: bundle.entry?.length ?? 0 })}
            </span>
          </>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          {bundle && (
            <ToolbarBtn
              icon={showRaw ? LayoutGrid : Braces}
              label={showRaw ? t('message.viewCards') : t('message.viewRaw')}
              onClick={() => setShowRaw((v) => !v)}
            />
          )}
          <ToolbarBtn
            icon={copied ? Check : Copy}
            label={copied ? t('common:actions.copied') : t('common:actions.copy')}
            onClick={copy}
          />
          {canExport && (
            <ToolbarBtn
              icon={Download}
              label={t('message.exportJson')}
              onClick={() => void exportJson()}
            />
          )}
        </div>
      </div>

      {bundle && !showRaw ? (
        <FhirBundleView bundle={bundle} />
      ) : (
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-ink">
          {pretty ?? content}
        </pre>
      )}
    </div>
  )
}

function ToolbarBtn({
  icon: Icon,
  label,
  onClick
}: {
  icon: typeof Copy
  label: string
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-ink-muted transition-colors hover:bg-surface hover:text-ink"
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  )
}

function FhirBundleView({ bundle }: { bundle: FhirBundle }): React.JSX.Element {
  const obs = (bundle.entry ?? []).map((e) => e.resource).filter((r): r is Observation => !!r)
  return (
    <div className="space-y-2">
      {obs.map((r, i) => (
        <ObservationCard key={i} obs={r} />
      ))}
    </div>
  )
}

function ObservationCard({ obs }: { obs: Observation }): React.JSX.Element {
  const name = obs.code?.text || obs.code?.coding?.[0]?.display || 'Observation'
  const loinc = obs.code?.coding?.[0]?.code
  const vq = obs.valueQuantity
  const categoryCode = obs.category?.[0]?.coding?.[0]?.code
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-ink">{name}</span>
        {vq && (
          <span className="shrink-0 text-lg font-bold tabular-nums text-brand">
            {vq.value}
            {vq.unit && <span className="ml-1 text-xs font-normal text-ink-muted">{vq.unit}</span>}
          </span>
        )}
      </div>
      {obs.component && obs.component.length > 0 && (
        <div className="mt-1.5 space-y-0.5 border-t border-border pt-1.5">
          {obs.component.map((c, i) => (
            <div key={i} className="flex items-baseline justify-between gap-2 text-xs">
              <span className="text-ink-muted">{c.code?.coding?.[0]?.display}</span>
              <span className="shrink-0 font-semibold tabular-nums text-ink">
                {c.valueQuantity?.value} {c.valueQuantity?.unit}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
        {loinc && <Badge>LOINC {loinc}</Badge>}
        {vq?.code && <Badge>UCUM {vq.code}</Badge>}
        {obs.status && <Badge>{obs.status}</Badge>}
        {categoryCode && <Badge>{categoryCode}</Badge>}
        {obs.subject?.reference && <Badge>{obs.subject.reference}</Badge>}
      </div>
    </div>
  )
}

function Badge({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <span className={cn('rounded bg-card px-1.5 py-0.5 font-mono text-ink-muted')}>{children}</span>
  )
}
