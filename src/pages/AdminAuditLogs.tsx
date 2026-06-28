import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Activity, Filter } from "lucide-react"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useI18n } from "@/lib/i18n"

interface AuditLogUser {
  id: number
  username: string
  email: string
}

interface AuditLog {
  id: number
  log_type: string
  action: string
  resource: string
  user_id?: number
  user?: AuditLogUser
  api_key_id?: number
  method: string
  path: string
  query?: string
  status_code: number
  ip_address: string
  user_agent: string
  message: string
  duration_ms: number
  created_at: string
}

interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

const pageSize = 25

export default function AdminAuditLogs() {
  const { language } = useI18n()
  const copy = language === "zh" ? zhCopy : enCopy
  const [page, setPage] = useState(1)
  const [logType, setLogType] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [action, setAction] = useState("")
  const [path, setPath] = useState("")
  const [userID, setUserID] = useState("")
  const [statusCode, setStatusCode] = useState("")

  const { data = emptyPage<AuditLog>(page), isLoading } = useQuery<PaginatedResult<AuditLog>>({
    queryKey: ["audit-logs", page, logType, startDate, endDate, action, path, userID, statusCode],
    queryFn: async () => {
      const res = await api.get("/audit-logs", {
        params: cleanParams({
          paginated: 1,
          page,
          page_size: pageSize,
          log_type: logType,
          start_date: startDate,
          end_date: endDate,
          action,
          path,
          user_id: userID,
          status_code: statusCode,
        }),
      })
      return paginatedResult<AuditLog>(res.data, page)
    },
  })

  const resetFilters = () => {
    setLogType("")
    setStartDate("")
    setEndDate("")
    setAction("")
    setPath("")
    setUserID("")
    setStatusCode("")
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.page_size))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{copy.title}</h1>
        <div className="mt-2 text-sm text-muted-foreground">{copy.subtitle}</div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{copy.filters}</CardTitle>
          <Filter className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 lg:grid-cols-4">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">{copy.type}</span>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={logType} onChange={(event) => { setLogType(event.target.value); setPage(1) }}>
                <option value="">{copy.allTypes}</option>
                <option value="api">{copy.typeAPI}</option>
                <option value="login">{copy.typeLogin}</option>
                <option value="admin">{copy.typeAdmin}</option>
                <option value="system">{copy.typeSystem}</option>
              </select>
            </label>
            <FilterInput label={copy.startDate} value={startDate} type="date" onChange={(value) => { setStartDate(value); setPage(1) }} />
            <FilterInput label={copy.endDate} value={endDate} type="date" onChange={(value) => { setEndDate(value); setPage(1) }} />
            <FilterInput label={copy.statusCode} value={statusCode} type="number" placeholder="500" onChange={(value) => { setStatusCode(value); setPage(1) }} />
            <FilterInput label={copy.action} value={action} placeholder="login" onChange={(value) => { setAction(value); setPage(1) }} />
            <FilterInput label={copy.path} value={path} placeholder="/api/settings" onChange={(value) => { setPath(value); setPage(1) }} />
            <FilterInput label={copy.userID} value={userID} type="number" placeholder="1" onChange={(value) => { setUserID(value); setPage(1) }} />
            <div className="flex items-end">
              <Button variant="outline" onClick={resetFilters}>{copy.reset}</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{copy.logs}</CardTitle>
          <Activity className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{copy.time}</TableHead>
                  <TableHead>{copy.type}</TableHead>
                  <TableHead>{copy.action}</TableHead>
                  <TableHead>{copy.user}</TableHead>
                  <TableHead>{copy.request}</TableHead>
                  <TableHead>{copy.statusCode}</TableHead>
                  <TableHead>{copy.ip}</TableHead>
                  <TableHead>{copy.duration}</TableHead>
                  <TableHead>{copy.message}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">{copy.loading}</TableCell></TableRow>
                ) : data.items.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">{copy.empty}</TableCell></TableRow>
                ) : (
                  data.items.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-xs">{formatDateTime(log.created_at)}</TableCell>
                      <TableCell><span className={typeBadgeClass(log.log_type)}>{typeLabel(log.log_type, copy)}</span></TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs">{log.action}</TableCell>
                      <TableCell className="min-w-32 text-xs">{log.user ? `${log.user.username || log.user.email} #${log.user.id}` : log.user_id ? `#${log.user_id}` : "-"}</TableCell>
                      <TableCell className="min-w-72 text-xs">
                        <div className="font-mono">{log.method} {log.path}</div>
                        {log.query && <div className="truncate text-muted-foreground">?{log.query}</div>}
                      </TableCell>
                      <TableCell><span className={statusBadgeClass(log.status_code)}>{log.status_code || "-"}</span></TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{log.ip_address || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{log.duration_ms} ms</TableCell>
                      <TableCell className="max-w-80 truncate text-xs text-muted-foreground" title={log.message}>{log.message || log.user_agent || "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
            <span>{copy.total.replace("{total}", String(data.total))}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>{copy.prev}</Button>
              <span>{page} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>{copy.next}</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function FilterInput({ label, value, placeholder, type = "text", onChange }: { label: string; value: string; placeholder?: string; type?: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function cleanParams(params: Record<string, string | number>) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== ""))
}

function paginatedResult<T>(value: unknown, fallbackPage: number): PaginatedResult<T> {
  if (value && typeof value === "object" && Array.isArray((value as PaginatedResult<T>).items)) {
    const page = Number((value as PaginatedResult<T>).page || fallbackPage)
    const resolvedPageSize = Number((value as PaginatedResult<T>).page_size || pageSize)
    return { items: (value as PaginatedResult<T>).items, total: Number((value as PaginatedResult<T>).total || 0), page, page_size: resolvedPageSize }
  }
  return emptyPage<T>(fallbackPage)
}

function emptyPage<T>(page: number): PaginatedResult<T> {
  return { items: [], total: 0, page, page_size: pageSize }
}

function formatDateTime(value: string) {
  if (!value) return "-"
  return new Date(value).toLocaleString()
}

function typeLabel(value: string, copy: typeof zhCopy) {
  switch (value) {
    case "login": return copy.typeLogin
    case "admin": return copy.typeAdmin
    case "system": return copy.typeSystem
    default: return copy.typeAPI
  }
}

function typeBadgeClass(value: string) {
  const base = "inline-flex rounded-full px-2 py-1 text-xs font-medium"
  switch (value) {
    case "login": return `${base} bg-blue-500/10 text-blue-600`
    case "admin": return `${base} bg-amber-500/10 text-amber-600`
    case "system": return `${base} bg-purple-500/10 text-purple-600`
    default: return `${base} bg-muted text-muted-foreground`
  }
}

function statusBadgeClass(status: number) {
  const base = "inline-flex rounded-full px-2 py-1 text-xs font-medium"
  if (status >= 500) return `${base} bg-red-500/10 text-red-600`
  if (status >= 400) return `${base} bg-amber-500/10 text-amber-600`
  if (status >= 200 && status < 400) return `${base} bg-green-500/10 text-green-600`
  return `${base} bg-muted text-muted-foreground`
}

const zhCopy = {
  title: "日志查看",
  subtitle: "查看 API 调用、登录、管理修改和系统日志",
  filters: "筛选",
  logs: "审计日志",
  type: "类型",
  allTypes: "全部类型",
  typeAPI: "API 调用",
  typeLogin: "登录",
  typeAdmin: "管理修改",
  typeSystem: "系统",
  startDate: "开始日期",
  endDate: "结束日期",
  statusCode: "状态码",
  action: "动作",
  path: "路径",
  userID: "用户 ID",
  reset: "重置",
  time: "时间",
  user: "用户",
  request: "请求",
  ip: "IP",
  duration: "耗时",
  message: "消息 / User-Agent",
  loading: "加载中...",
  empty: "暂无日志",
  total: "共 {total} 条",
  prev: "上一页",
  next: "下一页",
}

const enCopy = {
  title: "Audit Logs",
  subtitle: "View API access, login, admin change, and system logs",
  filters: "Filters",
  logs: "Audit Logs",
  type: "Type",
  allTypes: "All types",
  typeAPI: "API",
  typeLogin: "Login",
  typeAdmin: "Admin Change",
  typeSystem: "System",
  startDate: "Start date",
  endDate: "End date",
  statusCode: "Status",
  action: "Action",
  path: "Path",
  userID: "User ID",
  reset: "Reset",
  time: "Time",
  user: "User",
  request: "Request",
  ip: "IP",
  duration: "Duration",
  message: "Message / User-Agent",
  loading: "Loading...",
  empty: "No logs",
  total: "{total} total",
  prev: "Prev",
  next: "Next",
}
