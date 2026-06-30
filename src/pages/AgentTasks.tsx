import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, CheckCircle2, Clock3, ExternalLink, GitBranch, Loader2, RefreshCw, Workflow } from "lucide-react"
import { Link } from "react-router-dom"
import api from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface AgentTaskEvent {
  id: number
  run_id: string
  session_id: string
  seq: number
  event: string
  payload?: Record<string, unknown>
  created_at: string
}

interface AgentTaskRun {
  run_id: string
  session_id: string
  session_title?: string
  status: string
  status_message?: string
  started_at?: string
  updated_at: string
  events?: AgentTaskEvent[]
}

interface AgentTaskNode {
  taskID: string
  parentID: string
  kind: string
  status: string
  groupID: string
  groupName: string
  agentID: string
  agentName: string
  agentType: string
  goal: string
  result: string
  error: string
  startedAt: string
  updatedAt: string
  events: AgentTaskEvent[]
}

const agentTasksQueryKey = ["advanced-chat-agent-tasks"] as const

export default function AgentTasks() {
  const { language } = useI18n()
  const copy = language === "zh" ? zhCopy : enCopy
  const { data: runs = [], isFetching, refetch } = useQuery<AgentTaskRun[]>({
    queryKey: agentTasksQueryKey,
    refetchInterval: 3000,
    queryFn: async () => {
      const res = await api.get("/user/advanced-chat/agent-tasks")
      return Array.isArray(res.data) ? res.data.map(normalizeRun).filter((run): run is AgentTaskRun => Boolean(run)) : []
    },
  })

  const activeTaskCount = useMemo(() => runs.reduce((sum, run) => sum + buildTaskNodes(run.events || []).filter((task) => task.status === "running").length, 0), [runs])

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-primary" />
            <h1 className="truncate text-2xl font-semibold tracking-normal">{copy.title}</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{copy.subtitle}</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          {copy.refresh}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label={copy.runningRuns} value={String(runs.length)} />
        <Metric label={copy.runningTasks} value={String(activeTaskCount)} />
        <Metric label={copy.updatedAt} value={formatTime(latestUpdate(runs)) || "-"} />
      </div>

      {runs.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-40 flex-col items-center justify-center gap-2 text-center">
            <Clock3 className="h-8 w-8 text-muted-foreground" />
            <div className="text-sm font-medium">{copy.emptyTitle}</div>
            <div className="max-w-md text-sm text-muted-foreground">{copy.emptyText}</div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {runs.map((run) => (
            <RunTaskPanel key={run.run_id} run={run} copy={copy} />
          ))}
        </div>
      )}
    </div>
  )
}

function RunTaskPanel({ run, copy }: { run: AgentTaskRun; copy: CopyText }) {
  const tasks = buildTaskNodes(run.events || [])
  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex min-w-0 items-center gap-2 text-base">
              <GitBranch className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">{run.session_title || copy.untitledSession}</span>
            </CardTitle>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{copy.run}: {shortID(run.run_id)}</span>
              <span>{copy.started}: {formatTime(run.started_at) || "-"}</span>
              <StatusPill status={run.status} label={run.status_message || run.status} />
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to={`/chat/session/${encodeURIComponent(run.session_id)}`}>
              <ExternalLink className="mr-2 h-4 w-4" />
              {copy.openChat}
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">{copy.noAgentTasks}</div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task, index) => (
              <TaskRow key={task.taskID} task={task} index={index} copy={copy} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TaskRow({ task, index, copy }: { task: AgentTaskNode; index: number; copy: CopyText }) {
  const statusIcon = task.status === "completed" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : task.status === "error" ? <AlertTriangle className="h-4 w-4 text-destructive" /> : <Loader2 className="h-4 w-4 animate-spin text-primary" />
  return (
    <div className="rounded-md border bg-background p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-xs font-medium">{index + 1}</span>
            {statusIcon}
            <span className="truncate text-sm font-semibold">{task.agentName || task.agentID || copy.unknownAgent}</span>
            <StatusPill status={task.status} label={task.status} />
            <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">{task.kind || "agent"}</span>
            <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">{task.agentType || "worker"}</span>
          </div>
          {task.groupName && <div className="text-xs text-muted-foreground">{copy.group}: {task.groupName} ({shortID(task.groupID)})</div>}
          <div className="text-xs text-muted-foreground">{copy.callChain}: {callChainLabel(task, copy)}</div>
          {task.parentID && <div className="text-xs text-muted-foreground">{copy.parentCall}: {shortID(task.parentID)}</div>}
          <div className="break-words text-sm">{task.goal}</div>
        </div>
        <div className="shrink-0 text-xs text-muted-foreground">{formatTime(task.updatedAt)}</div>
      </div>
      {(task.result || task.error) && (
        <div className={cn("mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border p-3 text-xs", task.error ? "border-destructive/40 bg-destructive/5" : "bg-muted/40")}>
          {task.error || task.result}
        </div>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  )
}

function StatusPill({ status, label }: { status: string; label: string }) {
  const normalized = status.toLowerCase()
  return (
    <span className={cn("inline-flex max-w-full items-center rounded px-2 py-0.5 text-xs font-medium", normalized === "completed" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : normalized === "error" || normalized === "failed" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>
      <span className="truncate">{label}</span>
    </span>
  )
}

function buildTaskNodes(events: AgentTaskEvent[]): AgentTaskNode[] {
  const nodes = new Map<string, AgentTaskNode>()
  const order: string[] = []
  for (const event of events) {
    const payload = event.payload || {}
    const taskID = stringValue(payload.task_id)
    if (!taskID) {
      continue
    }
    let node = nodes.get(taskID)
    if (!node) {
      node = {
        taskID,
        parentID: "",
        kind: "",
        status: "running",
        groupID: "",
        groupName: "",
        agentID: "",
        agentName: "",
        agentType: "",
        goal: "",
        result: "",
        error: "",
        startedAt: event.created_at,
        updatedAt: event.created_at,
        events: [],
      }
      nodes.set(taskID, node)
      order.push(taskID)
    }
    node.events.push(event)
    node.updatedAt = event.created_at
    node.parentID = stringValue(payload.parent_id) || node.parentID
    node.kind = stringValue(payload.kind) || node.kind
    node.status = stringValue(payload.status) || node.status
    node.groupID = stringValue(payload.group_id) || node.groupID
    node.groupName = stringValue(payload.group_name) || node.groupName
    node.agentID = stringValue(payload.agent_id) || node.agentID
    node.agentName = stringValue(payload.agent_name) || node.agentName
    node.agentType = stringValue(payload.agent_type) || node.agentType
    node.goal = stringValue(payload.goal) || node.goal
    node.result = stringValue(payload.result) || node.result
    node.error = stringValue(payload.error) || node.error
  }
  return order.map((id) => nodes.get(id)).filter((node): node is AgentTaskNode => Boolean(node))
}

function normalizeRun(value: unknown): AgentTaskRun | null {
  if (!value || typeof value !== "object") {
    return null
  }
  const row = value as Record<string, unknown>
  const runID = stringValue(row.run_id)
  const sessionID = stringValue(row.session_id)
  if (!runID || !sessionID) {
    return null
  }
  return {
    run_id: runID,
    session_id: sessionID,
    session_title: stringValue(row.session_title),
    status: stringValue(row.status) || "running",
    status_message: stringValue(row.status_message),
    started_at: stringValue(row.started_at),
    updated_at: stringValue(row.updated_at),
    events: Array.isArray(row.events) ? row.events.map(normalizeEvent).filter((event): event is AgentTaskEvent => Boolean(event)) : [],
  }
}

function normalizeEvent(value: unknown): AgentTaskEvent | null {
  if (!value || typeof value !== "object") {
    return null
  }
  const row = value as Record<string, unknown>
  return {
    id: numberValue(row.id),
    run_id: stringValue(row.run_id),
    session_id: stringValue(row.session_id),
    seq: numberValue(row.seq),
    event: stringValue(row.event),
    payload: row.payload && typeof row.payload === "object" ? (row.payload as Record<string, unknown>) : {},
    created_at: stringValue(row.created_at),
  }
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function shortID(value: string): string {
  const text = value.trim()
  return text.length > 14 ? `${text.slice(0, 8)}...${text.slice(-4)}` : text
}

function callChainLabel(task: AgentTaskNode, copy: CopyText): string {
  const kind = task.kind === "cps" ? "CPS" : task.kind === "split" ? "Split" : task.kind || "agent"
  return `${copy.mainAssistant} -> ${kind} -> ${task.agentName || task.agentID || copy.unknownAgent}`
}

function latestUpdate(runs: AgentTaskRun[]): string {
  return runs.reduce((latest, run) => {
    if (!latest || (run.updated_at && run.updated_at > latest)) {
      return run.updated_at
    }
    return latest
  }, "")
}

function formatTime(value?: string): string {
  if (!value) {
    return ""
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ""
  }
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(date)
}

interface CopyText {
  title: string
  subtitle: string
  refresh: string
  runningRuns: string
  runningTasks: string
  updatedAt: string
  emptyTitle: string
  emptyText: string
  untitledSession: string
  run: string
  started: string
  openChat: string
  noAgentTasks: string
  unknownAgent: string
  group: string
  callChain: string
  mainAssistant: string
  parentCall: string
}

const enCopy: CopyText = {
  title: "Agent Tasks",
  subtitle: "Running CPS delegations and split agents, grouped by chat run.",
  refresh: "Refresh",
  runningRuns: "Running runs",
  runningTasks: "Running agent tasks",
  updatedAt: "Last update",
  emptyTitle: "No running agent tasks",
  emptyText: "CPS delegations and split-agent work will appear here while an assistant run is active.",
  untitledSession: "Untitled session",
  run: "Run",
  started: "Started",
  openChat: "Open chat",
  noAgentTasks: "This run has not requested another agent yet.",
  unknownAgent: "Unknown agent",
  group: "Group",
  callChain: "Call chain",
  mainAssistant: "Main assistant",
  parentCall: "Parent tool call",
}

const zhCopy: CopyText = {
  title: "\u4ee3\u7406\u4efb\u52a1",
  subtitle: "\u6309\u804a\u5929 run \u5206\u7ec4\u663e\u793a\u8fd0\u884c\u4e2d\u7684 CPS \u8c03\u7528\u548c\u5206\u88c2 agent\u3002",
  refresh: "\u5237\u65b0",
  runningRuns: "\u8fd0\u884c\u4e2d run",
  runningTasks: "\u8fd0\u884c\u4e2d agent \u4efb\u52a1",
  updatedAt: "\u6700\u540e\u66f4\u65b0",
  emptyTitle: "\u6682\u65e0\u8fd0\u884c\u4e2d\u4ee3\u7406\u4efb\u52a1",
  emptyText: "\u52a9\u624b run \u8c03\u7528 CPS \u6216\u5206\u88c2 agent \u65f6\uff0c\u8fd9\u91cc\u4f1a\u663e\u793a\u8c03\u7528\u94fe\u3002",
  untitledSession: "\u672a\u547d\u540d\u4f1a\u8bdd",
  run: "Run",
  started: "\u5f00\u59cb",
  openChat: "\u6253\u5f00\u804a\u5929",
  noAgentTasks: "\u8fd9\u4e2a run \u8fd8\u6ca1\u6709\u8bf7\u6c42\u5176\u4ed6 agent\u3002",
  unknownAgent: "\u672a\u77e5 agent",
  group: "\u5206\u7ec4",
  callChain: "\u8c03\u7528\u94fe",
  mainAssistant: "\u4e3b\u52a9\u624b",
  parentCall: "\u7236\u7ea7 tool call",
}
