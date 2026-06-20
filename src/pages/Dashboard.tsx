import { Activity, AlertTriangle, BarChart3, CheckCircle2, Clock, CreditCard, Database, DollarSign, LineChart, Megaphone, Server } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import api from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { PublicSettings } from "@/lib/public-settings"
import { withPublicSettingsDefaults } from "@/lib/public-settings"

interface CurrentUser {
  username: string
  balance: string | number
}

interface UserStats {
  balance: string | number
  total_requests: number
  today_requests: number
  total_cost: string | number
  rpm: number
  tpm: number
}

interface Announcement {
  id: number
  title: string
  content: string
  created_at: string
}

interface PublicStatusMonitor {
  id: number
  name: string
  status: string
  latency_ms: number
  last_checked_at?: string | null
  uptime: number
}

interface PublicStatusResponse {
  monitors: PublicStatusMonitor[]
}

interface StatCard {
  title: string
  value: string | number
  icon: LucideIcon
  color: string
}

export default function Dashboard() {
  const { t } = useI18n()
  const { data: user, isLoading: isUserLoading } = useQuery<CurrentUser>({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await api.get("/user/me")
      return res.data
    },
  })
  const { data: userStats } = useQuery<UserStats>({
    queryKey: ["stats", "user"],
    queryFn: async () => {
      const res = await api.get("/user/stats")
      return res.data
    },
  })
  const { data: settings } = useQuery<PublicSettings>({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const res = await api.get("/public/settings")
      return res.data
    },
  })
  const { data: announcements = [], isLoading: isAnnouncementsLoading } = useQuery<Announcement[]>({
    queryKey: ["public-announcements"],
    queryFn: async () => {
      const res = await api.get("/public/announcements")
      return Array.isArray(res.data) ? res.data : []
    },
  })
  const { data: publicStatus, isLoading: isStatusLoading, isError: isStatusError } = useQuery<PublicStatusResponse>({
    queryKey: ["public-status"],
    queryFn: async () => {
      const res = await api.get("/public/status")
      return res.data
    },
    retry: false,
    refetchInterval: 30000,
  })

  const currencyDisplayName = withPublicSettingsDefaults(settings).payment_currency_display_name
  const cards = isUserLoading ? userCards(t, currencyDisplayName) : userCards(t, currencyDisplayName, userStats, user)
  const monitors = publicStatus?.monitors || []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{t("dashboard.title")}</h1>
        <div className="mt-2 text-sm text-muted-foreground">
          {t("dashboard.signedInAs")} {user?.username || t("common.user")}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className={cn("h-4 w-4", card.color)} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("dashboard.announcements")}</CardTitle>
            <Megaphone className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isAnnouncementsLoading ? (
              <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">{t("common.loading")}</div>
            ) : announcements.length === 0 ? (
              <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">{t("dashboard.noAnnouncements")}</div>
            ) : (
              <div className="space-y-3">
                {announcements.map((announcement) => (
                  <article key={announcement.id} className="rounded-md border p-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <h2 className="text-base font-semibold">{announcement.title}</h2>
                      <div className="shrink-0 text-xs text-muted-foreground">{formatDateTime(announcement.created_at)}</div>
                    </div>
                    <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{announcement.content}</div>
                  </article>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("dashboard.nodeStatus")}</CardTitle>
            <Server className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isStatusLoading ? (
              <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">{t("common.loading")}</div>
            ) : isStatusError ? (
              <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">{t("dashboard.statusUnavailable")}</div>
            ) : monitors.length === 0 ? (
              <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">{t("dashboard.noNodeStatus")}</div>
            ) : (
              <div className="grid gap-3">
                {monitors.map((monitor) => (
                  <div key={monitor.id} className="rounded-md border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{monitor.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {t("dashboard.lastCheck")}: {formatDateTime(monitor.last_checked_at)}
                        </div>
                      </div>
                      <div className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-medium", statusBadgeClass(monitor.status))}>
                        <StatusIcon status={monitor.status} />
                        {statusLabel(monitor.status, t)}
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-md bg-muted/50 p-2">
                        <div className="text-xs text-muted-foreground">{t("dashboard.latency")}</div>
                        <div className="mt-1 font-medium">{formatLatency(monitor.latency_ms)}</div>
                      </div>
                      <div className="rounded-md bg-muted/50 p-2">
                        <div className="text-xs text-muted-foreground">{t("dashboard.uptime")}</div>
                        <div className="mt-1 font-medium">{formatPercent(monitor.uptime)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function userCards(t: ReturnType<typeof useI18n>["t"], currencyDisplayName: string, stats?: UserStats, user?: CurrentUser): StatCard[] {
  return [
    { title: t("common.balance"), value: `${currencyDisplayName}${stats?.balance ?? user?.balance ?? 0}`, icon: CreditCard, color: "text-blue-500" },
    { title: t("dashboard.todayRequests"), value: stats?.today_requests || 0, icon: Activity, color: "text-green-500" },
    { title: t("dashboard.totalRequests"), value: stats?.total_requests || 0, icon: Database, color: "text-purple-500" },
    { title: t("dashboard.rpm"), value: stats?.rpm || 0, icon: BarChart3, color: "text-cyan-500" },
    { title: t("dashboard.tpm"), value: stats?.tpm || 0, icon: LineChart, color: "text-pink-500" },
    { title: t("dashboard.totalCost"), value: `${currencyDisplayName}${stats?.total_cost || 0}`, icon: DollarSign, color: "text-yellow-500" },
  ]
}

function StatusIcon({ status }: { status: string }) {
  switch ((status || "").toLowerCase()) {
    case "up":
      return <CheckCircle2 size={14} />
    case "down":
      return <AlertTriangle size={14} />
    default:
      return <Clock size={14} />
  }
}

function statusBadgeClass(status: string) {
  switch ((status || "").toLowerCase()) {
    case "up":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
    case "down":
      return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
    default:
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
  }
}

function statusLabel(status: string, t: ReturnType<typeof useI18n>["t"]) {
  switch ((status || "").toLowerCase()) {
    case "up":
      return t("dashboard.statusUp")
    case "down":
      return t("dashboard.statusDown")
    default:
      return t("dashboard.statusPending")
  }
}

function formatLatency(value: number) {
  if (!value || value <= 0) {
    return "-"
  }
  return `${value}ms`
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) {
    return "-"
  }
  return `${value.toFixed(2)}%`
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-"
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}
