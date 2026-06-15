import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/primitives'
import { ConversationItem } from './ConversationItem'
import { Plus, Search, MessagesSquare } from 'lucide-react'

export function ConversationList(): React.JSX.Element {
  const { t } = useTranslation('conversations')
  const conversations = useAppStore((s) => s.conversations)
  const newConversation = useAppStore((s) => s.newConversation)
  const setSearch = useAppStore((s) => s.setSearch)
  const searchQuery = useAppStore((s) => s.searchQuery)
  const [q, setQ] = useState(searchQuery)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 搜尋 debounce（250ms）
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => void setSearch(q), 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [q, setSearch])

  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-surface">
      <div className="space-y-2 p-3">
        <Button className="w-full" onClick={newConversation}>
          <Plus className="h-4 w-4" />
          {t('newChat')}
        </Button>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="pl-8"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
        {conversations.length === 0 ? (
          <div className="mt-10 flex flex-col items-center gap-2 px-4 text-center text-xs text-ink-muted">
            <MessagesSquare className="h-6 w-6 opacity-50" />
            {searchQuery ? t('emptySearch') : t('emptyInitial')}
          </div>
        ) : (
          conversations.map((m) => <ConversationItem key={m.id} meta={m} />)
        )}
      </div>
    </div>
  )
}
